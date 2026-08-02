// pages/api/audit-logs.ts — admin-only view of the audit trail.
import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';
import { requestUser, isAdmin, authErrorResponse } from '../../lib/request-auth';
import { ensureAuditSchema } from '../../lib/audit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  let authUser;
  try {
    authUser = await requestUser(req);
  } catch (error) {
    const { status, body } = authErrorResponse(error);
    return res.status(status).json(body);
  }
  if (!isAdmin(authUser)) return res.status(403).json({ error: 'Only admins can view the audit log.' });
  await ensureAuditSchema();

  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const actionFilter = typeof req.query.action === 'string' ? req.query.action : '';

  const params: Array<string | number> = [];
  let where = '';
  if (actionFilter) {
    params.push(`${actionFilter}%`);
    where = `WHERE action LIKE $${params.length}`;
  }
  params.push(limit, offset);

  const result = await query(
    `SELECT id, occurred_at, user_id, actor_email, actor_role, action, target_type, target_id, metadata, ip
     FROM audit_logs
     ${where}
     ORDER BY occurred_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return res.status(200).json(result.rows);
}
