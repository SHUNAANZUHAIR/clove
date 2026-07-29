import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';
import { requestSiteId } from '../../lib/request-auth';

const allowedStatuses = new Set(['present', 'absent', 'leave', 'off']);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureAttendanceTable();
    await ensureAttendanceHistoryTable();
    const authenticatedSiteId = requestSiteId(req);

    if (req.method === 'GET') {
      if (singleValue(req.query.history) === '1') {
        const history = await query(`
          SELECT h.id, to_char(h.start_date, 'YYYY-MM-DD') AS start_date,
            to_char(h.end_date, 'YYYY-MM-DD') AS end_date, h.site_id,
            COALESCE(s.name, 'All sites') AS site_name, h.employee_count,
            to_char(h.created_at, 'YYYY-MM-DD HH24:MI') AS created_at
          FROM attendance_save_history h
          LEFT JOIN sites s ON s.id = h.site_id
          WHERE ($1 = -1 OR h.site_id = $1)
          ORDER BY h.created_at DESC, h.id DESC
          LIMIT 50
        `, [authenticatedSiteId]);
        return res.status(200).json(history.rows);
      }
      const date = normalizeDate(req.query.date);
      if (!date) return res.status(400).json({ error: 'A valid attendance date is required' });

      const result = await query(`
        SELECT
          e.id AS employee_id,
          e.name AS employee_name,
          e.id_number,
          e.site_id,
          s.name AS site_name,
          CASE WHEN EXTRACT(ISODOW FROM $1::date) = 5 THEN 'off' ELSE COALESCE(a.status, 'present') END AS status,
          CASE WHEN EXTRACT(ISODOW FROM $1::date) = 5 THEN NULL ELSE COALESCE(to_char(a.in_time, 'HH24:MI'), '09:00') END AS in_time,
          CASE WHEN EXTRACT(ISODOW FROM $1::date) = 5 THEN NULL ELSE COALESCE(to_char(a.out_time, 'HH24:MI'), '17:00') END AS out_time,
          CASE WHEN EXTRACT(ISODOW FROM $1::date) = 5 THEN NULL ELSE to_char(a.ot_in_time, 'HH24:MI') END AS ot_in_time,
          CASE WHEN EXTRACT(ISODOW FROM $1::date) = 5 THEN NULL ELSE to_char(a.ot_out_time, 'HH24:MI') END AS ot_out_time,
          COALESCE(a.notes, '') AS notes,
          a.id
        FROM employees e
        LEFT JOIN sites s ON s.id = e.site_id
        LEFT JOIN attendance a ON a.employee_id = e.id AND a.attendance_date = $1
        WHERE COALESCE(e.is_terminated, FALSE) = FALSE AND ($2 = -1 OR e.site_id = $2)
        ORDER BY e.name ASC
      `, [date, authenticatedSiteId]);
      return res.status(200).json(result.rows);
    }

    if (req.method === 'POST') {
      const date = normalizeDate(req.body.date);
      const dates = Array.from(new Set(
        (Array.isArray(req.body.dates) ? req.body.dates : [date])
          .map((candidate) => normalizeDate(candidate))
          .filter((candidate) => Boolean(candidate))
      ));
      const records = Array.isArray(req.body.records) ? req.body.records : [];
      if (dates.length === 0) return res.status(400).json({ error: 'A valid attendance date is required' });
      if (dates.length > 31) return res.status(400).json({ error: 'Attendance ranges are limited to 31 days' });
      if (records.length === 0) return res.status(400).json({ error: 'No attendance records supplied' });
      const requestedEmployeeIds = records.map((record) => Number(record.employee_id)).filter(Number.isInteger);
      const allowedEmployees = await query('SELECT id FROM employees WHERE ($1 = -1 OR site_id = $1) AND id = ANY($2::int[])', [authenticatedSiteId, requestedEmployeeIds]);
      const allowedEmployeeIds = new Set(allowedEmployees.rows.map((row) => Number(row.id)));

      const rows = [];
      for (const record of records) {
        const employeeId = Number(record.employee_id);
        const status = String(record.status || '').toLowerCase();
        if (!Number.isInteger(employeeId) || employeeId <= 0 || !allowedEmployeeIds.has(employeeId) || !allowedStatuses.has(status)) continue;
        const inTime = normalizeTime(record.in_time);
        const outTime = normalizeTime(record.out_time);
        const otInTime = normalizeTime(record.ot_in_time);
        const otOutTime = normalizeTime(record.ot_out_time);
        for (const attendanceDate of dates) {
          const friday = isFridayDate(attendanceDate);
          rows.push([
            employeeId,
            attendanceDate,
            friday ? 'off' : status,
            String(record.notes || '').slice(0, 500),
            friday ? null : inTime,
            friday ? null : outTime,
            friday ? null : otInTime,
            friday ? null : otOutTime,
          ]);
        }
      }
      if (rows.length === 0) return res.status(400).json({ error: 'No valid attendance records supplied' });

      const params = rows.flat();
      const placeholders = rows.map((_, index) => {
        const offset = index * 8;
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`;
      }).join(', ');
      await query(`
        INSERT INTO attendance (employee_id, attendance_date, status, notes, in_time, out_time, ot_in_time, ot_out_time)
        VALUES ${placeholders}
        ON CONFLICT (employee_id, attendance_date)
        DO UPDATE SET status = EXCLUDED.status, notes = EXCLUDED.notes,
          in_time = EXCLUDED.in_time, out_time = EXCLUDED.out_time,
          ot_in_time = EXCLUDED.ot_in_time, ot_out_time = EXCLUDED.ot_out_time,
          updated_at = CURRENT_TIMESTAMP
      `, params);
      const requestedSiteId = Number(req.body.site_id);
      const siteId = authenticatedSiteId === -1 && Number.isInteger(requestedSiteId) && requestedSiteId > 0 ? requestedSiteId : authenticatedSiteId;
      const employeeIds = Array.from(new Set(rows.map((row) => row[0])));
      const orderedDates = [...dates].sort();
      const history = await query(`
        INSERT INTO attendance_save_history (start_date, end_date, site_id, employee_count)
        VALUES ($1, $2, $3, $4)
        RETURNING id, to_char(start_date, 'YYYY-MM-DD') AS start_date,
          to_char(end_date, 'YYYY-MM-DD') AS end_date, site_id, employee_count,
          to_char(created_at, 'YYYY-MM-DD HH24:MI') AS created_at
      `, [orderedDates[0], orderedDates[orderedDates.length - 1], siteId, employeeIds.length]);
      return res.status(200).json({ success: true, saved: rows.length, dates: dates.length, history: history.rows[0] });
    }

    if (req.method === 'DELETE') {
      const id = Number(singleValue(req.query.id));
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'A valid history id is required' });
      const result = await query('DELETE FROM attendance_save_history WHERE id = $1 AND ($2 = -1 OR site_id = $2) RETURNING id', [id, authenticatedSiteId]);
      return result.rowCount
        ? res.status(200).json({ success: true })
        : res.status(404).json({ error: 'Attendance history record not found' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Attendance API error:', error);
    return res.status(500).json({ error: 'Could not process attendance' });
  }
}

async function ensureAttendanceTable() {
  await query('ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_terminated BOOLEAN NOT NULL DEFAULT FALSE');
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
  await query('ALTER TABLE attendance ADD COLUMN IF NOT EXISTS in_time TIME');
  await query('ALTER TABLE attendance ADD COLUMN IF NOT EXISTS out_time TIME');
  await query('ALTER TABLE attendance ADD COLUMN IF NOT EXISTS ot_in_time TIME');
  await query('ALTER TABLE attendance ADD COLUMN IF NOT EXISTS ot_out_time TIME');
}

function normalizeDate(value) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : '';
}

function normalizeTime(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : null;
}

async function ensureAttendanceHistoryTable() {
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

function isFridayDate(value) {
  return new Date(`${value}T00:00:00Z`).getUTCDay() === 5;
}

function singleValue(value) {
  return Array.isArray(value) ? value[0] : value;
}
