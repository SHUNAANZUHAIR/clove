import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

async function ensureTable() {
  await query(`CREATE TABLE IF NOT EXISTS employee_performance_ratings (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    rating_month DATE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (employee_id, rating_month)
  )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_employee_performance_month_rating
    ON employee_performance_ratings (rating_month, rating DESC)`);
}

function monthStart(value: unknown) {
  const month = String(value || '').trim();
  return monthPattern.test(month) ? `${month}-01` : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureTable();

    if (req.method === 'GET') {
      const ratingMonth = monthStart(req.query.month);
      if (!ratingMonth) return res.status(400).json({ error: 'Choose a valid month.' });
      const siteInput = String(req.query.site_id || '').trim();
      const siteId = siteInput ? Number(siteInput) : null;
      if (siteId !== null && (!Number.isInteger(siteId) || siteId <= 0)) return res.status(400).json({ error: 'Choose a valid work site.' });

      const [employeeResult, siteResult] = await Promise.all([
        query(
          `SELECT e.id, e.name, e.id_number AS passport_number, e.site_id, s.name AS site_name, r.rating
           FROM employees e
           LEFT JOIN sites s ON s.id = e.site_id
           LEFT JOIN employee_performance_ratings r
             ON r.employee_id = e.id AND r.rating_month = $1
           WHERE COALESCE(e.is_terminated, FALSE) = FALSE
             AND COALESCE(LOWER(s.name), '') NOT LIKE '%cafe%'
             AND COALESCE(LOWER(s.name), '') NOT LIKE '%guesthouse%'
             AND COALESCE(LOWER(s.name), '') NOT LIKE '%hotel%'
             AND ($2::integer IS NULL OR e.site_id = $2)
           ORDER BY r.rating DESC NULLS LAST, e.name ASC`,
          [ratingMonth, siteId]
        ),
        query(
          `SELECT DISTINCT s.id, s.name
           FROM sites s
           INNER JOIN employees e ON e.site_id = s.id
           WHERE COALESCE(e.is_terminated, FALSE) = FALSE
             AND LOWER(s.name) NOT LIKE '%cafe%'
             AND LOWER(s.name) NOT LIKE '%guesthouse%'
             AND LOWER(s.name) NOT LIKE '%hotel%'
           ORDER BY s.name ASC`
        ),
      ]);
      return res.status(200).json({ employees: employeeResult.rows, sites: siteResult.rows });
    }

    if (req.method === 'POST') {
      const employeeId = Number(req.body?.employee_id);
      const rating = Number(req.body?.rating);
      const ratingMonth = monthStart(req.body?.month);
      if (!Number.isInteger(employeeId) || employeeId <= 0) return res.status(400).json({ error: 'Choose an employee.' });
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be between 1 and 5 stars.' });
      if (!ratingMonth) return res.status(400).json({ error: 'Choose a valid month.' });

      const employee = await query(
        `SELECT e.id
         FROM employees e
         LEFT JOIN sites s ON s.id = e.site_id
         WHERE e.id = $1 AND COALESCE(e.is_terminated, FALSE) = FALSE
           AND COALESCE(LOWER(s.name), '') NOT LIKE '%cafe%'
           AND COALESCE(LOWER(s.name), '') NOT LIKE '%guesthouse%'
           AND COALESCE(LOWER(s.name), '') NOT LIKE '%hotel%'`,
        [employeeId]
      );
      if (employee.rowCount === 0) return res.status(404).json({ error: 'Construction employee not found.' });

      const result = await query(
        `INSERT INTO employee_performance_ratings (employee_id, rating, rating_month)
         VALUES ($1, $2, $3)
         ON CONFLICT (employee_id, rating_month)
         DO UPDATE SET rating = EXCLUDED.rating, updated_at = CURRENT_TIMESTAMP
         RETURNING employee_id, rating, TO_CHAR(rating_month, 'YYYY-MM') AS month`,
        [employeeId, rating, ratingMonth]
      );
      return res.status(200).json(result.rows[0]);
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    console.error('Public employee performance API error:', error);
    return res.status(500).json({ error: 'Could not load or save employee performance.' });
  }
}
