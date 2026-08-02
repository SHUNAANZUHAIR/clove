// pages/api/users.ts — admin-only management of individual login accounts.
import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';
import { requestUser, isAdmin, authErrorResponse } from '../../lib/request-auth';
import { ensureAuthSchema, hashPassword, revokeAllUserSessions } from '../../lib/auth';
import { logAudit } from '../../lib/audit';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let authUser;
  try {
    authUser = await requestUser(req);
  } catch (error) {
    const { status, body } = authErrorResponse(error);
    return res.status(status).json(body);
  }
  if (!isAdmin(authUser)) return res.status(403).json({ error: 'Only admins can manage user accounts.' });
  await ensureAuthSchema();

  try {
    if (req.method === 'GET') {
      const result = await query(`
        SELECT u.id, u.email, u.role, u.employee_id, e.name AS employee_name,
          u.managed_site_id, s.name AS managed_site_name,
          u.is_active, u.last_login_at, u.created_at
        FROM users u
        LEFT JOIN employees e ON e.id = u.employee_id
        LEFT JOIN sites s ON s.id = u.managed_site_id
        ORDER BY u.created_at DESC
      `);
      return res.status(200).json(result.rows);
    }

    if (req.method === 'POST') {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      const role = req.body?.role === 'admin' ? 'admin' : 'employee';
      const employeeId = req.body?.employee_id ? Number(req.body.employee_id) : null;
      const managedSiteId = req.body?.managed_site_id ? Number(req.body.managed_site_id) : null;

      if (!emailPattern.test(email)) return res.status(400).json({ error: 'A valid email is required.' });
      if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

      const passwordHash = await hashPassword(password);
      const result = await query(
        `INSERT INTO users (email, password_hash, role, employee_id, managed_site_id)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING id, email, role, employee_id, managed_site_id, is_active, created_at`,
        [email, passwordHash, role, employeeId, managedSiteId]
      );
      await logAudit(req, {
        user: authUser,
        action: 'user.create',
        targetType: 'user',
        targetId: result.rows[0].id,
        metadata: { email, role },
      });
      return res.status(201).json(result.rows[0]);
    }

    if (req.method === 'PUT') {
      const id = Number(req.body?.id);
      if (!id) return res.status(400).json({ error: 'User id is required.' });
      const role = req.body?.role === 'admin' ? 'admin' : 'employee';
      const employeeId = req.body?.employee_id ? Number(req.body.employee_id) : null;
      const managedSiteId = req.body?.managed_site_id ? Number(req.body.managed_site_id) : null;
      const isActive = req.body?.is_active !== false;
      const newPassword = req.body?.password ? String(req.body.password) : null;

      if (newPassword && newPassword.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
      }
      if (id === authUser.id && (role !== 'admin' || !isActive)) {
        return res.status(400).json({ error: 'You cannot remove your own admin access or deactivate your own account.' });
      }

      const passwordHash = newPassword ? await hashPassword(newPassword) : null;
      const result = await query(
        `UPDATE users SET role = $1, employee_id = $2, managed_site_id = $3, is_active = $4,
           password_hash = COALESCE($5, password_hash), updated_at = CURRENT_TIMESTAMP
         WHERE id = $6
         RETURNING id, email, role, employee_id, managed_site_id, is_active`,
        [role, employeeId, managedSiteId, isActive, passwordHash, id]
      );
      if (!result.rowCount) return res.status(404).json({ error: 'User not found.' });

      // A password reset or deactivation should kick out any existing sessions immediately.
      if (newPassword || !isActive) await revokeAllUserSessions(id);

      await logAudit(req, {
        user: authUser,
        action: 'user.update',
        targetType: 'user',
        targetId: id,
        metadata: { role, is_active: isActive, password_reset: Boolean(newPassword) },
      });
      return res.status(200).json(result.rows[0]);
    }

    res.setHeader('Allow', 'GET, POST, PUT');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      return res.status(409).json({ error: 'A user with that email already exists.' });
    }
    console.error('Users API error:', error);
    return res.status(500).json({ error: 'Could not process user request.' });
  }
}
