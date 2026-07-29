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
