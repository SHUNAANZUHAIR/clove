import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';
import { requestSiteId, isSuperAdmin } from '../../lib/request-auth';

const professionLabels: Record<string, string> = {
  mason: 'Mason',
  carpenter: 'Carpenter',
  bar_bender: 'Bar Bender',
  labour: 'Labour',
};

// Employees only have a fixed job_level enum (no "bar bender" option), so
// that profession maps to labour with the specific title kept in job_title.
const jobLevels = new Set(['labour', 'mason', 'carpenter']);
const jobLevelFor = (profession: string | null) => (profession && jobLevels.has(profession) ? profession : 'labour');

async function ensureTable() {
  await query(`CREATE TABLE IF NOT EXISTS recruitment_candidates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    nationality VARCHAR(50),
    passport_number VARCHAR(50),
    birth_date DATE,
    profession VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const authenticatedSiteId = requestSiteId(req);
    if (!isSuperAdmin(authenticatedSiteId)) return res.status(403).json({ error: 'Only super admin can review recruitment candidates.' });
    await ensureTable();

    if (req.method === 'GET') {
      const result = await query(
        'SELECT id, name, nationality, passport_number, birth_date, profession, created_at FROM recruitment_candidates ORDER BY created_at DESC'
      );
      return res.status(200).json(result.rows);
    }

    if (req.method === 'POST') {
      const candidateId = Number(req.body?.id);
      const siteId = Number(req.body?.site_id);
      if (!Number.isInteger(candidateId) || candidateId <= 0) return res.status(400).json({ error: 'A candidate is required.' });
      if (!Number.isInteger(siteId) || siteId <= 0) return res.status(400).json({ error: 'A business/work site is required.' });

      const site = await query('SELECT id FROM sites WHERE id = $1', [siteId]);
      if (site.rowCount === 0) return res.status(400).json({ error: 'Selected business was not found.' });

      const candidate = await query('SELECT * FROM recruitment_candidates WHERE id = $1', [candidateId]);
      if (candidate.rowCount === 0) return res.status(404).json({ error: 'Candidate not found.' });
      const row = candidate.rows[0];

      const employee = await query(
        `INSERT INTO employees (name, salary, id_number, birth_date, medium, employee_type, job_level, site_id, job_title, join_date)
         VALUES ($1, 5400, $2, $3, 'cash', 'local', $4, $5, $6, CURRENT_DATE)
         RETURNING id, name`,
        [row.name, row.passport_number, row.birth_date, jobLevelFor(row.profession), siteId, professionLabels[row.profession] || null]
      );
      await query('DELETE FROM recruitment_candidates WHERE id = $1', [candidateId]);
      return res.status(200).json(employee.rows[0]);
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    console.error('Recruitment review API error:', error);
    return res.status(500).json({ error: 'Could not process this request.' });
  }
}
