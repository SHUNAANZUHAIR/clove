import type { NextApiRequest } from 'next';
import { query } from './db';
import type { SessionUser } from './auth';

export async function ensureAuditSchema() {
  await query(`CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    actor_email TEXT,
    actor_role TEXT,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    metadata JSONB,
    ip TEXT,
    user_agent TEXT
  )`);
  await query('CREATE INDEX IF NOT EXISTS idx_audit_logs_occurred_at ON audit_logs (occurred_at DESC)');
  await query('CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action)');
  await query('CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs (user_id)');
}

function requestMeta(req: NextApiRequest) {
  const forwarded = req.headers['x-forwarded-for'];
  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const ip = forwardedValue?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;
  const userAgentHeader = req.headers['user-agent'];
  const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader || null;
  return { ip, userAgent };
}

interface LogAuditParams {
  user?: SessionUser | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  action: string;
  targetType?: string;
  targetId?: string | number | null;
  metadata?: Record<string, unknown>;
}

// Best-effort: a logging failure must never break the request that
// triggered it, so every error is swallowed after being logged to stderr
// (which still shows up in Vercel runtime logs for debugging).
export async function logAudit(req: NextApiRequest, params: LogAuditParams) {
  try {
    await ensureAuditSchema();
    const { ip, userAgent } = requestMeta(req);
    await query(
      `INSERT INTO audit_logs (user_id, actor_email, actor_role, action, target_type, target_id, metadata, ip, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        params.user?.id ?? null,
        params.actorEmail ?? params.user?.email ?? null,
        params.actorRole ?? params.user?.role ?? null,
        params.action,
        params.targetType ?? null,
        params.targetId != null ? String(params.targetId) : null,
        params.metadata ? JSON.stringify(params.metadata) : null,
        ip,
        userAgent,
      ]
    );
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}
