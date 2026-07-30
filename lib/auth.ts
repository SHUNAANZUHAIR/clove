import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import bcrypt from 'bcryptjs';
import { query } from './db';

export const authCookieName = 'clovehr_session';
export const authMaxAge = 60 * 60 * 24 * 7; // 7 days

const secret = process.env.CLOVEHR_AUTH_SECRET || 'clovehr-site-session-v1';
if (process.env.NODE_ENV === 'production' && !process.env.CLOVEHR_AUTH_SECRET) {
  // Not fatal (sessions still work) but every deployment sharing the default
  // secret can forge each other's session cookies. Set CLOVEHR_AUTH_SECRET.
  console.error('CLOVEHR_AUTH_SECRET is not set; using an insecure shared default. Set it in Vercel project env vars.');
}

const maxFailedAttempts = 5;
const lockoutMinutes = 15;

export interface SessionUser {
  id: number;
  email: string;
  role: 'admin' | 'employee';
  employeeId: number | null;
  managedSiteId: number | null;
}

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  role: 'admin' | 'employee';
  employee_id: number | null;
  managed_site_id: number | null;
  is_active: boolean;
  failed_attempts: number;
  locked_until: string | Date | null;
}

function signToken(payload: string) {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

// Idempotent — safe to call on every request the way the rest of this
// codebase already does for its other tables.
export async function ensureAuthSchema() {
  await query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'employee' CHECK (role IN ('admin','employee')),
    employee_id INTEGER UNIQUE REFERENCES employees(id) ON DELETE SET NULL,
    managed_site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMP,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await query(`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    ip TEXT,
    user_agent TEXT
  )`);
  await query('CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at)');
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyUserPassword(password: unknown, hash: string) {
  return bcrypt.compare(String(password || ''), hash);
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const result = await query(
    `SELECT id, email, password_hash, role, employee_id, managed_site_id, is_active, failed_attempts, locked_until
     FROM users WHERE lower(email) = lower($1)`,
    [email]
  );
  return result.rows[0] || null;
}

export function isLocked(lockedUntil: string | Date | null) {
  return !!lockedUntil && new Date(lockedUntil).getTime() > Date.now();
}

// Returns true if this failed attempt just locked the account.
export async function registerFailedLogin(userId: number, currentFailedAttempts: number) {
  const attempts = currentFailedAttempts + 1;
  const lock = attempts >= maxFailedAttempts;
  await query('UPDATE users SET failed_attempts = $1, locked_until = $2 WHERE id = $3', [
    lock ? 0 : attempts,
    lock ? new Date(Date.now() + lockoutMinutes * 60 * 1000) : null,
    userId,
  ]);
  return lock;
}

export async function registerSuccessfulLogin(userId: number) {
  await query('UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [userId]);
}

export async function createSession(userId: number, meta: { ip?: string | null; userAgent?: string | null }) {
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + authMaxAge * 1000);
  await query('INSERT INTO sessions (id, user_id, expires_at, ip, user_agent) VALUES ($1,$2,$3,$4,$5)', [
    id,
    userId,
    expiresAt,
    meta.ip || null,
    meta.userAgent || null,
  ]);
  const expires = Math.floor(expiresAt.getTime() / 1000);
  const payload = `${id}.${expires}`;
  return `${payload}.${signToken(payload)}`;
}

// Edge-safe: verifies the HMAC signature and expiry only (no DB round trip).
// This is intentionally duplicated in middleware.ts, which runs on the Edge
// runtime and cannot import this file (it pulls in `pg`, a Node-only module).
export function readSessionId(cookieHeader?: string): string | null {
  const cookie = String(cookieHeader || '')
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${authCookieName}=`));
  const value = cookie?.slice(authCookieName.length + 1);
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 3 || Number(parts[1]) <= Math.floor(Date.now() / 1000)) return null;
  const payload = `${parts[0]}.${parts[1]}`;
  const expected = signToken(payload);
  const supplied = Buffer.from(parts[2]);
  const valid = Buffer.from(expected);
  return supplied.length === valid.length && timingSafeEqual(supplied, valid) ? parts[0] : null;
}

// The authoritative check: hits the DB so revocation, deactivation, and role
// changes take effect immediately (not just after the cookie's own expiry).
export async function getSessionUser(sessionId: string): Promise<SessionUser | null> {
  const result = await query(
    `SELECT u.id, u.email, u.role, u.employee_id, u.managed_site_id
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.revoked_at IS NULL AND s.expires_at > CURRENT_TIMESTAMP AND u.is_active = TRUE`,
    [sessionId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    employeeId: row.employee_id,
    managedSiteId: row.managed_site_id,
  };
}

export async function revokeSession(sessionId: string) {
  await query('UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1', [sessionId]);
}

export async function revokeAllUserSessions(userId: number) {
  await query('UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
}
