import { createHash, timingSafeEqual } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';

export function authorizeWorkflow(req: NextApiRequest, res: NextApiResponse) {
  const configuredKey = process.env.CLOVEHR_WORKFLOW_API_KEY;
  if (!configuredKey) {
    res.status(503).json({ error: 'Workflow access is not configured.' });
    return null;
  }

  const authorization = String(req.headers.authorization || '');
  const suppliedKey = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const expected = createHash('sha256').update(configuredKey).digest();
  const supplied = createHash('sha256').update(suppliedKey).digest();
  if (!suppliedKey || !timingSafeEqual(supplied, expected)) {
    res.setHeader('WWW-Authenticate', 'Bearer');
    res.status(401).json({ error: 'A valid workflow API key is required.' });
    return null;
  }

  const configuredSite = Number(process.env.CLOVEHR_WORKFLOW_SITE_ID || -1);
  return Number.isInteger(configuredSite) && (configuredSite === -1 || configuredSite > 0)
    ? configuredSite
    : -1;
}
