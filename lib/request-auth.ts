import type { NextApiRequest } from 'next';

export function requestSiteId(req: NextApiRequest) {
  const value = Number(req.headers['x-clovehr-site-id']);
  if (!Number.isInteger(value) || value <= 0) throw new Error('Authenticated site is missing');
  return value;
}
