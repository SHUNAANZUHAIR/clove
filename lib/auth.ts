import { createHmac, timingSafeEqual } from 'crypto';

export const authCookieName = 'clovehr_session';
export const authMaxAge = 60 * 60 * 24 * 30;

const secret = process.env.CLOVEHR_AUTH_SECRET || 'clovehr-site-session-v1';

export function createSession(siteId: number) {
  const expires = Math.floor(Date.now() / 1000) + authMaxAge;
  const payload = `${siteId}.${expires}`;
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('hex')}`;
}

export function verifyPassword(password: unknown) {
  const expected = process.env.CLOVEHR_PASSWORD || '123';
  const supplied = String(password || '');
  const first = Buffer.from(supplied);
  const second = Buffer.from(expected);
  return first.length === second.length && timingSafeEqual(first, second);
}

export function readSessionSiteId(cookieHeader?: string) {
  const cookie = String(cookieHeader || '').split(';').map((item) => item.trim()).find((item) => item.startsWith(`${authCookieName}=`));
  const value = cookie?.slice(authCookieName.length + 1);
  if (!value) return 0;
  const parts = value.split('.');
  if (parts.length !== 3 || Number(parts[1]) <= Math.floor(Date.now() / 1000)) return 0;
  const payload = `${parts[0]}.${parts[1]}`;
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  const supplied = Buffer.from(parts[2]);
  const valid = Buffer.from(expected);
  return supplied.length === valid.length && timingSafeEqual(supplied, valid) ? Number(parts[0]) : 0;
}
