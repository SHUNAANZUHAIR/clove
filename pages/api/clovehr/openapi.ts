import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  const forwardedProto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000').split(',')[0];
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).json({
    openapi: '3.1.0',
    info: { title: 'CloveHR Workflow API', version: '1.0.0', description: 'Read-only, site-scoped access to CloveHR employee and attendance data.' },
    servers: [{ url: `${forwardedProto}://${host}` }],
    security: [{ bearerAuth: [] }],
    paths: {
      '/api/clovehr/workflow/sites': { get: { operationId: 'listSites', summary: 'List accessible work sites', responses: { '200': { description: 'Accessible sites' } } } },
      '/api/clovehr/workflow/employees': { get: { operationId: 'listEmployees', summary: 'List employees', parameters: [
        { name: 'site_id', in: 'query', schema: { type: 'integer' }, description: 'Site filter; only honored for an all-sites key.' },
        { name: 'active_only', in: 'query', schema: { type: 'boolean', default: true } },
        { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 200, default: 100 } }
      ], responses: { '200': { description: 'Employee list without salary or sensitive identity fields' } } } },
      '/api/clovehr/workflow/attendance': { get: { operationId: 'getAttendance', summary: 'Get attendance for a date', parameters: [
        { name: 'date', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
        { name: 'site_id', in: 'query', schema: { type: 'integer' }, description: 'Site filter; only honored for an all-sites key.' }
      ], responses: { '200': { description: 'Attendance records' }, '400': { description: 'Invalid date' } } } }
    },
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } } }
  });
}
