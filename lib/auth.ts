import { createHmac, timingSafeEqual } from 'crypto';
import bcrypt from 'bcryptjs';
import { query } from './db';
import { isValidBusiness, type Business } from './businesses';

export const authCookieName = 'clovehr_session';
export const authMaxAge = 60 * 60 * 24 * 30;

const secret = process.env.CLOVEHR_AUTH_SECRET || 'clovehr-site-session-v1';

export interface Session {
  business: Business;
  siteId: number;
}

export function createSession(business: Business, siteId: number) {
  const expires = Math.floor(Date.now() / 1000) + authMaxAge;
  const payload = `${business}.${siteId}.${expires}`;
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('hex')}`;
}

export function verifyPassword(password: unknown) {
  const expected = process.env.CLOVEHR_PASSWORD;
  if (!expected) {
    // Fail closed: never fall back to a guessable default password.
    console.error('CLOVEHR_PASSWORD is not configured; rejecting all logins.');
    return false;
  }
  const supplied = String(password || '');
  const first = Buffer.from(supplied);
  const second = Buffer.from(expected);
  return first.length === second.length && timingSafeEqual(first, second);
}

// The shared super-admin password lives in app_settings (public schema,
// common to all three businesses). Per-business sites.password_hash is
// created as part of each business schema's table definition.
export async function ensureAppSettingsSchema() {
  await query('CREATE TABLE IF NOT EXISTS app_settings (key VARCHAR(100) PRIMARY KEY, value TEXT)');
}

// Super admin's password can be overridden from the DB (set via the app);
// falls back to the CLOVEHR_PASSWORD env var until an admin sets one.
export async function verifySuperAdminPassword(password: unknown) {
  const stored = await query("SELECT value FROM app_settings WHERE key = 'super_admin_password_hash'");
  const hash: string | undefined = stored.rows[0]?.value;
  if (hash) return bcrypt.compare(String(password || ''), hash);
  return verifyPassword(password);
}

export async function setSuperAdminPassword(password: string) {
  const hash = await bcrypt.hash(password, 10);
  await query(
    `INSERT INTO app_settings (key, value) VALUES ('super_admin_password_hash', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [hash]
  );
}

export async function hashSitePassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifySitePassword(password: unknown, hash: string | null | undefined) {
  if (!hash) return false;
  return bcrypt.compare(String(password || ''), hash);
}

export function readSession(cookieHeader?: string): Session | null {
  const cookie = String(cookieHeader || '').split(';').map((item) => item.trim()).find((item) => item.startsWith(`${authCookieName}=`));
  const value = cookie?.slice(authCookieName.length + 1);
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 4) return null;
  const [business, siteIdRaw, expiresRaw, signature] = parts;
  if (!isValidBusiness(business) || Number(expiresRaw) <= Math.floor(Date.now() / 1000)) return null;
  const payload = `${business}.${siteIdRaw}.${expiresRaw}`;
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  const supplied = Buffer.from(signature);
  const valid = Buffer.from(expected);
  if (supplied.length !== valid.length || !timingSafeEqual(supplied, valid)) return null;
  const siteId = Number(siteIdRaw);
  if (!Number.isInteger(siteId)) return null;
  return { business, siteId };
}
