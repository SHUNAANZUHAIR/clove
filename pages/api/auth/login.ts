import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';
import {
  authCookieName,
  authMaxAge,
  createSession,
  ensureSitePasswordSchema,
  verifySitePassword,
  verifySuperAdminPassword,
} from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const requestedSite = String(req.body?.site_id || '');
  const siteId = requestedSite === 'super_admin' ? -1 : Number(requestedSite);
  if (!Number.isInteger(siteId) || (siteId <= 0 && siteId !== -1)) {
    return res.status(401).json({ error: 'Invalid site login details.' });
  }

  await ensureSitePasswordSchema();
  if (siteId === -1) {
    // Super admin uses a DB-stored password once set from within the app;
    // falls back to the shared CLOVEHR_PASSWORD env var until then.
    if (!(await verifySuperAdminPassword(req.body?.password))) {
      return res.status(401).json({ error: 'Invalid site login details.' });
    }
  } else {
    const site = await query('SELECT id, password_hash FROM sites WHERE id = $1', [siteId]);
    if (!site.rowCount) return res.status(401).json({ error: 'Invalid work site.' });
    const siteHash: string | null = site.rows[0].password_hash;
    if (!(await verifySitePassword(req.body?.password, siteHash))) {
      return res.status(401).json({ error: 'Invalid site login details.' });
    }
  }

  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${authCookieName}=${createSession(siteId)}; Path=/; Max-Age=${authMaxAge}; HttpOnly; SameSite=Lax${secure}`);
  return res.status(200).json({ success: true });
}
