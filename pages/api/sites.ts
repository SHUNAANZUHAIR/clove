// pages/api/sites.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';
import { requestSiteId } from '../../lib/request-auth';


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const authenticatedSiteId = requestSiteId(req);
    if (req.method === 'GET') {
      const result = await query('SELECT * FROM sites WHERE id = $1', [authenticatedSiteId]);
      return res.status(200).json(result.rows);
    }


    if (req.method === 'POST') {
      return res.status(403).json({ error: 'Site logins cannot create other work sites.' });
    }


    if (req.method === 'PUT') {
      const { id, name, location } = req.body;
      const result = await query(
        'UPDATE sites SET name=$1, location=$2 WHERE id=$3 AND id=$4 RETURNING *',
        [name, location, id, authenticatedSiteId]
      );
      return res.status(200).json(result.rows[0]);
    }


    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (Number(id) !== authenticatedSiteId) return res.status(403).json({ error: 'Access denied.' });
      await query('UPDATE employees SET site_id=NULL WHERE site_id=$1', [authenticatedSiteId]);
      await query('DELETE FROM site_team WHERE site_id=$1', [authenticatedSiteId]);
      const result = await query('DELETE FROM sites WHERE id=$1 RETURNING id', [authenticatedSiteId]);
      return res.status(200).json({ success: true, deleted: result.rowCount });
    }


    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Site API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
