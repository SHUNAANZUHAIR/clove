-- Create sites table
CREATE TABLE IF NOT EXISTS sites (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- Create employees table
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    salary NUMERIC(10,2) NOT NULL,
    id_number VARCHAR(50),
    birth_date DATE,
    join_date DATE,
    photo TEXT,
    medium VARCHAR(20) DEFAULT 'cash',
    employee_type VARCHAR(30) DEFAULT 'local',
    job_level VARCHAR(30) DEFAULT 'labour',
    site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE employees ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS join_date DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employee_type VARCHAR(30) DEFAULT 'local';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS job_level VARCHAR(30) DEFAULT 'labour';
UPDATE employees SET employee_type = 'local' WHERE employee_type IS NULL;
UPDATE employees SET job_level = 'labour' WHERE job_level IS NULL;

-- Employment agreement fields for Clove Cafe & Bistro onboarding
ALTER TABLE employees ADD COLUMN IF NOT EXISTS work_permit_number TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS nationality TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS current_address TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS job_description TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employment_status TEXT NOT NULL DEFAULT 'indefinite';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS fixed_term_end DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS probation_applicable BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS probation_months INTEGER;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS hours_per_day NUMERIC(5,2);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS hours_per_week NUMERIC(5,2);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS allowances_benefits TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS accommodation_provided BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS meals_provided BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS transport_provided BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS return_airfare_provided BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS benefit_details TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS notice_period TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employer_signatory TEXT;


-- Create site_team table
CREATE TABLE IF NOT EXISTS site_team (
    id SERIAL PRIMARY KEY,
    site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(site_id, employee_id)
);


-- Create salary_transactions table
CREATE TABLE IF NOT EXISTS salary_transactions (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL,
    worked_days INTEGER DEFAULT 0,
    daily_rate NUMERIC(10,2) DEFAULT 0,
    absent_days INTEGER DEFAULT 0,
    absent_deduction NUMERIC(10,2) DEFAULT 0,
    cash_advance NUMERIC(10,2) DEFAULT 0,
    net_salary NUMERIC(10,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, month, year)
);


-- Create daily employee attendance table
CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'present',
    in_time TIME,
    out_time TIME,
    ot_in_time TIME,
    ot_out_time TIME,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, attendance_date)
);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS in_time TIME;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS out_time TIME;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS ot_in_time TIME;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS ot_out_time TIME;


-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_salary_employee ON salary_transactions(employee_id);
CREATE INDEX IF NOT EXISTS idx_salary_month_year ON salary_transactions(month, year);
CREATE INDEX IF NOT EXISTS idx_employee_site ON employees(site_id);
CREATE INDEX IF NOT EXISTS idx_employee_type ON employees(employee_type);

CREATE TABLE IF NOT EXISTS employee_groups (
    value VARCHAR(30) PRIMARY KEY,
    label VARCHAR(80) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO employee_groups (value, label) VALUES
    ('local', 'Local Employee'),
    ('clove_expats', 'Clove Expats'),
    ('full_time_expats', 'Full Time Expats')
ON CONFLICT (value) DO NOTHING;
CREATE INDEX IF NOT EXISTS idx_employee_job_level ON employees(job_level);
CREATE INDEX IF NOT EXISTS idx_site_team_site ON site_team(site_id);
CREATE INDEX IF NOT EXISTS idx_site_team_employee ON site_team(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance(employee_id);


-- Insert sample data
INSERT INTO sites (id, name, location) VALUES 
(1, 'Marina Project', 'Male'' City'),
(2, 'Airport Expansion', 'Hulhule'),
(3, 'Housing Development', 'Hulhumale')
ON CONFLICT (id) DO NOTHING;


INSERT INTO employees (id, name, salary, id_number, medium, site_id) VALUES 
(1, 'Ahmed Shunaan', 5400, 'A123456', 'cash', 1),
(2, 'Mohamed Raaid', 5400, 'B789012', 'account transfer', 1),
(3, 'Ibrahim Nasir', 5400, 'C345678', 'cash', 2),
(4, 'Ali Zuhair', 5400, 'D901234', 'account transfer', 3)
ON CONFLICT (id) DO NOTHING;


INSERT INTO salary_transactions (employee_id, month, year, worked_days, daily_rate, absent_days, absent_deduction, cash_advance, net_salary, status) VALUES
(1, 7, 2026, 22, 245.45, 0, 0, 100, 5300, 'paid'),
(2, 7, 2026, 20, 281.82, 2, 563.64, 200, 4876.36, 'pending'),
(3, 7, 2026, 21, 218.18, 1, 218.18, 0, 4581.82, 'pending')
ON CONFLICT (employee_id, month, year) DO NOTHING;


SELECT setval('sites_id_seq', COALESCE((SELECT MAX(id) FROM sites), 1));
SELECT setval('employees_id_seq', COALESCE((SELECT MAX(id) FROM employees), 1));
SELECT setval('salary_transactions_id_seq', COALESCE((SELECT MAX(id) FROM salary_transactions), 1));
