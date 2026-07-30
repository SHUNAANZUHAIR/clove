-- Migration: proper per-user access management + audit logging
-- Run after database.sql. Safe to re-run (idempotent).

-- Individual login accounts. Replaces the shared CLOVEHR_PASSWORD /
-- per-site password_hash / app_settings temp-password scheme.
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
    -- Links an employee-role account to their own employee record for self-service (pages/api/me.ts).
    employee_id INTEGER UNIQUE REFERENCES employees(id) ON DELETE SET NULL,
    -- Optional: lets an employee-role account manage attendance + view roster for one site
    -- (the "site manager" flag), without granting admin-wide access.
    managed_site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMP,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_employee ON users(employee_id);
CREATE INDEX IF NOT EXISTS idx_users_managed_site ON users(managed_site_id);

-- Server-side sessions so logins can actually be revoked (password reset,
-- deactivation, "log out everywhere") instead of only expiring after 7 days.
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    ip TEXT,
    user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Who did what, when. Every mutation (employee, salary, attendance, site,
-- user-account change) and every login attempt writes a row here.
CREATE TABLE IF NOT EXISTS audit_logs (
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
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_occurred_at ON audit_logs(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);

-- NOTE ON OLD COLUMNS: sites.password_hash and app_settings
-- (temp_site_password_hash) are left in place but are no longer read by
-- the login flow. They're safe to drop later once you've confirmed
-- everyone is on individual accounts:
--   ALTER TABLE sites DROP COLUMN IF EXISTS password_hash;
--   DELETE FROM app_settings WHERE key = 'temp_site_password_hash';
