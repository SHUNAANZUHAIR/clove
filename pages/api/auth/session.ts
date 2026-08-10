import type { NextApiRequest, NextApiResponse } from 'next';
import { readSession } from '../../../lib/auth';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const session = readSession(req.headers.cookie);
  if (!session) return res.status(401).json({ error: 'Authentication required' });
  return res.status(200).json({ business: session.business, site_id: session.siteId, is_super_admin: session.siteId === -1 });
}
