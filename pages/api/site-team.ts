// pages/api/site-team.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';
import { requestSiteId } from '../../lib/request-auth';


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const authenticatedSiteId = requestSiteId(req);
    if (req.method === 'GET') {
      const { siteId } = req.query;
      const result = await query(`
        SELECT st.*, e.name as employee_name 
        FROM site_team st
        JOIN employees e ON st.employee_id = e.id
        WHERE st.site_id = $1
      `, [authenticatedSiteId === -1 ? Number(siteId) : Number(siteId) === authenticatedSiteId ? authenticatedSiteId : 0]);
      return res.status(200).json(result.rows);
    }


    if (req.method === 'POST') {
      const { site_id, employee_id } = req.body;
      const result = await query(
        `WITH candidate AS (
           SELECT $1::int AS site_id, id AS employee_id
           FROM employees
           WHERE id = $2 AND site_id = $1
         ), inserted AS (
           INSERT INTO site_team (site_id, employee_id)
           SELECT site_id, employee_id FROM candidate
           ON CONFLICT (site_id, employee_id) DO NOTHING
           RETURNING *
         )
         SELECT * FROM inserted
         UNION ALL
         SELECT st.* FROM site_team st
         JOIN candidate c ON c.site_id = st.site_id AND c.employee_id = st.employee_id
         LIMIT 1`,
        [authenticatedSiteId === -1 ? Number(site_id) : authenticatedSiteId, employee_id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Employee is not assigned to this site' });
      }
      return res.status(201).json(result.rows[0]);
    }


    if (req.method === 'DELETE') {
      const { id } = req.query;
      await query('DELETE FROM site_team WHERE id=$1 AND ($2 = -1 OR site_id=$2)', [id, authenticatedSiteId]);
      return res.status(200).json({ success: true });
    }


    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Site team API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
