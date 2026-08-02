import type { NextApiRequest, NextApiResponse } from 'next';
import { authCookieName, readSessionId, revokeSession, getSessionUser } from '../../../lib/auth';
import { logAudit } from '../../../lib/audit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const sessionId = readSessionId(req.headers.cookie);
    if (sessionId) {
      const user = await getSessionUser(sessionId);
      await revokeSession(sessionId);
      if (user) await logAudit(req, { user, action: 'auth.logout' });
    }
  } catch (error) {
    // Clearing the browser cookie is the critical logout operation. Database
    // cleanup is best-effort so a transient database failure cannot trap the
    // user in a session they are trying to leave.
    console.error('Could not revoke logout session:', error);
  }
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${authCookieName}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`);
  return res.status(200).json({ success: true });
}
