-- ============================================================================
-- FantaFac Smart Production Assistant + Digital Twin
-- Normalized PostgreSQL Schema & Row-Level Security (RLS)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUMS & VALUE CONSTRAINTS
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'Operator',
    'Maintenance Technician',
    'Quality Inspector',
    'Supervisor',
    'Manager',
    'Administrator'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE work_order_status AS ENUM (
    'Planned',
    'In Progress',
    'Paused',
    'Completed',
    'Cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE priority_level AS ENUM ('Low', 'Medium', 'High', 'Critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE machine_status AS ENUM (
    'Running',
    'Idle',
    'Warning',
    'Error',
    'Maintenance'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE maintenance_status AS ENUM (
    'Open',
    'Assigned',
    'In Progress',
    'Waiting for Parts',
    'Resolved',
    'Closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE data_source_type AS ENUM ('Telemetry', 'Manual', 'Simulation');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID UNIQUE,
  employee_code TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'Operator',
  facility_id TEXT NOT NULL DEFAULT 'FAC-NORTH-01',
  assigned_shift TEXT NOT NULL DEFAULT 'Shift A (06:00-14:00)',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. PRODUCTION LINES
CREATE TABLE IF NOT EXISTS production_lines (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  target_units_per_hour INTEGER NOT NULL CHECK (target_units_per_hour > 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. PRODUCTS
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  standard_cycle_time_sec NUMERIC(8,2) NOT NULL CHECK (standard_cycle_time_sec > 0),
  units_per_case INTEGER NOT NULL CHECK (units_per_case > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. MACHINES
-- Note: Derived totals (good_quantity, defect_quantity, current_output) are also cached
-- for quick status snapshots, while canonical historical records live in production_records
-- and machine_status_events.
CREATE TABLE IF NOT EXISTS machines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  line_id TEXT NOT NULL REFERENCES production_lines(id) ON DELETE RESTRICT,
  station_code TEXT NOT NULL,
  station_order INTEGER NOT NULL,
  machine_type TEXT NOT NULL,
  status machine_status NOT NULL DEFAULT 'Idle',
  capacity_per_hour INTEGER NOT NULL CHECK (capacity_per_hour > 0),
  current_output INTEGER NOT NULL DEFAULT 0 CHECK (current_output >= 0),
  good_quantity INTEGER NOT NULL DEFAULT 0 CHECK (good_quantity >= 0),
  defect_quantity INTEGER NOT NULL DEFAULT 0 CHECK (defect_quantity >= 0),
  downtime_minutes_today INTEGER NOT NULL DEFAULT 0 CHECK (downtime_minutes_today >= 0),
  data_source data_source_type NOT NULL DEFAULT 'Simulation',
  standard_processing_time_sec NUMERIC(6,2) NOT NULL DEFAULT 2.5,
  station_buffer_capacity INTEGER NOT NULL DEFAULT 5,
  last_status_change TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sop_Code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_machines_line_status ON machines(line_id, status);

-- 6. MACHINE STATUS EVENTS (For accurate non-overlapping downtime calculation & audit)
CREATE TABLE IF NOT EXISTS machine_status_events (
  id TEXT PRIMARY KEY,
  machine_id TEXT NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  previous_status machine_status NOT NULL,
  new_status machine_status NOT NULL,
  reason TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  data_source data_source_type NOT NULL DEFAULT 'Manual',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_machine_status_events_machine_time ON machine_status_events(machine_id, started_at DESC);

-- 7. WORK ORDERS
CREATE TABLE IF NOT EXISTS work_orders (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  line_id TEXT NOT NULL REFERENCES production_lines(id) ON DELETE RESTRICT,
  status work_order_status NOT NULL DEFAULT 'Planned',
  priority priority_level NOT NULL DEFAULT 'Medium',
  planned_quantity INTEGER NOT NULL CHECK (planned_quantity > 0),
  produced_quantity INTEGER NOT NULL DEFAULT 0 CHECK (produced_quantity >= 0),
  good_quantity INTEGER NOT NULL DEFAULT 0 CHECK (good_quantity >= 0),
  defective_quantity INTEGER NOT NULL DEFAULT 0 CHECK (defective_quantity >= 0),
  CONSTRAINT chk_wo_quantities CHECK (good_quantity + defective_quantity = produced_quantity),
  due_date TIMESTAMPTZ NOT NULL,
  assigned_shift TEXT NOT NULL,
  created_by TEXT NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_orders_status_line ON work_orders(status, line_id);

-- 8. PRODUCTION RECORDS (Shift & Hourly Output Entries)
CREATE TABLE IF NOT EXISTS production_records (
  id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  line_id TEXT NOT NULL REFERENCES production_lines(id) ON DELETE RESTRICT,
  machine_id TEXT REFERENCES machines(id) ON DELETE SET NULL,
  shift TEXT NOT NULL,
  hour_slot TEXT NOT NULL,
  produced_quantity INTEGER NOT NULL CHECK (produced_quantity > 0),
  good_quantity INTEGER NOT NULL CHECK (good_quantity >= 0),
  defective_quantity INTEGER NOT NULL CHECK (defective_quantity >= 0),
  CONSTRAINT chk_prod_record_quantities CHECK (good_quantity + defective_quantity = produced_quantity),
  recorded_by TEXT NOT NULL,
  data_source data_source_type NOT NULL DEFAULT 'Manual',
  notes TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_records_wo ON production_records(work_order_id, recorded_at DESC);

-- 9. MAINTENANCE REQUESTS & LOGS
CREATE TABLE IF NOT EXISTS maintenance_requests (
  id TEXT PRIMARY KEY,
  machine_id TEXT NOT NULL REFERENCES machines(id) ON DELETE RESTRICT,
  line_id TEXT NOT NULL REFERENCES production_lines(id) ON DELETE RESTRICT,
  category TEXT NOT NULL,
  severity priority_level NOT NULL DEFAULT 'High',
  status maintenance_status NOT NULL DEFAULT 'Open',
  description TEXT NOT NULL,
  attachment_url TEXT,
  reported_by TEXT NOT NULL,
  assigned_to TEXT,
  root_cause TEXT,
  corrective_action TEXT,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  repair_started_at TIMESTAMPTZ,
  repair_completed_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  downtime_minutes INTEGER NOT NULL DEFAULT 0 CHECK (downtime_minutes >= 0)
);

CREATE INDEX IF NOT EXISTS idx_maintenance_requests_status_machine ON maintenance_requests(status, machine_id);

CREATE TABLE IF NOT EXISTS maintenance_logs (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  previous_status maintenance_status,
  new_status maintenance_status,
  note TEXT NOT NULL,
  author TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. QUALITY INSPECTIONS
CREATE TABLE IF NOT EXISTS quality_inspections (
  id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL REFERENCES work_orders(id) ON DELETE RESTRICT,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  machine_id TEXT NOT NULL REFERENCES machines(id) ON DELETE RESTRICT,
  batch_number TEXT NOT NULL,
  sample_size INTEGER NOT NULL CHECK (sample_size > 0),
  defect_quantity INTEGER NOT NULL CHECK (defect_quantity >= 0 AND defect_quantity <= sample_size),
  defect_category TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('Pass', 'Fail', 'Hold')),
  compliance_verified BOOLEAN NOT NULL DEFAULT FALSE,
  inspector TEXT NOT NULL,
  notes TEXT,
  inspected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quality_inspections_wo_time ON quality_inspections(work_order_id, inspected_at DESC);

-- 11. PACKAGING MATERIALS & INVENTORY TRANSACTIONS
CREATE TABLE IF NOT EXISTS materials (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL,
  quantity_available INTEGER NOT NULL DEFAULT 0 CHECK (quantity_available >= 0),
  reorder_threshold INTEGER NOT NULL DEFAULT 100 CHECK (reorder_threshold >= 0),
  supplier_name TEXT NOT NULL,
  lot_number TEXT NOT NULL,
  unit_cost NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id TEXT PRIMARY KEY,
  material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('Receipt', 'Issue', 'Adjustment')),
  quantity_delta INTEGER NOT NULL,
  previous_balance INTEGER NOT NULL CHECK (previous_balance >= 0),
  new_balance INTEGER NOT NULL CHECK (new_balance >= 0),
  reference_doc TEXT,
  lot_number TEXT,
  reason TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_tx_material_time ON inventory_transactions(material_id, created_at DESC);

-- 12. SHIFTS & SHIFT HANDOVER REPORTS
CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shift_handover_reports (
  id TEXT PRIMARY KEY,
  line_id TEXT NOT NULL REFERENCES production_lines(id) ON DELETE RESTRICT,
  outgoing_shift TEXT NOT NULL,
  incoming_shift TEXT NOT NULL,
  produced_quantity INTEGER NOT NULL DEFAULT 0,
  outstanding_work_orders TEXT[] NOT NULL DEFAULT '{}',
  machine_issues TEXT NOT NULL,
  quality_issues TEXT NOT NULL,
  inventory_concerns TEXT NOT NULL,
  action_items TEXT NOT NULL,
  author TEXT NOT NULL,
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  severity priority_level NOT NULL DEFAULT 'Medium',
  category TEXT NOT NULL CHECK (category IN ('Machine', 'Maintenance', 'Quality', 'Inventory', 'Production', 'Handover', 'Simulation')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_entity_id TEXT,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. SIMULATION SESSIONS & EVENTS
CREATE TABLE IF NOT EXISTS simulation_sessions (
  id TEXT PRIMARY KEY,
  line_id TEXT NOT NULL REFERENCES production_lines(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('Idle', 'Running', 'Paused', 'Completed')),
  speed_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  elapsed_sim_seconds NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_spawned INTEGER NOT NULL DEFAULT 0,
  total_completed INTEGER NOT NULL DEFAULT 0,
  total_good INTEGER NOT NULL DEFAULT 0,
  total_defective INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS simulation_events (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  sim_timestamp_sec NUMERIC(12,2) NOT NULL,
  station_id TEXT,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  actor_role user_role NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details TEXT NOT NULL,
  data_source data_source_type NOT NULL DEFAULT 'Manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_handover_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Authenticated read access across operational tables
CREATE POLICY "Allow authenticated read access on machines"
  ON machines FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access on work_orders"
  ON work_orders FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access on maintenance_requests"
  ON maintenance_requests FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access on quality_inspections"
  ON quality_inspections FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access on materials"
  ON materials FOR SELECT TO authenticated USING (true);
