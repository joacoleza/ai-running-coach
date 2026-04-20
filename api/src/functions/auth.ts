import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { ObjectId } from 'mongodb';
import { getDb } from '../shared/db.js';
import { User, RefreshToken } from '../shared/types.js';
import { requireAuth, getAuthContext } from '../middleware/auth.js';

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

// Pre-computed bcrypt hash of 'dummy' (10 rounds) for timing-safe email-not-found path
const DUMMY_HASH = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

function signAccessToken(user: User & { _id: ObjectId }): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return jwt.sign(
    { sub: user._id.toString(), email: user.email, isAdmin: user.isAdmin },
    secret,
    { expiresIn: '15m' },
  );
}

// Exported for unit testing
export function getLoginHandler() {
  return async (req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const { email, password } = (await req.json()) as { email?: string; password?: string };

      if (!email || !password) {
        return { status: 400, jsonBody: { error: 'email and password are required' } };
      }

      const db = await getDb();
      const user = await db.collection<User>('users').findOne({ email: email.toLowerCase().trim() });

      if (!user) {
        // Timing mitigation: run bcrypt against dummy hash so "email not found" takes same
        // time as "wrong password", preventing email enumeration via response timing.
        await bcrypt.compare(password, DUMMY_HASH);
        return { status: 401, jsonBody: { error: 'Invalid credentials' } };
      }

      // Lockout check — reject immediately without touching counters
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        const secondsRemaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000);
        const minutesRemaining = Math.ceil(secondsRemaining / 60);
        return {
          status: 429,
          headers: { 'Retry-After': String(secondsRemaining) },
          jsonBody: { error: `Account locked. Try again in ${minutesRemaining} minutes.` },
        };
      }

      const passwordMatch = await bcrypt.compare(password, user.passwordHash);

      if (!passwordMatch) {
        // Increment failed attempt counter
        const newCount = (user.failedLoginAttempts ?? 0) + 1;

        if (newCount >= 5) {
          // Trigger lockout
          const newLockoutCount = (user.lockoutCount ?? 0) + 1;
          const durationMinutes = Math.min(15 * Math.pow(2, newLockoutCount - 1), 1440);
          const lockedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
          await db.collection<User>('users').updateOne(
            { _id: user._id },
            { $set: { lockedUntil, lockoutCount: newLockoutCount, failedLoginAttempts: 0, updatedAt: new Date() } },
          );
          const secondsRemaining = Math.ceil(durationMinutes * 60);
          return {
            status: 429,
            headers: { 'Retry-After': String(secondsRemaining) },
            jsonBody: { error: `Account locked. Try again in ${durationMinutes} minutes.` },
          };
        }

        // Pre-lockout warning
        await db.collection<User>('users').updateOne(
          { _id: user._id },
          { $set: { failedLoginAttempts: newCount, updatedAt: new Date() } },
        );
        const remaining = 5 - newCount;
        const attemptWord = remaining === 1 ? 'attempt' : 'attempts';
        return {
          status: 401,
          jsonBody: { error: `Invalid credentials. ${remaining} ${attemptWord} remaining before account lockout.` },
        };
      }

      if (user.active === false) {
        return { status: 401, jsonBody: { error: 'Invalid credentials' } };
      }

      // Successful login — reset all rate limiting counters
      const rawRefreshToken = crypto.randomBytes(64).toString('hex');

      await db.collection<RefreshToken>('refresh_tokens').insertOne({
        userId: user._id as ObjectId,
        tokenHash: sha256(rawRefreshToken),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      await db.collection('users').updateOne(
        { _id: user._id },
        { $set: { failedLoginAttempts: 0, lockoutCount: 0, lastLoginAt: new Date(), updatedAt: new Date() } },
      );

      const token = signAccessToken(user as User & { _id: ObjectId });

      return {
        status: 200,
        jsonBody: { token, refreshToken: rawRefreshToken, expiresIn: 900, tempPassword: user.tempPassword },
      };
    } catch (err) {
      return { status: 500, jsonBody: { error: 'Internal server error' } };
    }
  };
}

// Exported for unit testing
export function getRefreshHandler() {
  return async (req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const { refreshToken } = (await req.json()) as { refreshToken?: string };

      if (!refreshToken) {
        return { status: 401, jsonBody: { error: 'Refresh token required' } };
      }

      const db = await getDb();
      const doc = await db
        .collection<RefreshToken>('refresh_tokens')
        .findOne({ tokenHash: sha256(refreshToken) });

      if (!doc || doc.expiresAt < new Date()) {
        return { status: 401, jsonBody: { error: 'Invalid or expired refresh token' } };
      }

      const user = await db.collection<User>('users').findOne({ _id: doc.userId });
      if (!user) {
        return { status: 401, jsonBody: { error: 'User not found' } };
      }

      // Update lastLoginAt to reflect active session (fire-and-forget)
      db.collection('users').updateOne(
        { _id: doc.userId },
        { $set: { lastLoginAt: new Date() } },
      ).catch(() => {/* non-fatal */});

      const token = signAccessToken(user as User & { _id: ObjectId });

      return {
        status: 200,
        jsonBody: { token, expiresIn: 900 },
      };
    } catch (err) {
      return { status: 500, jsonBody: { error: 'Internal server error' } };
    }
  };
}

// Exported for unit testing
export function getLogoutHandler() {
  return async (req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const authError = await requireAuth(req);
      if (authError) return authError;

      const { refreshToken } = (await req.json()) as { refreshToken?: string };

      if (refreshToken) {
        const db = await getDb();
        await db
          .collection('refresh_tokens')
          .deleteOne({ tokenHash: sha256(refreshToken) });
      }

      return { status: 204 };
    } catch (err) {
      return { status: 500, jsonBody: { error: 'Internal server error' } };
    }
  };
}

// Exported for unit testing
export function getChangePasswordHandler() {
  return async (req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const { newPassword, refreshToken } = (await req.json()) as {
        newPassword?: string;
        refreshToken?: string;
      };

      if (!newPassword) {
        return { status: 400, jsonBody: { error: 'newPassword is required' } };
      }
      if (newPassword.length < 8) {
        return { status: 400, jsonBody: { error: 'Password must be at least 8 characters' } };
      }
      if (!refreshToken) {
        return { status: 401, jsonBody: { error: 'Refresh token required' } };
      }

      const db = await getDb();

      // Authenticate via refresh token — avoids JWT signature issues across Azure instances
      const doc = await db
        .collection<RefreshToken>('refresh_tokens')
        .findOne({ tokenHash: sha256(refreshToken) });

      if (!doc || doc.expiresAt < new Date()) {
        return { status: 401, jsonBody: { error: 'Invalid or expired refresh token' } };
      }

      const user = await db.collection<User>('users').findOne({ _id: doc.userId });
      if (!user) {
        return { status: 401, jsonBody: { error: 'User not found' } };
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await db.collection<User>('users').updateOne(
        { _id: user._id as ObjectId },
        { $set: { passwordHash, tempPassword: false, updatedAt: new Date() } },
      );

      // Issue a fresh access token so the client can call login() immediately
      const token = signAccessToken(user as User & { _id: ObjectId });

      return { status: 200, jsonBody: { message: 'Password updated', token, refreshToken } };
    } catch (err) {
      return { status: 500, jsonBody: { error: 'Internal server error' } };
    }
  };
}

// Register Azure Functions handlers
app.http('authLogin', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/login',
  handler: getLoginHandler(),
});

app.http('authRefresh', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/refresh',
  handler: getRefreshHandler(),
});

app.http('authLogout', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/logout',
  handler: getLogoutHandler(),
});

app.http('authChangePassword', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/change-password',
  handler: getChangePasswordHandler(),
});

