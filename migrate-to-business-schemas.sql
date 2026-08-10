-- Splits CloveHR's shared `public` schema data into three business-specific
-- schemas: construction, clove_cafe, clove_guesthouse.
--
-- Idempotent: every statement uses IF NOT EXISTS / ON CONFLICT DO NOTHING, so
-- re-running this script is safe.
--
-- IMPORTANT: this script COPIES data out of the existing public.* tables into
-- the new per-business schemas. It does NOT drop or modify the public.*
-- tables — they remain untouched as a rollback point. Dropping them is a
-- separate, deliberate cleanup step for later.
--
-- recruitment_candidates and app_settings stay in the public schema (shared
-- across all businesses) and are not touched by this script.

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Create the three schemas
-- ---------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS construction;
CREATE SCHEMA IF NOT EXISTS clove_cafe;
CREATE SCHEMA IF NOT EXISTS clove_guesthouse;

-- ---------------------------------------------------------------------
-- 2. Create the 7 business tables in each schema (same shape as public.*)
-- ---------------------------------------------------------------------
DO $$
DECLARE
  target_schema TEXT;
BEGIN
  FOREACH target_schema IN ARRAY ARRAY['construction', 'clove_cafe', 'clove_guesthouse']
  LOOP
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.sites (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        location VARCHAR(200),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        password_hash TEXT
    )', target_schema);

    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.employees (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        salary NUMERIC(10,2) NOT NULL,
        id_number VARCHAR(50),
        birth_date DATE,
        join_date DATE,
        photo TEXT,
        medium VARCHAR(20) DEFAULT ''cash'',
        employee_type VARCHAR(30) DEFAULT ''local'',
        job_level VARCHAR(30) DEFAULT ''labour'',
        site_id INTEGER REFERENCES %I.sites(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        work_permit_number TEXT,
        nationality TEXT,
        current_address TEXT,
        job_title TEXT,
        job_description TEXT,
        employment_status TEXT NOT NULL DEFAULT ''indefinite'',
        fixed_term_end DATE,
        probation_applicable BOOLEAN NOT NULL DEFAULT FALSE,
        probation_months INTEGER,
        hours_per_day NUMERIC(5,2),
        hours_per_week NUMERIC(5,2),
        allowances_benefits TEXT,
        accommodation_provided BOOLEAN NOT NULL DEFAULT FALSE,
        meals_provided BOOLEAN NOT NULL DEFAULT FALSE,
        transport_provided BOOLEAN NOT NULL DEFAULT FALSE,
        return_airfare_provided BOOLEAN NOT NULL DEFAULT FALSE,
        benefit_details TEXT,
        notice_period TEXT,
        employer_signatory TEXT,
        is_terminated BOOLEAN NOT NULL DEFAULT FALSE,
        terminated_at DATE,
        agreement_verification_token VARCHAR(64) UNIQUE
    )', target_schema, target_schema);

    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.site_team (
        id SERIAL PRIMARY KEY,
        site_id INTEGER REFERENCES %I.sites(id) ON DELETE CASCADE,
        employee_id INTEGER REFERENCES %I.employees(id) ON DELETE CASCADE,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(site_id, employee_id)
    )', target_schema, target_schema, target_schema);

    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.salary_transactions (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER REFERENCES %I.employees(id) ON DELETE CASCADE,
        month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
        year INTEGER NOT NULL,
        worked_days INTEGER DEFAULT 0,
        daily_rate NUMERIC(10,2) DEFAULT 0,
        absent_days INTEGER DEFAULT 0,
        absent_deduction NUMERIC(10,2) DEFAULT 0,
        cash_advance NUMERIC(10,2) DEFAULT 0,
        net_salary NUMERIC(10,2) DEFAULT 0,
        status VARCHAR(20) DEFAULT ''pending'',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ot_hours NUMERIC(6,2) NOT NULL DEFAULT 0,
        ot_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
        ot_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
        UNIQUE(employee_id, month, year)
    )', target_schema, target_schema);

    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.attendance (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES %I.employees(id) ON DELETE CASCADE,
        attendance_date DATE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT ''present'',
        in_time TIME,
        out_time TIME,
        ot_in_time TIME,
        ot_out_time TIME,
        notes TEXT NOT NULL DEFAULT '''',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        source VARCHAR(20) NOT NULL DEFAULT ''admin'',
        UNIQUE(employee_id, attendance_date)
    )', target_schema, target_schema);

    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.attendance_save_history (
        id SERIAL PRIMARY KEY,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        site_id INTEGER REFERENCES %I.sites(id) ON DELETE SET NULL,
        employee_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )', target_schema, target_schema);

    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.employee_groups (
        value VARCHAR(30) PRIMARY KEY,
        label VARCHAR(80) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )', target_schema);

    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_employee_site ON %I.employees(site_id)', target_schema, target_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_employee_type ON %I.employees(employee_type)', target_schema, target_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_employee_job_level ON %I.employees(job_level)', target_schema, target_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_site_team_site ON %I.site_team(site_id)', target_schema, target_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_site_team_employee ON %I.site_team(employee_id)', target_schema, target_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_salary_employee ON %I.salary_transactions(employee_id)', target_schema, target_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_salary_month_year ON %I.salary_transactions(month, year)', target_schema, target_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_attendance_date ON %I.attendance(attendance_date)', target_schema, target_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_attendance_employee ON %I.attendance(employee_id)', target_schema, target_schema);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 3. Seed employee_groups identically in every schema (small lookup table)
-- ---------------------------------------------------------------------
DO $$
DECLARE
  target_schema TEXT;
BEGIN
  FOREACH target_schema IN ARRAY ARRAY['construction', 'clove_cafe', 'clove_guesthouse']
  LOOP
    EXECUTE format(
      'INSERT INTO %I.employee_groups (value, label, created_at)
       SELECT value, label, created_at FROM public.employee_groups
       ON CONFLICT (value) DO NOTHING',
      target_schema
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 4. Copy sites into the matching schema, by name
-- ---------------------------------------------------------------------
INSERT INTO clove_cafe.sites (id, name, location, created_at, password_hash)
SELECT id, name, location, created_at, password_hash FROM public.sites
WHERE name = 'Clove Cafe & Bistro'
ON CONFLICT (id) DO NOTHING;

INSERT INTO clove_guesthouse.sites (id, name, location, created_at, password_hash)
SELECT id, name, location, created_at, password_hash FROM public.sites
WHERE name = 'Clove Guesthouse'
ON CONFLICT (id) DO NOTHING;

INSERT INTO construction.sites (id, name, location, created_at, password_hash)
SELECT id, name, location, created_at, password_hash FROM public.sites
WHERE name NOT IN ('Clove Cafe & Bistro', 'Clove Guesthouse')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 5. Copy employees into the matching schema, by their site's business
--    (employees with a NULL site_id go to construction)
-- ---------------------------------------------------------------------
INSERT INTO clove_cafe.employees
SELECT e.* FROM public.employees e
JOIN public.sites s ON s.id = e.site_id
WHERE s.name = 'Clove Cafe & Bistro'
ON CONFLICT (id) DO NOTHING;

INSERT INTO clove_guesthouse.employees
SELECT e.* FROM public.employees e
JOIN public.sites s ON s.id = e.site_id
WHERE s.name = 'Clove Guesthouse'
ON CONFLICT (id) DO NOTHING;

INSERT INTO construction.employees
SELECT e.* FROM public.employees e
LEFT JOIN public.sites s ON s.id = e.site_id
WHERE e.site_id IS NULL OR s.name NOT IN ('Clove Cafe & Bistro', 'Clove Guesthouse')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 6. Copy site_team rows (join table) into the matching schema
-- ---------------------------------------------------------------------
INSERT INTO clove_cafe.site_team
SELECT st.* FROM public.site_team st
JOIN public.sites s ON s.id = st.site_id
WHERE s.name = 'Clove Cafe & Bistro'
ON CONFLICT (id) DO NOTHING;

INSERT INTO clove_guesthouse.site_team
SELECT st.* FROM public.site_team st
JOIN public.sites s ON s.id = st.site_id
WHERE s.name = 'Clove Guesthouse'
ON CONFLICT (id) DO NOTHING;

INSERT INTO construction.site_team
SELECT st.* FROM public.site_team st
JOIN public.sites s ON s.id = st.site_id
WHERE s.name NOT IN ('Clove Cafe & Bistro', 'Clove Guesthouse')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 7. Copy salary_transactions, by the employee's business
-- ---------------------------------------------------------------------
INSERT INTO clove_cafe.salary_transactions
SELECT st.* FROM public.salary_transactions st
WHERE st.employee_id IN (SELECT id FROM clove_cafe.employees)
ON CONFLICT (id) DO NOTHING;

INSERT INTO clove_guesthouse.salary_transactions
SELECT st.* FROM public.salary_transactions st
WHERE st.employee_id IN (SELECT id FROM clove_guesthouse.employees)
ON CONFLICT (id) DO NOTHING;

INSERT INTO construction.salary_transactions
SELECT st.* FROM public.salary_transactions st
WHERE st.employee_id IN (SELECT id FROM construction.employees)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 8. Copy attendance, by the employee's business
-- ---------------------------------------------------------------------
INSERT INTO clove_cafe.attendance
SELECT a.* FROM public.attendance a
WHERE a.employee_id IN (SELECT id FROM clove_cafe.employees)
ON CONFLICT (id) DO NOTHING;

INSERT INTO clove_guesthouse.attendance
SELECT a.* FROM public.attendance a
WHERE a.employee_id IN (SELECT id FROM clove_guesthouse.employees)
ON CONFLICT (id) DO NOTHING;

INSERT INTO construction.attendance
SELECT a.* FROM public.attendance a
WHERE a.employee_id IN (SELECT id FROM construction.employees)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 9. Copy attendance_save_history, by site's business
-- ---------------------------------------------------------------------
INSERT INTO clove_cafe.attendance_save_history
SELECT h.* FROM public.attendance_save_history h
JOIN public.sites s ON s.id = h.site_id
WHERE s.name = 'Clove Cafe & Bistro'
ON CONFLICT (id) DO NOTHING;

INSERT INTO clove_guesthouse.attendance_save_history
SELECT h.* FROM public.attendance_save_history h
JOIN public.sites s ON s.id = h.site_id
WHERE s.name = 'Clove Guesthouse'
ON CONFLICT (id) DO NOTHING;

INSERT INTO construction.attendance_save_history
SELECT h.* FROM public.attendance_save_history h
LEFT JOIN public.sites s ON s.id = h.site_id
WHERE h.site_id IS NULL OR s.name NOT IN ('Clove Cafe & Bistro', 'Clove Guesthouse')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 10. Reset sequences in every schema so future inserts don't collide
--     with the migrated IDs
-- ---------------------------------------------------------------------
DO $$
DECLARE
  target_schema TEXT;
BEGIN
  FOREACH target_schema IN ARRAY ARRAY['construction', 'clove_cafe', 'clove_guesthouse']
  LOOP
    EXECUTE format(
      'SELECT setval(pg_get_serial_sequence(''%I.sites'', ''id''), COALESCE((SELECT MAX(id) FROM %I.sites), 1))',
      target_schema, target_schema
    );
    EXECUTE format(
      'SELECT setval(pg_get_serial_sequence(''%I.employees'', ''id''), COALESCE((SELECT MAX(id) FROM %I.employees), 1))',
      target_schema, target_schema
    );
    EXECUTE format(
      'SELECT setval(pg_get_serial_sequence(''%I.site_team'', ''id''), COALESCE((SELECT MAX(id) FROM %I.site_team), 1))',
      target_schema, target_schema
    );
    EXECUTE format(
      'SELECT setval(pg_get_serial_sequence(''%I.salary_transactions'', ''id''), COALESCE((SELECT MAX(id) FROM %I.salary_transactions), 1))',
      target_schema, target_schema
    );
    EXECUTE format(
      'SELECT setval(pg_get_serial_sequence(''%I.attendance'', ''id''), COALESCE((SELECT MAX(id) FROM %I.attendance), 1))',
      target_schema, target_schema
    );
    EXECUTE format(
      'SELECT setval(pg_get_serial_sequence(''%I.attendance_save_history'', ''id''), COALESCE((SELECT MAX(id) FROM %I.attendance_save_history), 1))',
      target_schema, target_schema
    );
  END LOOP;
END $$;

COMMIT;

-- ---------------------------------------------------------------------
-- Verification query — run after the migration to sanity-check row counts.
-- Compare against the pre-migration counts from public.* filtered by site.
-- ---------------------------------------------------------------------
-- SELECT 'construction' AS business, 'sites' AS table_name, count(*) FROM construction.sites
-- UNION ALL SELECT 'construction', 'employees', count(*) FROM construction.employees
-- UNION ALL SELECT 'construction', 'salary_transactions', count(*) FROM construction.salary_transactions
-- UNION ALL SELECT 'construction', 'attendance', count(*) FROM construction.attendance
-- UNION ALL SELECT 'clove_cafe', 'sites', count(*) FROM clove_cafe.sites
-- UNION ALL SELECT 'clove_cafe', 'employees', count(*) FROM clove_cafe.employees
-- UNION ALL SELECT 'clove_cafe', 'salary_transactions', count(*) FROM clove_cafe.salary_transactions
-- UNION ALL SELECT 'clove_cafe', 'attendance', count(*) FROM clove_cafe.attendance
-- UNION ALL SELECT 'clove_guesthouse', 'sites', count(*) FROM clove_guesthouse.sites
-- UNION ALL SELECT 'clove_guesthouse', 'employees', count(*) FROM clove_guesthouse.employees
-- UNION ALL SELECT 'clove_guesthouse', 'salary_transactions', count(*) FROM clove_guesthouse.salary_transactions
-- UNION ALL SELECT 'clove_guesthouse', 'attendance', count(*) FROM clove_guesthouse.attendance
-- ORDER BY 1, 2;
