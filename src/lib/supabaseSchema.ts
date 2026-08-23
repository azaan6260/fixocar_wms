/**
 * Supabase SQL Schema Generator & Exporter
 * User can execute this SQL in Supabase SQL Editor to set up tables & RLS policies
 */

export const SUPABASE_SQL_SCHEMA = `-- AutoCraft / FixoCar Workshop Management System - Complete Production SQL Schema
-- Run this script in the Supabase / PostgreSQL SQL Editor (https://app.supabase.com/project/_/sql)

-- ==========================================
-- 1. EXTENSIONS & ENUM TYPES
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
      'MECHANICAL', 'DENTING', 'PAINT', 'SUBLET_VENDOR', 'WASHING', 'INSPECTION', 'PARTS', 'ACCESSORIES'
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
-- 2. MASTER LOCATION TABLES (CITIES & WORKSHOPS)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.cities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.workshops (
  id TEXT PRIMARY KEY,
  city_id TEXT NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  city_name TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  address TEXT NOT NULL,
  gstin TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 3. EMPLOYEES & VENDORS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.employees (
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
  base_salary NUMERIC(12,2) DEFAULT 0,
  employment_type TEXT DEFAULT 'PAYROLL',
  city_id TEXT,
  city_name TEXT,
  workshop_id TEXT,
  workshop_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.vendors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category vendor_category NOT NULL DEFAULT 'PARTS_SUPPLIER',
  contact_person TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  outstanding_balance NUMERIC(12,2) DEFAULT 0,
  rating NUMERIC(2,1) DEFAULT 5.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 4. STANDARD JOBS, CAR MODELS & INVENTORY
-- ==========================================
CREATE TABLE IF NOT EXISTS public.standard_jobs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  hsn_sac_code TEXT DEFAULT '998729',
  default_price NUMERIC(10,2) DEFAULT 0,
  retail_price NUMERIC(10,2) DEFAULT 0,
  cars24_price NUMERIC(10,2) DEFAULT 0,
  estimated_hours NUMERIC(4,1) DEFAULT 1.0,
  gst_rate NUMERIC(5,2) DEFAULT 18.0,
  is_contract_basis BOOLEAN DEFAULT FALSE,
  painter_payout NUMERIC(10,2) DEFAULT 0,
  denter_payout NUMERIC(10,2) DEFAULT 0,
  contractor_payout NUMERIC(10,2) DEFAULT 0,
  description TEXT,
  requires_customer_approval BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.car_models (
  id TEXT PRIMARY KEY,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  category TEXT NOT NULL,
  fuel_types JSONB DEFAULT '["Petrol"]'::jsonb,
  variants JSONB DEFAULT '[]'::jsonb,
  engine_oil_spec TEXT,
  coolant_spec TEXT,
  recommended_psi TEXT,
  notes TEXT,
  is_popular BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  part_number TEXT,
  category TEXT NOT NULL,
  stock_quantity INT DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'Pcs',
  min_stock_alert INT DEFAULT 5,
  unit_cost NUMERIC(10,2) DEFAULT 0,
  selling_price NUMERIC(10,2) DEFAULT 0,
  supplier_vendor_id TEXT REFERENCES public.vendors(id) ON DELETE SET NULL,
  supplier_vendor_name TEXT,
  shelf_location TEXT,
  workshop_id TEXT,
  workshop_name TEXT,
  last_restocked_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 5. JOB CARDS & AUDIT HISTORY
-- ==========================================
CREATE TABLE IF NOT EXISTS public.job_cards (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  estimated_completion_date TIMESTAMPTZ,
  
  -- Vehicle Details
  registration_number TEXT NOT NULL,
  vehicle_make TEXT NOT NULL,
  vehicle_model TEXT NOT NULL,
  vehicle_variant TEXT,
  vehicle_year INT,
  vehicle_color TEXT,
  vehicle_vin TEXT,
  fuel_type TEXT DEFAULT 'Petrol',
  fuel_level INT DEFAULT 50,
  mileage INT DEFAULT 0,
  engine_oil_spec TEXT,
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
  floor_manager_id TEXT REFERENCES public.employees(id) ON DELETE SET NULL,
  floor_manager_name TEXT,

  -- Financials & Invoicing
  discount NUMERIC(10,2) DEFAULT 0,
  tax_rate NUMERIC(5,2) DEFAULT 18.0,
  advance_paid NUMERIC(10,2) DEFAULT 0,
  invoice_number TEXT,
  invoice_date DATE,
  workshop_gstin TEXT,
  customer_gstin TEXT,
  custom_item_tax_rates JSONB DEFAULT '{}'::jsonb,

  -- Flags & Checklists
  qc_passed BOOLEAN DEFAULT FALSE,
  qc_notes TEXT,
  qc_passed_at TIMESTAMPTZ,
  pickup_requested BOOLEAN DEFAULT FALSE,
  delivery_requested BOOLEAN DEFAULT FALSE,
  delivery_record_id TEXT,
  notes TEXT,
  is_urgent BOOLEAN DEFAULT FALSE,
  is_cars24 BOOLEAN DEFAULT FALSE,
  cars24_ref_no TEXT,
  city_id TEXT,
  city_name TEXT,
  workshop_id TEXT,
  workshop_name TEXT,
  qc_checklist JSONB DEFAULT '[]'::jsonb,
  comments JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.job_card_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_id TEXT NOT NULL REFERENCES public.job_cards(id) ON DELETE CASCADE,
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
-- 6. JOB TASKS & REQUISITIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.job_tasks (
  id TEXT PRIMARY KEY,
  job_card_id TEXT NOT NULL REFERENCES public.job_cards(id) ON DELETE CASCADE,
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  standard_job_id TEXT,
  is_contract_basis BOOLEAN DEFAULT FALSE,
  contractor_payout NUMERIC(10,2) DEFAULT 0,
  painter_payout NUMERIC(10,2) DEFAULT 0,
  denter_payout NUMERIC(10,2) DEFAULT 0,
  paired_denter_id TEXT REFERENCES public.employees(id) ON DELETE SET NULL,
  paired_denter_name TEXT,
  is_additional_work BOOLEAN DEFAULT FALSE,
  additional_work_requested_by TEXT,
  additional_work_requested_at TIMESTAMPTZ,
  approval_status TEXT,
  parts_list JSONB DEFAULT '[]'::jsonb,
  requisitions JSONB DEFAULT '[]'::jsonb,
  concerns JSONB DEFAULT '[]'::jsonb
);

-- ==========================================
-- 7. LOGISTICS, PURCHASING & GATE CHECK-INS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.delivery_records (
  id TEXT PRIMARY KEY,
  job_card_id TEXT NOT NULL REFERENCES public.job_cards(id) ON DELETE CASCADE,
  vehicle_reg TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  delivery_boy_id TEXT REFERENCES public.employees(id) ON DELETE SET NULL,
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

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id TEXT PRIMARY KEY,
  job_card_id TEXT NOT NULL REFERENCES public.job_cards(id) ON DELETE CASCADE,
  vehicle_reg TEXT NOT NULL,
  vendor_id TEXT NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  vendor_name TEXT NOT NULL,
  category TEXT NOT NULL,
  item_description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'ISSUED',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.vehicle_check_ins (
  id TEXT PRIMARY KEY DEFAULT ('GATE-' || floor(EXTRACT(epoch FROM NOW()))::text),
  registration_number TEXT NOT NULL,
  check_in_time TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'CHECKED_IN' CHECK (status IN ('CHECKED_IN', 'PDI_IN_PROGRESS', 'IDLE_AWAITING_PI', 'AWAITING_JOB_CARD', 'JOB_CARD_CREATED', 'INVOICED', 'READY_PENDING_DISPATCH', 'DELIVERED', 'CHECKED_OUT')),
  driver_photo_url TEXT,
  workshop_id TEXT,
  make TEXT,
  model TEXT,
  variant TEXT,
  fuel_type TEXT DEFAULT 'Petrol',
  year INT,
  color TEXT,
  fuel_level INT,
  mileage INT,
  is_cars24 BOOLEAN DEFAULT false,
  cars24_ref_no TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  check_in_driver_name TEXT,
  check_in_driver_phone TEXT,
  check_in_notes TEXT,
  job_card_id TEXT REFERENCES public.job_cards(id) ON DELETE SET NULL,
  check_out_time TIMESTAMPTZ,
  check_out_driver_name TEXT,
  check_out_driver_phone TEXT,
  check_out_driver_photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 8. EXPENSES, PAYROLL & ATTENDANCE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.workshop_expenses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  workshop_id TEXT REFERENCES public.workshops(id) ON DELETE SET NULL,
  workshop_name TEXT,
  payment_mode TEXT NOT NULL DEFAULT 'UPI',
  paid_by_name TEXT NOT NULL,
  vendor_name TEXT,
  receipt_number TEXT,
  notes TEXT,
  is_approved BOOLEAN DEFAULT true,
  approved_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  clock_in_time TEXT,
  clock_out_time TEXT,
  status TEXT NOT NULL DEFAULT 'PRESENT',
  clock_in_location TEXT,
  clock_out_location TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.salary_records (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  base_salary NUMERIC(12,2) DEFAULT 0,
  deductions NUMERIC(12,2) DEFAULT 0,
  bonuses NUMERIC(12,2) DEFAULT 0,
  net_pay NUMERIC(12,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING',
  transfer_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 9. PERFORMANCE INDEXES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_job_cards_reg_num ON public.job_cards(registration_number);
CREATE INDEX IF NOT EXISTS idx_job_cards_status ON public.job_cards(status);
CREATE INDEX IF NOT EXISTS idx_job_cards_customer_phone ON public.job_cards(customer_phone);
CREATE INDEX IF NOT EXISTS idx_job_card_history_card_id ON public.job_card_history(job_card_id);
CREATE INDEX IF NOT EXISTS idx_job_tasks_job_card_id ON public.job_tasks(job_card_id);
CREATE INDEX IF NOT EXISTS idx_job_tasks_assigned ON public.job_tasks(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_delivery_records_job_card ON public.delivery_records(job_card_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_job_card ON public.purchase_orders(job_card_id);
CREATE INDEX IF NOT EXISTS idx_employees_role ON public.employees(role);
CREATE INDEX IF NOT EXISTS idx_vehicle_checkins_reg ON public.vehicle_check_ins(registration_number);
CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON public.attendance_records(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_expenses_workshop ON public.workshop_expenses(workshop_id, date);

-- ==========================================
-- 10. AUTOMATED AUDIT TRIGGER
-- ==========================================
CREATE OR REPLACE FUNCTION log_job_card_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.job_card_history (job_card_id, new_status, action_type, notes)
    VALUES (NEW.id, NEW.status, 'CARD_CREATED', 'Job card created in system');
  ELSIF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.job_card_history (job_card_id, previous_status, new_status, action_type, notes)
    VALUES (NEW.id, OLD.status, NEW.status, 'STATUS_CHANGE', CONCAT('Status changed from ', OLD.status, ' to ', NEW.status));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_card_status_history ON public.job_cards;
CREATE TRIGGER trg_job_card_status_history
  AFTER INSERT OR UPDATE ON public.job_cards
  FOR EACH ROW
  EXECUTE FUNCTION log_job_card_status_change();

-- ==========================================
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standard_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_card_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshop_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public full access on cities" ON public.cities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on workshops" ON public.workshops FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on employees" ON public.employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on vendors" ON public.vendors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on standard_jobs" ON public.standard_jobs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on car_models" ON public.car_models FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on inventory_items" ON public.inventory_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on job_cards" ON public.job_cards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on job_card_history" ON public.job_card_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on job_tasks" ON public.job_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on delivery_records" ON public.delivery_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on purchase_orders" ON public.purchase_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on vehicle_check_ins" ON public.vehicle_check_ins FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on workshop_expenses" ON public.workshop_expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on attendance_records" ON public.attendance_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on salary_records" ON public.salary_records FOR ALL USING (true) WITH CHECK (true);
`;


