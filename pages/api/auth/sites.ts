import type { NextApiRequest, NextApiResponse } from 'next';
import { queryFor } from '../../../lib/db';
import { isValidBusiness } from '../../../lib/businesses';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const requested = req.query.business;
    const business = isValidBusiness(requested) ? requested : 'construction';
    const query = queryFor(business);
    const result = await query('SELECT id, name, location FROM sites ORDER BY name');
    return res.status(200).json(result.rows);
  } catch {
    return res.status(500).json({ error: 'Could not load work sites.' });
  }
}
