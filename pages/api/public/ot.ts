// Public self-service OT/attendance timesheet. Employees pick their own name
// from a dropdown (no password) and submit a full month of in/out and OT
// times, which lands in the same `attendance` table the super admin's
// "Submit attendance" flow writes to, so it feeds straight into payroll.
import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';

const allowedStatuses = new Set(['present', 'absent', 'leave', 'off']);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureAttendanceTables();

    if (req.method === 'GET') {
      const employeeId = Number(singleValue(req.query.employee_id));
      const month = Number(singleValue(req.query.month));
      const year = Number(singleValue(req.query.year));
      if (!Number.isInteger(employeeId) || employeeId <= 0) return res.status(400).json({ error: 'A valid employee is required.' });
      if (!Number.isInteger(month) || month < 1 || month > 12) return res.status(400).json({ error: 'A valid month is required.' });
      if (!Number.isInteger(year) || year < 2000) return res.status(400).json({ error: 'A valid year is required.' });

      const employee = await query('SELECT id, name FROM employees WHERE id = $1 AND COALESCE(is_terminated, FALSE) = FALSE', [employeeId]);
      if (employee.rowCount === 0) return res.status(404).json({ error: 'Employee not found.' });

      const result = await query(
        `SELECT to_char(attendance_date, 'YYYY-MM-DD') AS date, status,
           to_char(in_time, 'HH24:MI') AS in_time, to_char(out_time, 'HH24:MI') AS out_time,
           to_char(ot_in_time, 'HH24:MI') AS ot_in_time, to_char(ot_out_time, 'HH24:MI') AS ot_out_time
         FROM attendance
         WHERE employee_id = $1 AND EXTRACT(MONTH FROM attendance_date) = $2 AND EXTRACT(YEAR FROM attendance_date) = $3`,
        [employeeId, month, year]
      );
      const lastUpdatedResult = await query(
        `SELECT to_char(MAX(updated_at), 'DD Mon YYYY, HH24:MI') AS last_updated
         FROM attendance
         WHERE employee_id = $1 AND EXTRACT(MONTH FROM attendance_date) = $2 AND EXTRACT(YEAR FROM attendance_date) = $3`,
        [employeeId, month, year]
      );
      const locked = await isMonthPaid(employeeId, month, year);
      return res.status(200).json({
        employee: employee.rows[0],
        records: result.rows,
        locked,
        last_updated: lastUpdatedResult.rows[0]?.last_updated || null,
      });
    }

    if (req.method === 'POST') {
      const employeeId = Number(req.body?.employee_id);
      const records = Array.isArray(req.body?.records) ? req.body.records : [];
      if (!Number.isInteger(employeeId) || employeeId <= 0) return res.status(400).json({ error: 'A valid employee is required.' });
      if (records.length === 0) return res.status(400).json({ error: 'No timesheet rows supplied.' });
      if (records.length > 31) return res.status(400).json({ error: 'A timesheet cannot span more than 31 days.' });

      const employee = await query('SELECT id, site_id FROM employees WHERE id = $1 AND COALESCE(is_terminated, FALSE) = FALSE', [employeeId]);
      if (employee.rowCount === 0) return res.status(404).json({ error: 'Employee not found.' });
      const siteId = employee.rows[0].site_id;

      // Self-service always submits one month at a time — once that month's
      // salary is paid, the timesheet behind it is locked from further edits.
      const firstDate = normalizeDate(records[0]?.date);
      if (firstDate && (await isMonthPaid(employeeId, Number(firstDate.slice(5, 7)), Number(firstDate.slice(0, 4))))) {
        return res.status(409).json({ error: 'This month is locked because salary has already been paid. Contact your admin if it needs correcting.' });
      }

      const rows: Array<[number, string, string, string, string | null, string | null, string | null, string | null, string]> = [];
      for (const record of records) {
        const date = normalizeDate(record?.date);
        if (!date) continue;
        const status = String(record?.status || 'present').toLowerCase();
        if (!allowedStatuses.has(status)) continue;
        const friday = isFridayDate(date);
        rows.push([
          employeeId,
          date,
          friday ? 'off' : status,
          String(record?.notes || '').slice(0, 500),
          friday ? null : normalizeTime(record?.in_time),
          friday ? null : normalizeTime(record?.out_time),
          friday ? null : normalizeOtTime(record?.ot_in_time),
          friday ? null : normalizeOtTime(record?.ot_out_time),
          'self_service',
        ]);
      }
      if (rows.length === 0) return res.status(400).json({ error: 'No valid timesheet rows supplied.' });

      const params = rows.flat();
      const placeholders = rows.map((_, index) => {
        const offset = index * 9;
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`;
      }).join(', ');
      await query(
        `INSERT INTO attendance (employee_id, attendance_date, status, notes, in_time, out_time, ot_in_time, ot_out_time, source)
         VALUES ${placeholders}
         ON CONFLICT (employee_id, attendance_date)
         DO UPDATE SET status = EXCLUDED.status, notes = EXCLUDED.notes,
           in_time = EXCLUDED.in_time, out_time = EXCLUDED.out_time,
           ot_in_time = EXCLUDED.ot_in_time, ot_out_time = EXCLUDED.ot_out_time,
           source = EXCLUDED.source,
           updated_at = CURRENT_TIMESTAMP`,
        params
      );

      const orderedDates = [...new Set(rows.map((row) => row[1]))].sort();
      await query(
        `INSERT INTO attendance_save_history (start_date, end_date, site_id, employee_count) VALUES ($1, $2, $3, 1)`,
        [orderedDates[0], orderedDates[orderedDates.length - 1], siteId]
      );

      return res.status(200).json({ success: true, saved: rows.length });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Public OT API error:', error);
    return res.status(500).json({ error: 'Could not process the timesheet.' });
  }
}

async function ensureAttendanceTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS attendance (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      attendance_date DATE NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'present',
      in_time TIME,
      out_time TIME,
      ot_in_time TIME,
      ot_out_time TIME,
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(employee_id, attendance_date)
    )
  `);
  await query("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'admin'");
  await query(`
    CREATE TABLE IF NOT EXISTS attendance_save_history (
      id SERIAL PRIMARY KEY,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
      employee_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function normalizeDate(value: unknown) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
}

function normalizeTime(value: unknown) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : null;
}

// OT must fall same-day, between 6:00 PM and 11:59 PM — it never rolls into
// the next calendar day, so out-of-window values are clamped into range
// rather than trusted as-is from this unauthenticated endpoint.
function normalizeOtTime(value: unknown) {
  const time = normalizeTime(value);
  if (!time) return null;
  if (time < '18:00') return '18:00';
  if (time > '23:59') return '23:59';
  return time;
}

async function isMonthPaid(employeeId: number, month: number, year: number) {
  const result = await query(
    `SELECT 1 FROM salary_transactions WHERE employee_id = $1 AND month = $2 AND year = $3 AND status = 'paid'`,
    [employeeId, month, year]
  );
  return (result.rowCount ?? 0) > 0;
}

function isFridayDate(value: string) {
  return new Date(`${value}T00:00:00Z`).getUTCDay() === 5;
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
