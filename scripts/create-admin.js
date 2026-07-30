#!/usr/bin/env node
// Bootstraps (or resets) an admin account, since the new login system has no
// built-in signup form. Run this once against production after applying
// migrations/002_user_access_management.sql.
//
// Usage:
//   DATABASE_URL=postgres://... node scripts/create-admin.js you@company.com "a strong password"
//
// Re-running with an existing email updates that user's password and
// promotes them to admin, so it also works as a password-reset tool.

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

async function main() {
  const [, , email, password] = process.argv;
  if (!email || !password) {
    console.error('Usage: DATABASE_URL=... node scripts/create-admin.js <email> <password>');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Set DATABASE_URL to your Postgres connection string first.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: connectionString.replace('sslmode=require', 'sslmode=verify-full') });
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'employee' CHECK (role IN ('admin','employee')),
      employee_id INTEGER,
      managed_site_id INTEGER,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TIMESTAMP,
      last_login_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, role, is_active, failed_attempts, locked_until)
       VALUES ($1, $2, 'admin', TRUE, 0, NULL)
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         role = 'admin',
         is_active = TRUE,
         failed_attempts = 0,
         locked_until = NULL,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id, email, role`,
      [email.trim().toLowerCase(), passwordHash]
    );
    console.log(`Admin account ready: ${result.rows[0].email} (id ${result.rows[0].id}).`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
