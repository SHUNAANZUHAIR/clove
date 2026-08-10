import type { NextApiRequest, NextApiResponse } from 'next';
import { queryFor } from '../../../../lib/db';
import { isValidBusiness } from '../../../../lib/businesses';
import { authorizeWorkflow } from '../../../../lib/workflow-auth';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  const siteId = authorizeWorkflow(req, res);
  if (siteId === null) return;
  const query = queryFor(isValidBusiness(req.query.business) ? req.query.business : 'construction');
  const date = String(Array.isArray(req.query.date) ? req.query.date[0] : req.query.date || '');
  if (!datePattern.test(date)) return res.status(400).json({ error: 'date must use YYYY-MM-DD.' });
  const requestedSite = Number(Array.isArray(req.query.site_id) ? req.query.site_id[0] : req.query.site_id);
  const targetSite = siteId === -1 && Number.isInteger(requestedSite) && requestedSite > 0 ? requestedSite : siteId;
  try {
    const result = await query(
      `SELECT e.id AS employee_id, e.name AS employee_name, e.site_id, s.name AS site_name,
        CASE WHEN EXTRACT(ISODOW FROM $1::date) = 5 THEN 'off' ELSE COALESCE(a.status, 'present') END AS status,
        CASE WHEN EXTRACT(ISODOW FROM $1::date) = 5 THEN NULL ELSE to_char(a.in_time, 'HH24:MI') END AS in_time,
        CASE WHEN EXTRACT(ISODOW FROM $1::date) = 5 THEN NULL ELSE to_char(a.out_time, 'HH24:MI') END AS out_time,
        COALESCE(a.notes, '') AS notes
       FROM employees e LEFT JOIN sites s ON s.id = e.site_id
       LEFT JOIN attendance a ON a.employee_id = e.id AND a.attendance_date = $1
       WHERE COALESCE(e.is_terminated, FALSE) = FALSE AND ($2 = -1 OR e.site_id = $2)
       ORDER BY e.name`,
      [date, targetSite]
    );
    return res.status(200).json({ date, attendance: result.rows, count: result.rowCount });
  } catch (error) {
    console.error('Workflow attendance error:', error);
    return res.status(500).json({ error: 'Could not load attendance.' });
  }
}
