import type { NextApiRequest, NextApiResponse } from 'next';
import {
  authCookieName,
  authMaxAge,
  ensureAuthSchema,
  findUserByEmail,
  verifyUserPassword,
  registerFailedLogin,
  registerSuccessfulLogin,
  isLocked,
  createSession,
} from '../../../lib/auth';
import { logAudit } from '../../../lib/audit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  await ensureAuthSchema();

  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = req.body?.password;
  const userAgentHeader = req.headers['user-agent'];
  const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader || null;
  const ip = requestIp(req);

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = await findUserByEmail(email);
  if (!user) {
    await logAudit(req, { actorEmail: email, action: 'auth.login_failed', metadata: { reason: 'unknown_email' } });
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  if (isLocked(user.locked_until)) {
    await logAudit(req, { actorEmail: email, actorRole: user.role, action: 'auth.login_blocked', metadata: { reason: 'locked' } });
    return res.status(423).json({ error: 'This account is temporarily locked after too many failed attempts. Try again in a few minutes.' });
  }

  if (!user.is_active) {
    await logAudit(req, { actorEmail: email, actorRole: user.role, action: 'auth.login_failed', metadata: { reason: 'inactive' } });
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const validPassword = await verifyUserPassword(password, user.password_hash);
  if (!validPassword) {
    const locked = await registerFailedLogin(user.id, user.failed_attempts);
    await logAudit(req, {
      actorEmail: email,
      actorRole: user.role,
      action: locked ? 'auth.login_locked' : 'auth.login_failed',
      metadata: { reason: 'bad_password' },
    });
    if (locked) {
      return res.status(423).json({ error: 'Too many failed attempts. This account is now locked for 15 minutes.' });
    }
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  await registerSuccessfulLogin(user.id);
  const cookieValue = await createSession(user.id, { ip, userAgent });
  await logAudit(req, { actorEmail: user.email, actorRole: user.role, action: 'auth.login_success' });

  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${authCookieName}=${cookieValue}; Path=/; Max-Age=${authMaxAge}; HttpOnly; SameSite=Lax${secure}`);
  return res.status(200).json({ success: true });
}

function requestIp(req: NextApiRequest) {
  const forwarded = req.headers['x-forwarded-for'];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return value?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;
}
