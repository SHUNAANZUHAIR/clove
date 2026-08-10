import type { NextApiRequest } from 'next';
import { isValidBusiness, type Business } from './businesses';

export function requestSiteId(req: NextApiRequest) {
  const value = Number(req.headers['x-clovehr-site-id']);
  if (!Number.isInteger(value) || (value <= 0 && value !== -1)) throw new Error('Authenticated site is missing');
  return value;
}

export function requestBusiness(req: NextApiRequest): Business {
  const value = req.headers['x-clovehr-business'];
  if (!isValidBusiness(value)) throw new Error('Authenticated business is missing');
  return value;
}

export const isSuperAdmin = (siteId: number) => siteId === -1;
