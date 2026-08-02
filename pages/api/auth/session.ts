import type { NextApiRequest, NextApiResponse } from 'next';
import { readSessionId, getSessionUser } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const sessionId = readSessionId(req.headers.cookie);
  const user = sessionId ? await getSessionUser(sessionId) : null;
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  return res.status(200).json({
    id: user.id,
    email: user.email,
    role: user.role,
    employee_id: user.employeeId,
    managed_site_id: user.managedSiteId,
    // Kept for backward compatibility with the existing dashboard UI, which
    // gates most of index.tsx on this single boolean.
    is_super_admin: user.role === 'admin',
  });
}
