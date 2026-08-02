import type { NextApiRequest, NextApiResponse } from 'next';
import { readSessionSiteId } from '../../../lib/auth';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const siteId = readSessionSiteId(req.headers.cookie);
  if (!siteId) return res.status(401).json({ error: 'Authentication required' });
  return res.status(200).json({ site_id: siteId, is_super_admin: siteId === -1 });
}
