import type { NextApiRequest, NextApiResponse } from 'next';
import { authCookieName } from '../../../lib/auth';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${authCookieName}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`);
  return res.status(200).json({ success: true });
}
