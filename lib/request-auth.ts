import type { NextApiRequest } from 'next';
import { getSessionUser, SessionUser } from './auth';

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

// Resolves the calling user from the session id middleware.ts attached to
// the request (after verifying the cookie signature at the edge). This is
// the *authoritative* check — it hits the sessions/users tables, so a
// revoked session or deactivated account is rejected here even though the
// edge-only signature check in middleware.ts would have let the request through.
export async function requestUser(req: NextApiRequest): Promise<SessionUser> {
  const header = req.headers['x-clovehr-session-id'];
  const sessionId = Array.isArray(header) ? header[0] : header;
  if (!sessionId) throw new AuthError('Authentication required');
  const user = await getSessionUser(sessionId);
  if (!user) throw new AuthError('Your session has expired or been revoked. Please sign in again.');
  return user;
}

export const isAdmin = (user: SessionUser) => user.role === 'admin';

// Mirrors the legacy "$1 = -1 OR site_id = $1" scoping pattern used
// throughout pages/api/*: admins get -1 (see everything), a designated site
// manager gets their managed site id, and everyone else gets null (no site
// access).
export function siteScope(user: SessionUser): number | null {
  if (isAdmin(user)) return -1;
  return user.managedSiteId ?? null;
}

export function authErrorResponse(error: unknown) {
  if (error instanceof AuthError) return { status: error.status, body: { error: error.message } };
  return { status: 401, body: { error: 'Authentication required' } };
}
