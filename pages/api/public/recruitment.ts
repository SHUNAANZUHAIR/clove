// Public recruitment intake. Candidates submitted here are a standalone
// record, independent of the employees table and not tied to any site
// (Clove Construction, Cafe, or Guesthouse) until someone decides to onboard
// them.
import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';

const professions = new Set(['mason', 'carpenter', 'bar_bender', 'labour']);

async function ensureTable() {
  await query(`CREATE TABLE IF NOT EXISTS recruitment_candidates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    nationality VARCHAR(50),
    passport_number VARCHAR(50),
    birth_date DATE,
    profession VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await ensureTable();

    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Full name is required.' });

    const nationality = String(req.body?.nationality || '').trim().slice(0, 50) || null;
    const passportNumber = String(req.body?.passport_number || '').trim().slice(0, 50) || null;
    const birthDate = String(req.body?.birth_date || '').trim() || null;
    const profession = professions.has(req.body?.profession) ? req.body.profession : null;

    const result = await query(
      `INSERT INTO recruitment_candidates (name, nationality, passport_number, birth_date, profession)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name`,
      [name, nationality, passportNumber, birthDate, profession]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Recruitment submission error:', error);
    return res.status(500).json({ error: 'Could not submit this candidate. Please try again.' });
  }
}
