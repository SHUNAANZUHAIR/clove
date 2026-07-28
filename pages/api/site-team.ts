// pages/api/site-team.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const { siteId } = req.query;
      const result = await query(`
        SELECT st.*, e.name as employee_name 
        FROM site_team st
        JOIN employees e ON st.employee_id = e.id
        WHERE st.site_id = $1
      `, [siteId]);
      return res.status(200).json(result.rows);
    }


    if (req.method === 'POST') {
      const { site_id, employee_id } = req.body;
      const result = await query(
        'INSERT INTO site_team (site_id, employee_id) VALUES ($1, $2) RETURNING *',
        [site_id, employee_id]
      );
      return res.status(201).json(result.rows[0]);
    }


    if (req.method === 'DELETE') {
      const { id } = req.query;
      await query('DELETE FROM site_team WHERE id=$1', [id]);
      return res.status(200).json({ success: true });
    }


    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Site team API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
