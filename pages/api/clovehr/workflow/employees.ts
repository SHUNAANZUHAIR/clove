import type { NextApiRequest, NextApiResponse } from 'next';
import { queryFor } from '../../../../lib/db';
import { isValidBusiness } from '../../../../lib/businesses';
import { authorizeWorkflow } from '../../../../lib/workflow-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  const siteId = authorizeWorkflow(req, res);
  if (siteId === null) return;
  const query = queryFor(isValidBusiness(req.query.business) ? req.query.business : 'construction');
  const requestedSite = Number(Array.isArray(req.query.site_id) ? req.query.site_id[0] : req.query.site_id);
  const activeOnly = String(req.query.active_only ?? 'true') !== 'false';
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);
  const targetSite = siteId === -1 && Number.isInteger(requestedSite) && requestedSite > 0 ? requestedSite : siteId;
  try {
    const result = await query(
      `SELECT e.id, e.name, e.id_number, e.job_title, e.job_level, e.employee_type,
        to_char(e.join_date, 'YYYY-MM-DD') AS join_date, e.is_terminated,
        to_char(e.terminated_at, 'YYYY-MM-DD') AS terminated_at, e.site_id, s.name AS site_name
       FROM employees e LEFT JOIN sites s ON s.id = e.site_id
       WHERE ($1 = -1 OR e.site_id = $1) AND ($2 = FALSE OR COALESCE(e.is_terminated, FALSE) = FALSE)
       ORDER BY e.name LIMIT $3`,
      [targetSite, activeOnly, limit]
    );
    return res.status(200).json({ employees: result.rows, count: result.rowCount });
  } catch (error) {
    console.error('Workflow employees error:', error);
    return res.status(500).json({ error: 'Could not load employees.' });
  }
}
