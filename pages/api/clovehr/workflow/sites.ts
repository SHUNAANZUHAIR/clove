import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../../lib/db';
import { authorizeWorkflow } from '../../../../lib/workflow-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  const siteId = authorizeWorkflow(req, res);
  if (siteId === null) return;
  try {
    const result = await query(
      `SELECT s.id, s.name, s.location, COUNT(e.id)::int AS employee_count
       FROM sites s LEFT JOIN employees e ON e.site_id = s.id AND COALESCE(e.is_terminated, FALSE) = FALSE
       WHERE ($1 = -1 OR s.id = $1)
       GROUP BY s.id, s.name, s.location ORDER BY s.name`,
      [siteId]
    );
    return res.status(200).json({ sites: result.rows });
  } catch (error) {
    console.error('Workflow sites error:', error);
    return res.status(500).json({ error: 'Could not load sites.' });
  }
}
