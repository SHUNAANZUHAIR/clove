// pages/api/salary.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const { employee_id, month, year, status } = req.query;
      
      let sql = `
        SELECT
          s.id,
          s.employee_id,
          s.month,
          s.year,
          s.worked_days,
          s.daily_rate::float AS daily_rate,
          s.absent_days,
          s.absent_deduction::float AS absent_deduction,
          s.cash_advance::float AS cash_advance,
          s.net_salary::float AS net_salary,
          s.status,
          s.created_at,
          s.updated_at,
          e.name as employee_name,
          e.salary::float as base_salary,
          e.medium
        FROM salary_transactions s
        JOIN employees e ON s.employee_id = e.id
        WHERE 1=1
      `;
      const params: any[] = [];
      
      if (employee_id) {
        params.push(employee_id);
        sql += ` AND s.employee_id = $${params.length}`;
      }
      if (month && month !== 'all') {
        params.push(month);
        sql += ` AND s.month = $${params.length}`;
      }
      if (year) {
        params.push(year);
        sql += ` AND s.year = $${params.length}`;
      }
      if (status && status !== 'all') {
        params.push(status);
        sql += ` AND s.status = $${params.length}`;
      }
      
      sql += ' ORDER BY s.year DESC, s.month DESC, e.name';
      
      const result = await query(sql, params);
      return res.status(200).json(result.rows);
    }


    if (req.method === 'POST') {
	      const {
	        employee_id,
	        employee_ids,
	        site_id,
	        job_level,
	        month,
        year,
        worked_days,
        absent_days,
        cash_advance,
	        status,
	      } = req.body;


	      const selectedEmployeeIds = normalizeEmployeeIds(employee_ids, employee_id);
	      const targets = await getSalaryTargets(site_id, selectedEmployeeIds, job_level);
	      if (targets.length === 0) {
	        return res.status(400).json({ error: 'No employees found for salary entry' });
	      }


      const salaryMonth = Number(month);
      const businessYear = Number(year) || new Date().getFullYear();
      if (!Number.isInteger(salaryMonth) || salaryMonth < 1 || salaryMonth > 12) {
        return res.status(400).json({ error: 'Select a valid salary month.' });
      }


	      if (targets.some((target) => !isSalaryMonthAfterJoinDate(target.join_date, salaryMonth, businessYear))) {
	        return res.status(400).json({ error: 'Salary month cannot be before an employee join date.' });
	      }


	      const targetIds = targets.map((target) => target.id);
	      const existingPaid = await query(
	        `SELECT id
	         FROM salary_transactions
	         WHERE employee_id = ANY($1::int[]) AND month=$2 AND year=$3 AND status='paid'
	         LIMIT 1`,
	        [targetIds, salaryMonth, businessYear]
	      );


	      if (existingPaid.rowCount > 0) {
	        return res.status(409).json({ error: 'This salary month is already paid for one or more selected employees.' });
	      }


	      const savedRows = [];
	      for (const target of targets) {
	        const calculated = calculateSalary(
            target.salary,
            target.join_date,
            salaryMonth,
            businessYear,
            absent_days,
            cash_advance
          );
        const result = await query(
          `INSERT INTO salary_transactions 
           (employee_id, month, year, worked_days, daily_rate, absent_days, 
            absent_deduction, cash_advance, net_salary, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (employee_id, month, year) 
           DO UPDATE SET 
             worked_days = EXCLUDED.worked_days,
             daily_rate = EXCLUDED.daily_rate,
             absent_days = EXCLUDED.absent_days,
             absent_deduction = EXCLUDED.absent_deduction,
             cash_advance = EXCLUDED.cash_advance,
             net_salary = EXCLUDED.net_salary,
             status = EXCLUDED.status,
             updated_at = CURRENT_TIMESTAMP
           RETURNING
             id,
             employee_id,
             month,
             year,
             worked_days,
             daily_rate::float AS daily_rate,
             absent_days,
             absent_deduction::float AS absent_deduction,
             cash_advance::float AS cash_advance,
             net_salary::float AS net_salary,
             status,
             created_at,
             updated_at`,
          [
            target.id,
            salaryMonth,
            businessYear,
            calculated.worked_days,
            calculated.daily_rate,
            calculated.absent_days,
            calculated.absent_deduction,
            calculated.cash_advance,
            calculated.net_salary,
            status || 'paid',
          ]
        );
        savedRows.push(result.rows[0]);
      }


	      return res.status(201).json(site_id || job_level || selectedEmployeeIds.length > 1 ? savedRows : savedRows[0]);
    }


    if (req.method === 'PUT') {
      const { id, status } = req.body;
      const result = await query(
        `UPDATE salary_transactions SET status=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2
         RETURNING
           id,
           employee_id,
           month,
           year,
           worked_days,
           daily_rate::float AS daily_rate,
           absent_days,
           absent_deduction::float AS absent_deduction,
           cash_advance::float AS cash_advance,
           net_salary::float AS net_salary,
           status,
           created_at,
           updated_at`,
        [status, id]
      );
      return res.status(200).json(result.rows[0]);
    }


    if (req.method === 'DELETE') {
      const { id } = req.query;
      const salaryId = Array.isArray(id) ? id[0] : id;
      const parsedId = Number(salaryId);


      if (!Number.isInteger(parsedId) || parsedId <= 0) {
        return res.status(400).json({ error: 'Salary transaction id is required' });
      }


      const result = await query('DELETE FROM salary_transactions WHERE id=$1 RETURNING id', [parsedId]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Salary transaction not found' });
      }


      return res.status(200).json({ success: true, deleted: result.rows[0].id });
    }


    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Salary API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}


async function getSalaryTargets(siteId?: number | string, employeeIds: number[] = [], jobLevel?: string) {
  if (siteId) {
    const result = await query(
      `SELECT DISTINCT e.id, e.salary::float AS salary, to_char(e.join_date, 'YYYY-MM-DD') AS join_date
       FROM employees e
       LEFT JOIN site_team st ON st.employee_id = e.id
       WHERE e.site_id = $1 OR st.site_id = $1
       ORDER BY e.id`,
      [siteId]
    );
    return result.rows as Array<{ id: number; salary: number; join_date: string | null }>;
  }


  if (employeeIds.length > 0) {
    const result = await query(
      `SELECT id, salary::float AS salary, to_char(join_date, 'YYYY-MM-DD') AS join_date
       FROM employees
       WHERE id = ANY($1::int[])
       ORDER BY id`,
      [employeeIds]
    );
    return result.rows as Array<{ id: number; salary: number; join_date: string | null }>;
  }


  if (jobLevel) {
    const result = await query(
      `SELECT id, salary::float AS salary, to_char(join_date, 'YYYY-MM-DD') AS join_date
       FROM employees
       WHERE COALESCE(job_level, 'labour') = $1
       ORDER BY id`,
      [jobLevel]
    );
    return result.rows as Array<{ id: number; salary: number; join_date: string | null }>;
  }


  return [];
}


function normalizeEmployeeIds(employeeIds: unknown, employeeId?: number | string) {
  const values = Array.isArray(employeeIds)
    ? employeeIds
    : employeeIds
      ? [employeeIds]
      : employeeId
        ? [employeeId]
        : [];


  return Array.from(new Set(
    values
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0)
  ));
}


function isSalaryMonthAfterJoinDate(joinDate: string | null, salaryMonth: number, businessYear: number) {
  if (!joinDate) return true;


  const [datePart] = joinDate.split('T');
  const [joinYear, joinMonth] = datePart.split('-').map(Number);
  if (!Number.isInteger(joinYear) || !Number.isInteger(joinMonth)) return true;


  if (businessYear < joinYear) return false;
  if (businessYear === joinYear && salaryMonth < joinMonth) return false;


  return true;
}


export function calculateSalary(baseSalary: number, joinDate: string | null, salaryMonth: number, businessYear: number, absentDaysInput: number, cashAdvanceInput: number) {
  const eligibleDays = getEligiblePayrollDays(joinDate, salaryMonth, businessYear);
  const absent_days = Math.min(eligibleDays, Math.max(0, Number(absentDaysInput) || 0));
  const worked_days = Math.max(0, eligibleDays - absent_days);
  const cash_advance = roundMoney(Math.max(0, Number(cashAdvanceInput) || 0));
  const rawDailyRate = Number(baseSalary || 0) / 30;
  const daily_rate = roundMoney(rawDailyRate);
  const absent_deduction = roundMoney(rawDailyRate * absent_days);
  const net_salary = roundMoney(Math.max(0, rawDailyRate * worked_days - cash_advance));


  return {
    worked_days,
    daily_rate,
    absent_days,
    absent_deduction,
    cash_advance,
    net_salary,
  };
}

function getEligiblePayrollDays(joinDate: string | null, salaryMonth: number, businessYear: number) {
  if (!joinDate) return 30;
  const [joinYear, joinMonth, joinDay] = joinDate.slice(0, 10).split('-').map(Number);
  if (joinYear !== businessYear || joinMonth !== salaryMonth || !Number.isInteger(joinDay)) return 30;
  return Math.max(0, 30 - Math.min(Math.max(joinDay, 1), 30) + 1);
}


function roundMoney(value: number) {
  return Number(value.toFixed(2));
}
