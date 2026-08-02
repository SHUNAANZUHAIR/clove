// pages/api/me.ts — self-service read-only view for an employee-role account:
// their own profile, salary history, and attendance. Nothing here lets a
// non-admin see another employee's data.
import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';
import { requestUser, authErrorResponse } from '../../lib/request-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  let authUser;
  try {
    authUser = await requestUser(req);
  } catch (error) {
    const { status, body } = authErrorResponse(error);
    return res.status(status).json(body);
  }
  if (!authUser.employeeId) {
    return res.status(404).json({ error: 'No employee profile is linked to this account. Contact an administrator.' });
  }

  const employee = await query(
    `SELECT e.id, e.name, e.job_title, e.job_level, e.medium, to_char(e.join_date, 'YYYY-MM-DD') AS join_date, s.name AS site_name
     FROM employees e LEFT JOIN sites s ON s.id = e.site_id
     WHERE e.id = $1`,
    [authUser.employeeId]
  );
  const salary = await query(
    `SELECT month, year, worked_days, absent_days, net_salary::float AS net_salary, status
     FROM salary_transactions WHERE employee_id = $1 ORDER BY year DESC, month DESC LIMIT 12`,
    [authUser.employeeId]
  );
  const attendance = await query(
    `SELECT to_char(attendance_date, 'YYYY-MM-DD') AS attendance_date, status,
       to_char(in_time, 'HH24:MI') AS in_time, to_char(out_time, 'HH24:MI') AS out_time
     FROM attendance WHERE employee_id = $1 ORDER BY attendance_date DESC LIMIT 31`,
    [authUser.employeeId]
  );

  return res.status(200).json({
    profile: employee.rows[0] || null,
    salary: salary.rows,
    attendance: attendance.rows,
  });
}
