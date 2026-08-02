// pages/api/site-password.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';
import { requestSiteId, isSuperAdmin } from '../../lib/request-auth';
import { ensureSitePasswordSchema, hashSitePassword } from '../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const authenticatedSiteId = requestSiteId(req);
    if (!isSuperAdmin(authenticatedSiteId)) return res.status(403).json({ error: 'Only super admin can manage passwords.' });
    await ensureSitePasswordSchema();

    if (req.method === 'POST') {
      const { scope, site_id, password } = req.body;
      const supplied = String(password || '');
      if (supplied.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters.' });
      const hash = await hashSitePassword(supplied);

      if (scope === 'site') {
        const id = Number(site_id);
        if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid site.' });
        const result = await query('UPDATE sites SET password_hash = $1 WHERE id = $2 RETURNING id', [hash, id]);
        if (!result.rowCount) return res.status(404).json({ error: 'Site not found.' });
        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ error: 'Invalid scope.' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Site password API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
