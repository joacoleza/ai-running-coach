import { HttpRequest, HttpResponseInit } from '@azure/functions';
import jwt from 'jsonwebtoken';

export interface AuthContext {
  userId: string;
  email: string;
  isAdmin: boolean;
}

// WeakMap stores verified auth context keyed by the request object.
// This avoids re-verifying the JWT and avoids mutating the HttpRequest.
const authContextMap = new WeakMap<HttpRequest, AuthContext>();

export async function requireAuth(req: HttpRequest): Promise<HttpResponseInit | null> {
  const authHeader = req.headers.get('authorization');

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
    const payload = jwt.verify(token, secret) as {
      sub: string;
      email: string;
      isAdmin: boolean;
    };

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
