-- AutoCraft / FixoCar Workshop Management System - Complete Executable SQL Schema
-- Run this script in the Supabase SQL Editor (https://app.supabase.com/project/_/sql)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. ENUM TYPES
-- ==========================================
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
      'SUPER_ADMIN', 'ADMIN', 'FLOOR_MANAGER', 'SERVICE_ADVISOR', 'MECHANIC', 
      'PAINTER', 'DENTER', 'DELIVERY_BOY', 'AC_SPECIALIST', 'ELECTRICIAN', 'TIRE_SPECIALIST',
      'VENDOR', 'CUSTOMER'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE vendor_category AS ENUM (
      'PARTS_SUPPLIER', 'LUBRICANT_SUPPLIER', 'OUTSOURCE_WORKSHOP', 'GENERAL'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE job_card_status AS ENUM (
      'CREATED', 'PDI_IN_PROGRESS', 'AWAITING_CUSTOMER_APPROVAL', 'APPROVAL_PENDING', 
      'IN_PROGRESS', 'WORK_COMPLETED', 'QUALITY_CHECK_PENDING', 'QUALITY_CHECK_PASSED', 
      'READY_FOR_DELIVERY', 'INVOICED', 'DELIVERED', 'CANCELLED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE task_status AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE task_category AS ENUM (
      'MECHANICAL', 'DENTING', 'PAINT', 'SUBLET_VENDOR', 'WASHING', 'INSPECTION', 'PARTS', 'ACCESSORIES'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE delivery_status AS ENUM (
      'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ==========================================
-- 2. MASTER LOCATION TABLES (CITIES & WORKSHOPS)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.cities (
  id text NOT NULL,
  name text NOT NULL,
  state text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT cities_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.workshops (
  id text NOT NULL,
  city_id text NOT NULL,
  city_name text NOT NULL,
  name text NOT NULL,
  code text NOT NULL DEFAULT 'WS',
  address text NOT NULL,
  gstin text,
  phone text,
  is_cars24_partner boolean DEFAULT false,
  manager_name text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT workshops_pkey PRIMARY KEY (id),
  CONSTRAINT workshops_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.cities(id) ON DELETE CASCADE
);

-- Migrations for existing workshops table
ALTER TABLE public.workshops ADD COLUMN IF NOT EXISTS is_cars24_partner boolean DEFAULT false;
ALTER TABLE public.workshops ADD COLUMN IF NOT EXISTS manager_name text;
ALTER TABLE public.workshops ADD COLUMN IF NOT EXISTS code text DEFAULT 'WS';

-- ==========================================
-- 3. EMPLOYEES & VENDORS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.employees (
  id text NOT NULL,
  name text NOT NULL,
  role user_role NOT NULL DEFAULT 'MECHANIC'::user_role,
  phone text NOT NULL,
  email text UNIQUE,
  specialized_team text NOT NULL,
  status text NOT NULL DEFAULT 'AVAILABLE'::text,
  active_jobs_count integer DEFAULT 0,
  avatar_url text,
  login_id text,
  password_hash text,
  base_salary numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  employment_type text DEFAULT 'PAYROLL'::text,
  city_id text,
  city_name text,
  workshop_id text,
  workshop_name text,
  CONSTRAINT employees_pkey PRIMARY KEY (id),
  CONSTRAINT fk_employees_city FOREIGN KEY (city_id) REFERENCES public.cities(id) ON DELETE SET NULL,
  CONSTRAINT fk_employees_workshop FOREIGN KEY (workshop_id) REFERENCES public.workshops(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.vendors (
  id text NOT NULL,
  name text NOT NULL,
  category vendor_category NOT NULL DEFAULT 'PARTS_SUPPLIER'::vendor_category,
  contact_person text NOT NULL,
  phone text NOT NULL,
  email text,
  address text,
  outstanding_balance numeric DEFAULT 0,
  rating numeric DEFAULT 5.0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT vendors_pkey PRIMARY KEY (id)
);

-- ==========================================
-- 4. MASTER DATA (STANDARD JOBS & CAR MODELS)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.standard_jobs (
  id text NOT NULL,
  title text NOT NULL,
  category text NOT NULL,
  hsn_sac_code text DEFAULT '998729'::text,
  default_price numeric DEFAULT 0,
  estimated_hours numeric DEFAULT 1.0,
  gst_rate numeric DEFAULT 18.0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  retail_price numeric DEFAULT 0,
  cars24_price numeric DEFAULT 0,
  is_contract_basis boolean DEFAULT false,
  painter_payout numeric DEFAULT 0,
  denter_payout numeric DEFAULT 0,
  contractor_payout numeric DEFAULT 0,
  description text,
  requires_customer_approval boolean DEFAULT false,
  CONSTRAINT standard_jobs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.car_models (
  id text NOT NULL,
  make text NOT NULL,
  model text NOT NULL,
  category text NOT NULL,
  fuel_types jsonb DEFAULT '["Petrol"]'::jsonb,
  variants jsonb DEFAULT '[]'::jsonb,
  engine_oil_spec text,
  coolant_spec text,
  recommended_psi text,
  notes text,
  is_popular boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT car_models_pkey PRIMARY KEY (id)
);

-- ==========================================
-- 5. INVENTORY & WORKSHOP EXPENSES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id text NOT NULL,
  name text NOT NULL,
  part_number text,
  category text NOT NULL,
  stock_quantity integer DEFAULT 0,
  unit text NOT NULL DEFAULT 'Pcs'::text,
  min_stock_alert integer DEFAULT 5,
  unit_cost numeric DEFAULT 0,
  selling_price numeric DEFAULT 0,
  supplier_vendor_id text,
  supplier_vendor_name text,
  shelf_location text,
  workshop_id text,
  workshop_name text,
  last_restocked_at timestamp with time zone DEFAULT now(),
  CONSTRAINT inventory_items_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_items_supplier_vendor_id_fkey FOREIGN KEY (supplier_vendor_id) REFERENCES public.vendors(id) ON DELETE SET NULL,
  CONSTRAINT fk_inventory_workshop FOREIGN KEY (workshop_id) REFERENCES public.workshops(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.workshop_expenses (
  id text NOT NULL,
  title text NOT NULL,
  category text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0::numeric),
  date date NOT NULL DEFAULT CURRENT_DATE,
  workshop_id text,
  workshop_name text,
  payment_mode text NOT NULL DEFAULT 'UPI'::text,
  paid_by_name text NOT NULL,
  vendor_name text,
  receipt_number text,
  notes text,
  is_approved boolean DEFAULT true,
  approved_by_name text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT workshop_expenses_pkey PRIMARY KEY (id),
  CONSTRAINT workshop_expenses_workshop_id_fkey FOREIGN KEY (workshop_id) REFERENCES public.workshops(id) ON DELETE SET NULL
);

-- ==========================================
-- 6. JOB CARDS & AUDIT HISTORY
-- ==========================================
CREATE TABLE IF NOT EXISTS public.job_cards (
  id text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  estimated_completion_date timestamp with time zone,
  registration_number text NOT NULL,
  vehicle_make text NOT NULL,
  vehicle_model text NOT NULL,
  vehicle_year integer,
  vehicle_color text,
  vehicle_vin text,
  fuel_level integer DEFAULT 50,
  mileage integer DEFAULT 0,
  vehicle_photo_url text,
  customer_id text,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text,
  customer_address text,
  status job_card_status NOT NULL DEFAULT 'CREATED'::job_card_status,
  service_type text NOT NULL DEFAULT 'CUSTOM_REPAIR'::text,
  package_name text,
  floor_manager_id text,
  floor_manager_name text,
  discount numeric DEFAULT 0,
  tax_rate numeric DEFAULT 18.0,
  advance_paid numeric DEFAULT 0,
  qc_passed boolean DEFAULT false,
  qc_notes text,
  qc_passed_at timestamp with time zone,
  pickup_requested boolean DEFAULT false,
  delivery_requested boolean DEFAULT false,
  delivery_record_id text,
  notes text,
  is_urgent boolean DEFAULT false,
  is_cars24 boolean DEFAULT false,
  cars24_ref_no text,
  city_id text,
  city_name text,
  workshop_id text,
  workshop_name text,
  qc_checklist jsonb DEFAULT '[]'::jsonb,
  comments jsonb DEFAULT '[]'::jsonb,
  invoice_number text,
  invoice_date date,
  workshop_gstin text,
  customer_gstin text,
  custom_item_tax_rates jsonb DEFAULT '{}'::jsonb,
  vehicle_variant text,
  fuel_type text DEFAULT 'Petrol'::text,
  engine_oil_spec text,
  CONSTRAINT job_cards_pkey PRIMARY KEY (id),
  CONSTRAINT job_cards_floor_manager_id_fkey FOREIGN KEY (floor_manager_id) REFERENCES public.employees(id) ON DELETE SET NULL,
  CONSTRAINT fk_job_cards_city FOREIGN KEY (city_id) REFERENCES public.cities(id) ON DELETE SET NULL,
  CONSTRAINT fk_job_cards_workshop FOREIGN KEY (workshop_id) REFERENCES public.workshops(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.job_card_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_card_id text NOT NULL,
  previous_status job_card_status,
  new_status job_card_status NOT NULL,
  action_type text NOT NULL DEFAULT 'STATUS_CHANGE'::text,
  changed_by_id text,
  changed_by_name text DEFAULT 'System'::text,
  changed_by_role user_role,
  notes text,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT job_card_history_pkey PRIMARY KEY (id),
  CONSTRAINT job_card_history_job_card_id_fkey FOREIGN KEY (job_card_id) REFERENCES public.job_cards(id) ON DELETE CASCADE
);

-- ==========================================
-- 7. JOB TASKS & REQUISITIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.job_tasks (
  id text NOT NULL,
  job_card_id text NOT NULL,
  title text NOT NULL,
  category task_category NOT NULL DEFAULT 'MECHANICAL'::task_category,
  assigned_to_id text,
  assigned_to_name text,
  assigned_type text NOT NULL DEFAULT 'EMPLOYEE'::text,
  estimated_cost numeric DEFAULT 0,
  customer_price numeric DEFAULT 0,
  status task_status DEFAULT 'PENDING'::task_status,
  requires_customer_approval boolean DEFAULT false,
  is_customer_approved boolean,
  rejection_reason text,
  notes text,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  standard_job_id text,
  is_contract_basis boolean DEFAULT false,
  contractor_payout numeric DEFAULT 0,
  painter_payout numeric DEFAULT 0,
  denter_payout numeric DEFAULT 0,
  paired_denter_id text,
  paired_denter_name text,
  is_additional_work boolean DEFAULT false,
  additional_work_requested_by text,
  additional_work_requested_at timestamp with time zone,
  approval_status text,
  parts_list jsonb DEFAULT '[]'::jsonb,
  requisitions jsonb DEFAULT '[]'::jsonb,
  concerns jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT job_tasks_pkey PRIMARY KEY (id),
  CONSTRAINT job_tasks_job_card_id_fkey FOREIGN KEY (job_card_id) REFERENCES public.job_cards(id) ON DELETE CASCADE,
  CONSTRAINT job_tasks_paired_denter_id_fkey FOREIGN KEY (paired_denter_id) REFERENCES public.employees(id) ON DELETE SET NULL
);

-- ==========================================
-- 8. LOGISTICS, PURCHASING & VEHICLE CHECK-INS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.delivery_records (
  id text NOT NULL,
  job_card_id text NOT NULL,
  vehicle_reg text NOT NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  delivery_boy_id text,
  delivery_boy_name text,
  delivery_boy_phone text,
  type text NOT NULL DEFAULT 'DELIVERY'::text,
  pickup_address text,
  delivery_address text,
  status delivery_status DEFAULT 'ASSIGNED'::delivery_status,
  total_amount_due numeric DEFAULT 0,
  payment_status text DEFAULT 'PENDING'::text,
  payment_method text,
  collected_at timestamp with time zone,
  current_lat numeric,
  current_lng numeric,
  destination_lat numeric,
  destination_lng numeric,
  eta_minutes integer DEFAULT 20,
  notes text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT delivery_records_pkey PRIMARY KEY (id),
  CONSTRAINT delivery_records_job_card_id_fkey FOREIGN KEY (job_card_id) REFERENCES public.job_cards(id) ON DELETE CASCADE,
  CONSTRAINT delivery_records_delivery_boy_id_fkey FOREIGN KEY (delivery_boy_id) REFERENCES public.employees(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id text NOT NULL,
  job_card_id text NOT NULL,
  vehicle_reg text NOT NULL,
  vendor_id text NOT NULL,
  vendor_name text NOT NULL,
  category text NOT NULL,
  item_description text NOT NULL,
  amount numeric NOT NULL,
  status text DEFAULT 'ISSUED'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT purchase_orders_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_orders_job_card_id_fkey FOREIGN KEY (job_card_id) REFERENCES public.job_cards(id) ON DELETE CASCADE,
  CONSTRAINT purchase_orders_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.vehicle_check_ins (
  id text NOT NULL DEFAULT ('GATE-'::text || (floor(EXTRACT(epoch FROM now())))::text),
  registration_number text NOT NULL,
  check_in_time timestamp with time zone DEFAULT now(),
  status text NOT NULL DEFAULT 'CHECKED_IN'::text CHECK (status = ANY (ARRAY['CHECKED_IN'::text, 'PDI_IN_PROGRESS'::text, 'IDLE_AWAITING_PI'::text, 'AWAITING_JOB_CARD'::text, 'JOB_CARD_CREATED'::text, 'INVOICED'::text, 'READY_PENDING_DISPATCH'::text, 'DELIVERED'::text, 'CHECKED_OUT'::text])),
  driver_photo_url text,
  workshop_id text,
  make text,
  model text,
  color text,
  fuel_level integer,
  mileage integer,
  is_cars24 boolean DEFAULT false,
  cars24_ref_no text,
  customer_name text,
  customer_phone text,
  check_in_driver_name text,
  check_in_driver_phone text,
  check_in_notes text,
  job_card_id text,
  check_out_time timestamp with time zone,
  check_out_driver_name text,
  check_out_driver_phone text,
  check_out_driver_photo_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  variant text,
  fuel_type text DEFAULT 'Petrol'::text,
  year integer,
  CONSTRAINT vehicle_check_ins_pkey PRIMARY KEY (id),
  CONSTRAINT vehicle_check_ins_job_card_id_fkey FOREIGN KEY (job_card_id) REFERENCES public.job_cards(id) ON DELETE SET NULL,
  CONSTRAINT fk_checkins_workshop FOREIGN KEY (workshop_id) REFERENCES public.workshops(id) ON DELETE SET NULL
);

-- ==========================================
-- 9. ATTENDANCE & PAYROLL
-- ==========================================
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id text NOT NULL,
  employee_id text NOT NULL,
  date date NOT NULL,
  clock_in_time text,
  clock_out_time text,
  status text NOT NULL DEFAULT 'PRESENT'::text,
  clock_in_location text,
  clock_out_location text,
  photo_url text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT attendance_records_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.salary_records (
  id text NOT NULL,
  employee_id text NOT NULL,
  month text NOT NULL,
  base_salary numeric DEFAULT 0,
  deductions numeric DEFAULT 0,
  bonuses numeric DEFAULT 0,
  net_pay numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'PENDING'::text,
  transfer_date timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT salary_records_pkey PRIMARY KEY (id),
  CONSTRAINT salary_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE
);

-- ==========================================
-- 10. ENABLE ROW LEVEL SECURITY & POLICIES
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

DO $$ BEGIN
  DROP POLICY IF EXISTS "Public full access on cities" ON public.cities;
  DROP POLICY IF EXISTS "Public full access on workshops" ON public.workshops;
  DROP POLICY IF EXISTS "Public full access on employees" ON public.employees;
  DROP POLICY IF EXISTS "Public full access on vendors" ON public.vendors;
  DROP POLICY IF EXISTS "Public full access on standard_jobs" ON public.standard_jobs;
  DROP POLICY IF EXISTS "Public full access on car_models" ON public.car_models;
  DROP POLICY IF EXISTS "Public full access on inventory_items" ON public.inventory_items;
  DROP POLICY IF EXISTS "Public full access on job_cards" ON public.job_cards;
  DROP POLICY IF EXISTS "Public full access on job_card_history" ON public.job_card_history;
  DROP POLICY IF EXISTS "Public full access on job_tasks" ON public.job_tasks;
  DROP POLICY IF EXISTS "Public full access on delivery_records" ON public.delivery_records;
  DROP POLICY IF EXISTS "Public full access on purchase_orders" ON public.purchase_orders;
  DROP POLICY IF EXISTS "Public full access on vehicle_check_ins" ON public.vehicle_check_ins;
  DROP POLICY IF EXISTS "Public full access on workshop_expenses" ON public.workshop_expenses;
  DROP POLICY IF EXISTS "Public full access on attendance_records" ON public.attendance_records;
  DROP POLICY IF EXISTS "Public full access on salary_records" ON public.salary_records;
END $$;

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
