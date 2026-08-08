// Public roster for the self-service OT timesheet. Deliberately returns only
// id + name (no salary, id numbers, or other personal data) since this
// endpoint is reachable without a site login.
import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const result = await query(
      `SELECT id, name FROM employees WHERE COALESCE(is_terminated, FALSE) = FALSE ORDER BY name ASC`
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Public employees API error:', error);
    return res.status(500).json({ error: 'Could not load the employee list.' });
  }
}
