import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';
import { requestUser, isAdmin, authErrorResponse } from '../../lib/request-auth';

const defaults = [
  ['local', 'Local Employee'],
  ['clove_expats', 'Clove Expats'],
  ['full_time_expats', 'Full Time Expats'],
];

async function ensureGroups() {
  await query(`CREATE TABLE IF NOT EXISTS employee_groups (
    value VARCHAR(30) PRIMARY KEY,
    label VARCHAR(80) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  for (const [value, label] of defaults) {
    await query('INSERT INTO employee_groups (value, label) VALUES ($1, $2) ON CONFLICT (value) DO NOTHING', [value, label]);
  }
  await query(`INSERT INTO employee_groups (value, label)
    SELECT DISTINCT employee_type, initcap(replace(employee_type, '_', ' ')) FROM employees
    WHERE employee_type IS NOT NULL AND employee_type <> ''
    ON CONFLICT (value) DO NOTHING`);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let authUser;
  try {
    authUser = await requestUser(req);
  } catch (error) {
    const { status, body } = authErrorResponse(error);
    return res.status(status).json(body);
  }

  try {
    if (!isAdmin(authUser)) return res.status(403).json({ error: 'Only admins can access the team workspace.' });
    await ensureGroups();
    if (req.method === 'GET') {
      const result = await query('SELECT value, label FROM employee_groups ORDER BY created_at, label');
      return res.status(200).json(result.rows);
    }
    if (req.method === 'POST') {
      const label = String(req.body?.label || '').trim().slice(0, 80);
      if (!label) return res.status(400).json({ error: 'Group name is required.' });
      const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'group';
      let value = base;
      let suffix = 2;
      while ((await query('SELECT 1 FROM employee_groups WHERE value = $1', [value])).rowCount) {
        value = `${base.slice(0, 26)}_${suffix++}`.slice(0, 30);
      }
      const result = await query('INSERT INTO employee_groups (value, label) VALUES ($1, $2) RETURNING value, label', [value, label]);
      return res.status(201).json(result.rows[0]);
    }
    if (req.method === 'PUT') {
      const value = String(req.body?.value || '');
      const label = String(req.body?.label || '').trim().slice(0, 80);
      if (!value || !label) return res.status(400).json({ error: 'Group and name are required.' });
      const result = await query('UPDATE employee_groups SET label = $1 WHERE value = $2 RETURNING value, label', [label, value]);
      return result.rowCount ? res.status(200).json(result.rows[0]) : res.status(404).json({ error: 'Group not found.' });
    }
    res.setHeader('Allow', 'GET, POST, PUT');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not manage employee groups.' });
  }
}
