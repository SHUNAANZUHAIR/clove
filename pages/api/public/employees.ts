// Public roster for the self-service OT timesheet, and public staff
// onboarding. GET deliberately returns only id + name + site (no salary, id
// numbers, or other personal data) since this endpoint is reachable
// without a site login. POST lets anyone with the link onboard a new
// employee through a simplified form -- the record then only becomes
// fully manageable (edit, terminate, agreements, etc.) from the super
// admin's Team tab, same as any other employee.
import type { NextApiRequest, NextApiResponse } from 'next';
import { queryFor } from '../../../lib/db';
import { isValidBusiness } from '../../../lib/businesses';

const jobLevels = new Set(['labour', 'mason', 'carpenter', 'supervisor']);

function resolveBusiness(value: unknown) {
  return isValidBusiness(value) ? value : 'construction';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const query = queryFor(resolveBusiness(req.query.business));
      const result = await query(
        `SELECT e.id, e.name, e.site_id, s.name AS site_name
         FROM employees e
         LEFT JOIN sites s ON s.id = e.site_id
         WHERE COALESCE(e.is_terminated, FALSE) = FALSE
         ORDER BY s.name ASC NULLS LAST, e.name ASC`
      );
      return res.status(200).json(result.rows);
    } catch (error) {
      console.error('Public employees API error:', error);
      return res.status(500).json({ error: 'Could not load the employee list.' });
    }
  }

  if (req.method === 'POST') {
    try {
      const query = queryFor(resolveBusiness(req.body?.business));
      const name = String(req.body?.name || '').trim();
      if (!name) return res.status(400).json({ error: 'Employee name is required.' });

      const siteId = Number(req.body?.site_id);
      if (!Number.isInteger(siteId) || siteId <= 0) return res.status(400).json({ error: 'A work site is required.' });
      const site = await query('SELECT id FROM sites WHERE id = $1', [siteId]);
      if (site.rowCount === 0) return res.status(400).json({ error: 'Selected work site was not found.' });

      const salaryInput = Number(req.body?.salary);
      const salary = Number.isFinite(salaryInput) && salaryInput > 0 ? salaryInput : 5400;
      const medium = req.body?.medium === 'account transfer' ? 'account transfer' : 'cash';
      const jobLevel = typeof req.body?.job_level === 'string' && jobLevels.has(req.body.job_level) ? req.body.job_level : 'labour';
      const idNumber = String(req.body?.id_number || '').trim().slice(0, 50) || null;
      const jobTitle = String(req.body?.job_title || '').trim().slice(0, 100) || null;

      const result = await query(
        `INSERT INTO employees
           (name, salary, id_number, medium, employee_type, job_level, site_id, job_title, join_date, hours_per_day, hours_per_week)
         VALUES ($1, $2, $3, $4, 'local', $5, $6, $7, CURRENT_DATE, 8, 48)
         RETURNING id, name`,
        [name, salary, idNumber, medium, jobLevel, siteId, jobTitle]
      );
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Public employee onboarding error:', error);
      return res.status(500).json({ error: 'Could not onboard this employee.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
