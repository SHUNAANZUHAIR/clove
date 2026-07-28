import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';

const allowedStatuses = new Set(['present', 'absent', 'leave', 'off']);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureAttendanceTable();

    if (req.method === 'GET') {
      const date = normalizeDate(req.query.date);
      if (!date) return res.status(400).json({ error: 'A valid attendance date is required' });

      const result = await query(`
        SELECT
          e.id AS employee_id,
          e.name AS employee_name,
          e.id_number,
          e.site_id,
          s.name AS site_name,
          COALESCE(a.status, 'present') AS status,
          COALESCE(a.notes, '') AS notes,
          a.id
        FROM employees e
        LEFT JOIN sites s ON s.id = e.site_id
        LEFT JOIN attendance a ON a.employee_id = e.id AND a.attendance_date = $1
        ORDER BY e.name ASC
      `, [date]);
      return res.status(200).json(result.rows);
    }

    if (req.method === 'POST') {
      const date = normalizeDate(req.body.date);
      const records = Array.isArray(req.body.records) ? req.body.records : [];
      if (!date) return res.status(400).json({ error: 'A valid attendance date is required' });
      if (records.length === 0) return res.status(400).json({ error: 'No attendance records supplied' });

      let saved = 0;
      for (const record of records) {
        const employeeId = Number(record.employee_id);
        const status = String(record.status || '').toLowerCase();
        if (!Number.isInteger(employeeId) || employeeId <= 0 || !allowedStatuses.has(status)) continue;
        await query(`
          INSERT INTO attendance (employee_id, attendance_date, status, notes)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (employee_id, attendance_date)
          DO UPDATE SET status = EXCLUDED.status, notes = EXCLUDED.notes, updated_at = CURRENT_TIMESTAMP
        `, [employeeId, date, status, String(record.notes || '').slice(0, 500)]);
        saved += 1;
      }
      return res.status(200).json({ success: true, saved });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Attendance API error:', error);
    return res.status(500).json({ error: 'Could not process attendance' });
  }
}

async function ensureAttendanceTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS attendance (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      attendance_date DATE NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'present',
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(employee_id, attendance_date)
    )
  `);
}

function normalizeDate(value: unknown) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : '';
}
