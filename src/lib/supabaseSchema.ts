/**
 * Supabase SQL Schema Generator & Exporter
 * User can execute this SQL in Supabase SQL Editor to set up tables & RLS policies
 */

export const SUPABASE_SQL_SCHEMA = `-- AutoCraft / FixoCar Workshop Management System - Supabase SQL Schema
-- Run this script in the Supabase SQL Editor (https://app.supabase.com/project/_/sql)

-- ==========================================
-- 1. EXTENSIONS & ENUMS
-- ==========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
      'SUPER_ADMIN', 'ADMIN', 'FLOOR_MANAGER', 'MECHANIC', 
      'DENTER', 'PAINTER', 'DELIVERY_BOY', 'VENDOR', 'CUSTOMER'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE task_status AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE task_category AS ENUM (
      'MECHANICAL', 'DENTING', 'PAINT', 'SUBLET_VENDOR', 'WASHING', 'INSPECTION', 'PARTS'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE job_card_status AS ENUM (
      'CREATED', 'INSPECTION', 'JOB_ALLOCATED', 'IN_PROGRESS', 
      'ESTIMATE_PENDING', 'QC_PENDING', 'READY_FOR_DELIVERY', 
      'OUT_FOR_DELIVERY', 'DELIVERED', 'CLOSED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE delivery_status AS ENUM (
      'ASSIGNED', 'EN_ROUTE_PICKUP', 'VEHICLE_PICKED', 
      'AT_WORKSHOP', 'OUT_FOR_DELIVERY', 'ARRIVED_AT_DESTINATION', 'DELIVERED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE vendor_category AS ENUM (
      'PARTS_SUPPLIER', 'WASHING', 'LATHE_WORK', 'ELECTRICIAN', 'ALIGNMENT', 'OTHER'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ==========================================
-- 2. EMPLOYEES TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'MECHANIC',
  phone TEXT NOT NULL,
  email TEXT UNIQUE,
  specialized_team TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'AVAILABLE',
  active_jobs_count INT DEFAULT 0,
  avatar_url TEXT,
  login_id TEXT,
  password_hash TEXT,
  base_salary NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 3. VENDORS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category vendor_category NOT NULL DEFAULT 'PARTS_SUPPLIER',
  contact_person TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  outstanding_balance NUMERIC(10,2) DEFAULT 0,
  rating NUMERIC(2,1) DEFAULT 5.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 4. JOB CARDS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS job_cards (
  id TEXT PRIMARY KEY, -- e.g. "JC-2026-101"
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  estimated_completion_date TIMESTAMPTZ,
  
  -- Vehicle Details
  registration_number TEXT NOT NULL,
  vehicle_make TEXT NOT NULL,
  vehicle_model TEXT NOT NULL,
  vehicle_year INT,
  vehicle_color TEXT,
  vehicle_vin TEXT,
  fuel_level INT DEFAULT 50,
  mileage INT DEFAULT 0,
  vehicle_photo_url TEXT,

  -- Customer Details
  customer_id TEXT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  customer_address TEXT,

  -- Status & Operations
  status job_card_status NOT NULL DEFAULT 'CREATED',
  service_type TEXT NOT NULL DEFAULT 'CUSTOM_REPAIR',
  package_name TEXT,
  floor_manager_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
  floor_manager_name TEXT,

  -- Financials
  discount NUMERIC(10,2) DEFAULT 0,
  tax_rate NUMERIC(5,2) DEFAULT 18.0,
  advance_paid NUMERIC(10,2) DEFAULT 0,

  -- QC & Delivery Options
  qc_passed BOOLEAN DEFAULT FALSE,
  qc_notes TEXT,
  qc_passed_at TIMESTAMPTZ,
  pickup_requested BOOLEAN DEFAULT FALSE,
  delivery_requested BOOLEAN DEFAULT FALSE,
  delivery_record_id TEXT,
  notes TEXT
);

-- ==========================================
-- 5. JOB CARD HISTORY TABLE (AUDIT LOG)
-- ==========================================
CREATE TABLE IF NOT EXISTS job_card_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_id TEXT NOT NULL REFERENCES job_cards(id) ON DELETE CASCADE,
  previous_status job_card_status,
  new_status job_card_status NOT NULL,
  action_type TEXT NOT NULL DEFAULT 'STATUS_CHANGE',
  changed_by_id TEXT,
  changed_by_name TEXT DEFAULT 'System',
  changed_by_role user_role,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 6. JOB TASKS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS job_tasks (
  id TEXT PRIMARY KEY,
  job_card_id TEXT NOT NULL REFERENCES job_cards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category task_category NOT NULL,
  assigned_to_id TEXT,
  assigned_to_name TEXT,
  assigned_type TEXT NOT NULL DEFAULT 'EMPLOYEE',
  estimated_cost NUMERIC(10,2) DEFAULT 0,
  customer_price NUMERIC(10,2) DEFAULT 0,
  status task_status DEFAULT 'PENDING',
  requires_customer_approval BOOLEAN DEFAULT FALSE,
  is_customer_approved BOOLEAN DEFAULT NULL,
  rejection_reason TEXT,
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 7. DELIVERY RECORDS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS delivery_records (
  id TEXT PRIMARY KEY,
  job_card_id TEXT NOT NULL REFERENCES job_cards(id) ON DELETE CASCADE,
  vehicle_reg TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  delivery_boy_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
  delivery_boy_name TEXT,
  delivery_boy_phone TEXT,
  type TEXT NOT NULL DEFAULT 'DELIVERY',
  pickup_address TEXT,
  delivery_address TEXT,
  status delivery_status DEFAULT 'ASSIGNED',
  total_amount_due NUMERIC(10,2) DEFAULT 0,
  payment_status TEXT DEFAULT 'PENDING',
  payment_method TEXT,
  collected_at TIMESTAMPTZ,
  current_lat NUMERIC(9,6),
  current_lng NUMERIC(9,6),
  destination_lat NUMERIC(9,6),
  destination_lng NUMERIC(9,6),
  eta_minutes INT DEFAULT 20,
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 8. PURCHASE ORDERS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  job_card_id TEXT NOT NULL REFERENCES job_cards(id) ON DELETE CASCADE,
  vehicle_reg TEXT NOT NULL,
  vendor_id TEXT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  vendor_name TEXT NOT NULL,
  category TEXT NOT NULL,
  item_description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'ISSUED',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 9. INDEXES FOR HIGH PERFORMANCE
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_job_cards_reg_num ON job_cards(registration_number);
CREATE INDEX IF NOT EXISTS idx_job_cards_status ON job_cards(status);
CREATE INDEX IF NOT EXISTS idx_job_cards_customer_phone ON job_cards(customer_phone);
CREATE INDEX IF NOT EXISTS idx_job_card_history_card_id ON job_card_history(job_card_id);
CREATE INDEX IF NOT EXISTS idx_job_tasks_job_card_id ON job_tasks(job_card_id);
CREATE INDEX IF NOT EXISTS idx_job_tasks_assigned ON job_tasks(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_delivery_records_job_card ON delivery_records(job_card_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_job_card ON purchase_orders(job_card_id);
CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role);

-- ==========================================
-- 10. AUTOMATED TRIGGER FOR JOB CARD HISTORY
-- ==========================================
CREATE OR REPLACE FUNCTION log_job_card_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO job_card_history (job_card_id, new_status, action_type, notes)
    VALUES (NEW.id, NEW.status, 'CARD_CREATED', 'Job card created in system');
  ELSIF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO job_card_history (job_card_id, previous_status, new_status, action_type, notes)
    VALUES (NEW.id, OLD.status, NEW.status, 'STATUS_CHANGE', CONCAT('Status changed from ', OLD.status, ' to ', NEW.status));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_card_status_history ON job_cards;
CREATE TRIGGER trg_job_card_status_history
  AFTER INSERT OR UPDATE ON job_cards
  FOR EACH ROW
  EXECUTE FUNCTION log_job_card_status_change();

-- ==========================================
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_card_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

-- Permissive policies for workshop operations
CREATE POLICY "Public full access on employees" ON employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on vendors" ON vendors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on job_cards" ON job_cards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on job_card_history" ON job_card_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on job_tasks" ON job_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on delivery_records" ON delivery_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on purchase_orders" ON purchase_orders FOR ALL USING (true) WITH CHECK (true);
`;

