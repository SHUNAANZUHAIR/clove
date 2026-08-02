// pages/api/sites.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';
import { requestUser, isAdmin, siteScope, authErrorResponse } from '../../lib/request-auth';
import { logAudit } from '../../lib/audit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let authUser;
  try {
    authUser = await requestUser(req);
  } catch (error) {
    const { status, body } = authErrorResponse(error);
    return res.status(status).json(body);
  }

  try {
    const authenticatedSiteId = siteScope(authUser); // -1 = admin (all sites), a site id = that site's manager, null = no access
    if (authenticatedSiteId === null) {
      return res.status(403).json({ error: 'You do not manage a work site yet. Contact an administrator.' });
    }

    if (req.method === 'GET') {
      const result = await query(
        'SELECT id, name, location, created_at FROM sites WHERE ($1 = -1 OR id = $1) ORDER BY id DESC',
        [authenticatedSiteId]
      );
      return res.status(200).json(result.rows);
    }

    if (req.method === 'POST') {
      // Creating a new work site is admin-only.
      if (!isAdmin(authUser)) return res.status(403).json({ error: 'Only admins can create work sites.' });
      const { name, location } = req.body;
      const result = await query('INSERT INTO sites (name, location) VALUES ($1, $2) RETURNING id, name, location, created_at', [name, location]);
      await logAudit(req, { user: authUser, action: 'site.create', targetType: 'site', targetId: result.rows[0].id, metadata: { name } });
      return res.status(201).json(result.rows[0]);
    }

    if (req.method === 'PUT') {
      // Admins can edit any site; a site manager can edit only the site they manage.
      const { id, name, location } = req.body;
      const result = await query(
        'UPDATE sites SET name=$1, location=$2 WHERE id=$3 AND ($4 = -1 OR id=$4) RETURNING id, name, location, created_at',
        [name, location, id, authenticatedSiteId]
      );
      if (!result.rowCount) return res.status(404).json({ error: 'Site not found.' });
      await logAudit(req, { user: authUser, action: 'site.update', targetType: 'site', targetId: id, metadata: { name, location } });
      return res.status(200).json(result.rows[0]);
    }

    if (req.method === 'DELETE') {
      // Deleting a work site (and detaching its employees) is admin-only.
      if (!isAdmin(authUser)) return res.status(403).json({ error: 'Only admins can delete work sites.' });
      const { id } = req.query;
      const targetSiteId = Number(id);
      await query('UPDATE employees SET site_id=NULL WHERE site_id=$1', [targetSiteId]);
      await query('DELETE FROM site_team WHERE site_id=$1', [targetSiteId]);
      const result = await query('DELETE FROM sites WHERE id=$1 RETURNING id', [targetSiteId]);
      if (result.rowCount) await logAudit(req, { user: authUser, action: 'site.delete', targetType: 'site', targetId: targetSiteId });
      return res.status(200).json({ success: true, deleted: result.rowCount });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Site API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
