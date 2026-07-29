// pages/api/sites.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';
import { requestSiteId } from '../../lib/request-auth';


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const authenticatedSiteId = requestSiteId(req);
    if (req.method === 'GET') {
      const result = await query('SELECT * FROM sites WHERE ($1 = -1 OR id = $1) ORDER BY id DESC', [authenticatedSiteId]);
      return res.status(200).json(result.rows);
    }


    if (req.method === 'POST') {
      if (authenticatedSiteId !== -1) return res.status(403).json({ error: 'Site logins cannot create other work sites.' });
      const { name, location } = req.body;
      const result = await query('INSERT INTO sites (name, location) VALUES ($1, $2) RETURNING *', [name, location]);
      return res.status(201).json(result.rows[0]);
    }


    if (req.method === 'PUT') {
      const { id, name, location } = req.body;
      const result = await query(
        'UPDATE sites SET name=$1, location=$2 WHERE id=$3 AND ($4 = -1 OR id=$4) RETURNING *',
        [name, location, id, authenticatedSiteId]
      );
      return res.status(200).json(result.rows[0]);
    }


    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (authenticatedSiteId !== -1 && Number(id) !== authenticatedSiteId) return res.status(403).json({ error: 'Access denied.' });
      const targetSiteId = Number(id);
      await query('UPDATE employees SET site_id=NULL WHERE site_id=$1', [targetSiteId]);
      await query('DELETE FROM site_team WHERE site_id=$1', [targetSiteId]);
      const result = await query('DELETE FROM sites WHERE id=$1 RETURNING id', [targetSiteId]);
      return res.status(200).json({ success: true, deleted: result.rowCount });
    }


    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Site API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
