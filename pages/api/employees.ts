import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';

const maxPhotoPayloadLength = 2_500_000;
const allowedPhotoDataUrl = /^data:image\/(?:jpeg|jpg|png|webp);base64,/;
const employeeTypes = new Set(['local', 'clove_expats', 'full_time_expats']);
const jobLevels = new Set(['labour', 'mason', 'carpenter', 'supervisor']);

const agreementColumns = [
  ['work_permit_number', 'TEXT'], ['nationality', 'TEXT'], ['current_address', 'TEXT'], ['job_title', 'TEXT'],
  ['job_description', 'TEXT'],
  ['employment_status', "TEXT NOT NULL DEFAULT 'indefinite'"], ['fixed_term_end', 'DATE'],
  ['probation_applicable', 'BOOLEAN NOT NULL DEFAULT FALSE'], ['probation_months', 'INTEGER'],
  ['hours_per_day', 'NUMERIC(5,2)'], ['hours_per_week', 'NUMERIC(5,2)'], ['allowances_benefits', 'TEXT'],
  ['accommodation_provided', 'BOOLEAN NOT NULL DEFAULT FALSE'], ['meals_provided', 'BOOLEAN NOT NULL DEFAULT FALSE'],
  ['transport_provided', 'BOOLEAN NOT NULL DEFAULT FALSE'], ['return_airfare_provided', 'BOOLEAN NOT NULL DEFAULT FALSE'],
  ['benefit_details', 'TEXT'], ['notice_period', 'TEXT'], ['employer_signatory', 'TEXT'],
] as const;

const writableColumns = [
  'name', 'salary', 'id_number', 'birth_date', 'join_date', 'photo', 'medium', 'employee_type', 'job_level', 'site_id',
  ...agreementColumns.map(([name]) => name),
] as const;

async function ensureAgreementColumns() {
  for (const [name, definition] of agreementColumns) {
    await query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS ${name} ${definition}`);
  }
}

const normalize = (body: Record<string, unknown>): Record<string, unknown> => ({
  ...body,
  name: String(body.name || '').trim(),
  salary: normalizeSalary(body.salary),
  site_id: body.site_id ? Number(body.site_id) : null,
  birth_date: body.birth_date || null,
  join_date: body.join_date || null,
  photo: body.photo || null,
  medium: body.medium || 'cash',
  employee_type: normalizeEmployeeType(body.employee_type),
  job_level: normalizeJobLevel(body.job_level),
  employment_status: body.employment_status === 'fixed_term' ? 'fixed_term' : 'indefinite',
  probation_applicable: Boolean(body.probation_applicable),
  accommodation_provided: Boolean(body.accommodation_provided),
  meals_provided: Boolean(body.meals_provided),
  transport_provided: Boolean(body.transport_provided),
  return_airfare_provided: Boolean(body.return_airfare_provided),
  fixed_term_end: body.employment_status === 'fixed_term' ? body.fixed_term_end || null : null,
  probation_months: body.probation_applicable && body.probation_months ? Number(body.probation_months) : null,
  hours_per_day: body.hours_per_day ? Number(body.hours_per_day) : null,
  hours_per_week: body.hours_per_week ? Number(body.hours_per_week) : null,
});

export const config = { api: { bodyParser: { sizeLimit: '6mb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureAgreementColumns();

    if (req.method === 'GET') {
      const result = await query(`SELECT e.*, e.salary::float AS salary,
        to_char(e.birth_date, 'YYYY-MM-DD') AS birth_date,
        to_char(e.join_date, 'YYYY-MM-DD') AS join_date,
        to_char(e.fixed_term_end, 'YYYY-MM-DD') AS fixed_term_end,
        e.hours_per_day::float AS hours_per_day, e.hours_per_week::float AS hours_per_week,
        s.name AS site_name FROM employees e LEFT JOIN sites s ON e.site_id = s.id ORDER BY e.id DESC`);
      return res.status(200).json(result.rows);
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const values = normalize(req.body || {});
      if (!values.name) return res.status(400).json({ error: 'Employee name is required.' });
      const photoError = validatePhoto(values.photo);
      if (photoError) return res.status(400).json({ error: photoError });
      if (!['indefinite', 'fixed_term'].includes(String(values.employment_status || 'indefinite'))) {
        return res.status(400).json({ error: 'Invalid employment status.' });
      }

      const params = writableColumns.map((column) => values[column]);
      if (req.method === 'POST') {
        const placeholders = writableColumns.map((_, index) => `$${index + 1}`).join(', ');
        const result = await query(`INSERT INTO employees (${writableColumns.join(', ')}) VALUES (${placeholders}) RETURNING id`, params);
        return res.status(201).json(result.rows[0]);
      }

      const id = Number(req.body?.id);
      if (!id) return res.status(400).json({ error: 'Employee id is required.' });
      const assignments = writableColumns.map((column, index) => `${column} = $${index + 1}`).join(', ');
      const result = await query(`UPDATE employees SET ${assignments} WHERE id = $${params.length + 1} RETURNING id`, [...params, id]);
      return result.rowCount ? res.status(200).json(result.rows[0]) : res.status(404).json({ error: 'Employee not found.' });
    }

    if (req.method === 'DELETE') {
      const id = Number(req.query.id);
      if (!id) return res.status(400).json({ error: 'Employee id is required.' });
      await query('DELETE FROM employees WHERE id = $1', [id]);
      return res.status(204).end();
    }

    res.setHeader('Allow', 'GET, POST, PUT, DELETE');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not process employee request.' });
  }
}

function validatePhoto(photo: unknown) {
  if (!photo) return null;
  if (typeof photo !== 'string') return 'Invalid profile photo';
  if (!allowedPhotoDataUrl.test(photo)) return 'Profile photo must be a JPG, PNG, or WebP image';
  if (photo.length > maxPhotoPayloadLength) return 'Profile photo is too large';
  return null;
}

function normalizeEmployeeType(value: unknown) {
  return typeof value === 'string' && employeeTypes.has(value) ? value : 'local';
}

function normalizeJobLevel(value: unknown) {
  return typeof value === 'string' && jobLevels.has(value) ? value : 'labour';
}

function normalizeSalary(value: unknown) {
  const salary = Number(value);
  return Number.isFinite(salary) && salary > 0 ? salary : 5400;
}
