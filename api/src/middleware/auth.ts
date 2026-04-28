import { HttpRequest, HttpResponseInit } from '@azure/functions';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { getDb } from '../shared/db.js';
import { User } from '../shared/types.js';

export interface AuthContext {
  userId: string;
  email: string;
  isAdmin: boolean;
}

// WeakMap stores verified auth context keyed by the request object.
// This avoids re-verifying the JWT and avoids mutating the HttpRequest.
const authContextMap = new WeakMap<HttpRequest, AuthContext>();

export async function requireAuth(req: HttpRequest): Promise<HttpResponseInit | null> {
  // Read from X-Authorization to avoid Azure SWA overwriting the standard Authorization header.
  // Azure Static Web Apps injects its own Easy Auth token into the Authorization header before
  // forwarding to managed Functions, causing "invalid signature" on our custom JWTs.
  // X-Authorization is a custom header that SWA passes through untouched.
  const authHeader = req.headers.get('x-authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      status: 401,
      jsonBody: { error: 'Authorization required' },
    };
  }

  const token = authHeader.slice('Bearer '.length).trim();

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] }) as {
      sub: string;
      email: string;
      isAdmin: boolean;
    };

    // Check that the user exists and is not deactivated
    const db = await getDb();
    const user = await db.collection<User>('users').findOne({ _id: new ObjectId(payload.sub) });
    if (!user || user.active === false) {
      return { status: 401, jsonBody: { error: 'Account is deactivated' } };
    }

    authContextMap.set(req, {
      userId: payload.sub,
      email: payload.email,
      isAdmin: payload.isAdmin,
    });

    return null;
  } catch {
    return {
      status: 401,
      jsonBody: { error: 'Invalid or expired token' },
    };
  }
}

export function getAuthContext(req: HttpRequest): AuthContext {
  const ctx = authContextMap.get(req);
  if (!ctx) {
    throw new Error('getAuthContext called before requireAuth — call requireAuth first');
  }
  return ctx;
}

/**
 * Middleware guard for admin-only routes.
 * Call requireAuth FIRST in the handler, then call requireAdmin.
 * requireAdmin assumes requireAuth has already been called (authContext exists on req).
 * Returns null if authorized, or 403 HttpResponseInit if not admin.
 */
export async function requireAdmin(req: HttpRequest): Promise<HttpResponseInit | null> {
  const denied = await requireAuth(req);
  if (denied) return denied;

  const ctx = getAuthContext(req);
  if (!ctx.isAdmin) {
    return {
      status: 403,
      jsonBody: { error: 'Admin access required' },
    };
  }

  return null;
}
