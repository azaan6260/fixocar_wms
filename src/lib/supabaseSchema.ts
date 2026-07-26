/**
 * Supabase SQL Schema Generator & Exporter
 * User can execute this SQL in Supabase SQL Editor to set up tables & RLS policies
 */

export const SUPABASE_SQL_SCHEMA = `-- AutoCraft Workshop Management Tool - Database Schema & Initial Data Seed

-- 1. Create Enums
CREATE TYPE user_role AS ENUM (
  'SUPER_ADMIN', 'ADMIN', 'FLOOR_MANAGER', 'MECHANIC', 
  'DENTER', 'PAINTER', 'DELIVERY_BOY', 'VENDOR', 'CUSTOMER'
);

CREATE TYPE task_status AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD');
CREATE TYPE task_category AS ENUM ('MECHANICAL', 'DENTING', 'PAINT', 'SUBLET_VENDOR', 'WASHING', 'INSPECTION', 'PARTS');
CREATE TYPE job_card_status AS ENUM (
  'CREATED', 'INSPECTION', 'JOB_ALLOCATED', 'IN_PROGRESS', 
  'ESTIMATE_PENDING', 'QC_PENDING', 'READY_FOR_DELIVERY', 
  'OUT_FOR_DELIVERY', 'DELIVERED', 'CLOSED'
);
CREATE TYPE delivery_status AS ENUM (
  'ASSIGNED', 'EN_ROUTE_PICKUP', 'VEHICLE_PICKED', 
  'AT_WORKSHOP', 'OUT_FOR_DELIVERY', 'ARRIVED_AT_DESTINATION', 'DELIVERED'
);

-- 2. Create Employees Table
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'MECHANIC',
  phone TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  specialized_team TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'AVAILABLE',
  active_jobs_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Vendors Table
CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  outstanding_balance NUMERIC(10,2) DEFAULT 0,
  rating NUMERIC(2,1) DEFAULT 5.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Job Cards Table
CREATE TABLE IF NOT EXISTS job_cards (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  estimated_completion_date TIMESTAMPTZ,
  registration_number TEXT NOT NULL,
  vehicle_make TEXT NOT NULL,
  vehicle_model TEXT NOT NULL,
  vehicle_year INT,
  vehicle_color TEXT,
  vehicle_vin TEXT,
  fuel_level INT DEFAULT 50,
  mileage INT DEFAULT 0,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  customer_address TEXT,
  status job_card_status DEFAULT 'CREATED',
  service_type TEXT NOT NULL,
  package_name TEXT,
  floor_manager_id TEXT REFERENCES employees(id),
  pickup_requested BOOLEAN DEFAULT FALSE,
  delivery_requested BOOLEAN DEFAULT FALSE,
  discount NUMERIC(10,2) DEFAULT 0,
  tax_rate NUMERIC(5,2) DEFAULT 18.0,
  advance_paid NUMERIC(10,2) DEFAULT 0,
  qc_passed BOOLEAN DEFAULT FALSE,
  qc_notes TEXT
);

-- 5. Create Job Tasks Table
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
  completed_at TIMESTAMPTZ
);

-- 6. Create Delivery Records Table
CREATE TABLE IF NOT EXISTS delivery_records (
  id TEXT PRIMARY KEY,
  job_card_id TEXT NOT NULL REFERENCES job_cards(id) ON DELETE CASCADE,
  vehicle_reg TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  delivery_boy_id TEXT REFERENCES employees(id),
  delivery_boy_name TEXT,
  type TEXT NOT NULL DEFAULT 'DELIVERY',
  pickup_address TEXT,
  delivery_address TEXT,
  status delivery_status DEFAULT 'ASSIGNED',
  total_amount_due NUMERIC(10,2) DEFAULT 0,
  payment_status TEXT DEFAULT 'PENDING',
  payment_method TEXT,
  current_lat NUMERIC(9,6),
  current_lng NUMERIC(9,6),
  destination_lat NUMERIC(9,6),
  destination_lng NUMERIC(9,6),
  eta_minutes INT DEFAULT 20,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Create Purchase Orders Table
CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  job_card_id TEXT NOT NULL REFERENCES job_cards(id),
  vehicle_reg TEXT NOT NULL,
  vendor_id TEXT NOT NULL REFERENCES vendors(id),
  vendor_name TEXT NOT NULL,
  category TEXT NOT NULL,
  item_description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'ISSUED',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

-- Allow public anonymous read/write for workshop demonstration mode
CREATE POLICY "Allow anon select employees" ON employees FOR SELECT USING (true);
CREATE POLICY "Allow anon all job_cards" ON job_cards FOR ALL USING (true);
CREATE POLICY "Allow anon all job_tasks" ON job_tasks FOR ALL USING (true);
CREATE POLICY "Allow anon all delivery_records" ON delivery_records FOR ALL USING (true);
CREATE POLICY "Allow anon all vendors" ON vendors FOR ALL USING (true);
CREATE POLICY "Allow anon all purchase_orders" ON purchase_orders FOR ALL USING (true);
`;
