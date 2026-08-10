// Per-employee attendance + payroll summary shown under "Give salary" on the
// super admin dashboard. Only lists employees who submitted a timesheet
// through the public self-service "Submit Attendance" flow for the
// requested month (source = 'self_service'), not attendance entered by an
// admin — hours are derived from the attendance table; deduction/payout
// figures come from the matching salary_transactions row (null until that
// month's salary has been given).
import type { NextApiRequest, NextApiResponse } from 'next';
import { queryFor } from '../../../lib/db';
import { requestSiteId, requestBusiness, isSuperAdmin } from '../../../lib/request-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const authenticatedSiteId = requestSiteId(req);
    if (!isSuperAdmin(authenticatedSiteId)) return res.status(403).json({ error: 'Only super admin can access payroll.' });
    const query = queryFor(requestBusiness(req));

    if (req.method === 'GET') {
      const month = Number(singleValue(req.query.month));
      const year = Number(singleValue(req.query.year));
      if (!Number.isInteger(month) || month < 1 || month > 12) return res.status(400).json({ error: 'A valid month is required.' });
      if (!Number.isInteger(year) || year < 2000) return res.status(400).json({ error: 'A valid year is required.' });

      const result = await query(
        `SELECT
           e.id AS employee_id,
           e.name AS employee_name,
           COALESCE(att.days_worked, 0)::int AS days_worked,
           COALESCE(att.days_absent, 0)::int AS days_absent,
           COALESCE(att.work_hours, 0)::float AS work_hours,
           COALESCE(att.ot_hours, 0)::float AS ot_hours,
           s.absent_deduction::float AS less_work_days_deduction,
           s.cash_advance::float AS other_deductions,
           s.net_salary::float AS total_payout,
           s.status AS payout_status
         FROM employees e
         INNER JOIN (
           SELECT
             employee_id,
             COUNT(*) FILTER (WHERE status = 'present') AS days_worked,
             COUNT(*) FILTER (WHERE status = 'absent') AS days_absent,
             SUM(CASE
               WHEN status = 'present' AND in_time IS NOT NULL AND out_time IS NOT NULL
               THEN EXTRACT(EPOCH FROM (CASE WHEN out_time < in_time THEN (out_time - in_time) + INTERVAL '24 hours' ELSE out_time - in_time END)) / 3600.0
               ELSE 0
             END) AS work_hours,
             SUM(CASE
               WHEN ot_in_time IS NOT NULL AND ot_out_time IS NOT NULL
               THEN EXTRACT(EPOCH FROM (CASE WHEN ot_out_time < ot_in_time THEN (ot_out_time - ot_in_time) + INTERVAL '24 hours' ELSE ot_out_time - ot_in_time END)) / 3600.0
               ELSE 0
             END) AS ot_hours
           FROM attendance
           WHERE source = 'self_service' AND EXTRACT(MONTH FROM attendance_date) = $1 AND EXTRACT(YEAR FROM attendance_date) = $2
           GROUP BY employee_id
         ) att ON att.employee_id = e.id
         LEFT JOIN salary_transactions s ON s.employee_id = e.id AND s.month = $1 AND s.year = $2
         WHERE COALESCE(e.is_terminated, FALSE) = FALSE AND ($3 = -1 OR e.site_id = $3)
         ORDER BY e.name ASC`,
        [month, year, authenticatedSiteId]
      );

      return res.status(200).json(result.rows);
    }

    if (req.method === 'DELETE') {
      const employeeId = Number(singleValue(req.query.employee_id));
      const month = Number(singleValue(req.query.month));
      const year = Number(singleValue(req.query.year));
      if (!Number.isInteger(employeeId) || employeeId <= 0) return res.status(400).json({ error: 'A valid employee is required.' });
      if (!Number.isInteger(month) || month < 1 || month > 12) return res.status(400).json({ error: 'A valid month is required.' });
      if (!Number.isInteger(year) || year < 2000) return res.status(400).json({ error: 'A valid year is required.' });

      const result = await query(
        `DELETE FROM attendance
         WHERE employee_id = $1 AND source = 'self_service'
           AND EXTRACT(MONTH FROM attendance_date) = $2 AND EXTRACT(YEAR FROM attendance_date) = $3
           AND employee_id IN (SELECT id FROM employees WHERE $4 = -1 OR site_id = $4)`,
        [employeeId, month, year, authenticatedSiteId]
      );

      return res.status(200).json({ success: true, deleted: result.rowCount });
    }

    res.setHeader('Allow', 'GET, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Attendance summary report error:', error);
    return res.status(500).json({ error: 'Could not process the attendance summary.' });
  }
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
