# FantaFac MES — Smart Production Assistant & 3D Digital Twin

A full-stack industrial Manufacturing Execution System (MES) and interactive 3D Packaging Line Digital Twin built with **Next.js App Router**, **React**, **TypeScript**, **Tailwind CSS**, **React Three Fiber / Three.js**, **Recharts**, **Zod**, and **Supabase / PostgreSQL**.

---

## 1. Core Capabilities

| Module | Route | Key Capabilities |
| :--- | :--- | :--- |
| **Shop-Floor Dashboard** | `/dashboard` | Live KPIs (Total Produced, Target Achievement %, Good vs Defective Units, Fleet States, Downtime, Open Maintenance), Hourly Output & Defect Rate Charts, Active Work Orders, Alert Feed. |
| **Production Tracking** | `/production` | Shift & hourly output logging (`good + defective = produced` validation), work order completion tracking, operator & station attribution, and historical ledger. |
| **Work Orders** | `/work-orders` | Create, filter, and transition production work orders (`Planned` → `In Progress` → `Paused` / `Completed` / `Cancelled`) with strict state machine guards. |
| **Machine Monitoring** | `/machines` | Station registry (Stations A–E & Line 2), telemetry vs manual vs simulated data badges, audited status changes, and **Safety Interlock** preventing machines with open breakdowns from returning to `Running` without resolution or authorized release. |
| **Maintenance Management** | `/maintenance` | 6-step operator breakdown reporting, technician dispatch, LOTO & repair status transitions (`Open`, `Assigned`, `In Progress`, `Waiting for Parts`, `Resolved`, `Closed`), root cause & corrective action enforcement, and non-overlapping downtime calculation. |
| **Quality Control** | `/quality` | Batch AQL inspection logging, configurable defect rate warning threshold (default `2.5%`), verified compliance guard (`Pass` / `Hold` / `Fail`), Defect Pareto chart, and batch defect trend. |
| **Packaging Inventory** | `/inventory` | Corrugated blanks, hot-melt adhesive, GS1 labels, shrink film, and partitions tracked via immutable `Receipt`, `Issue`, and `Adjustment` transactions with non-negative stock protection. |
| **Shift Handover** | `/shift-handover` | Outgoing-to-incoming shift continuity reports, one-click auto-population of unresolved breakdowns/quality holds/low stock, and incoming shift sign-off acknowledgement. |
| **3D Digital Twin** | `/digital-twin` | Interactive 3D Packaging Line (Stations A–E: Product Feeding, Quality Inspection, Box Forming, Packing, Sealing) powered by a deterministic fixed-step simulation engine synchronized with canonical machine states. |
| **Analytics & OEE** | `/analytics` | Transparent Overall Equipment Effectiveness (`Availability × Performance × Quality`), Mean Time To Repair (MTTR), downtime by machine, and material consumption summary. |
| **Notifications** | `/notifications` | Real-time operational alerts across Machine, Maintenance, Quality, Inventory, and Handover categories. |
| **Settings & RBAC** | `/settings` | Role-Based Access Control (RBAC) permission inspector, active profile switcher, quality threshold configuration, seed reset, and immutable system-wide audit trail. |

---

## 2. Local Setup Instructions

### Prerequisites
- **Node.js** `>= 20.x` (tested on `v24.19.0`)
- **npm** `>= 10.x`

### Install & Run
```bash
# 1. Install dependencies
npm install

# 2. (Optional) Copy environment template
cp .env.example .env.local

# 3. Start development server on http://localhost:3000
npm run dev

# 4. Build and start production server
npm run build
npm run start
```

---

## 3. Demo Mode vs. Supabase Cloud Mode

### Local Demo Persistence Mode (Default)
When `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are not configured:
- The application automatically runs in **Local Demo Persistence Mode** (explicitly badged in the sidebar and `/settings`).
- Initial state is hydrated from deterministic manufacturing seed data (`src/lib/store/seed-data.ts`) and persisted in browser `localStorage` (`fantafac_factory_state_v1`).
- Every form submission, status change, breakdown report, quality inspection, and inventory transaction persists across browser reloads.
- You can reset all demo data back to the clean initial seed at any time via **Settings → Reset All Demo Data to Seed State**.
- **Security Note**: The header Role Switcher (`Supervisor`, `Operator`, `Maintenance Technician`, `Quality Inspector`, `Manager`, `Administrator`) is provided to test RBAC permissions locally. Client-side role switching is for demo evaluation only; production deployments enforce authorization on the server and via PostgreSQL Row-Level Security (RLS).

### Supabase Cloud Mode
To connect a live Supabase PostgreSQL instance:
1. Execute [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL Editor to create all normalized tables, constraints, indexes, and RLS policies.
2. Execute [`supabase/seed.sql`](supabase/seed.sql) to populate initial production lines, products, and packaging stations.
3. Populate `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.

---

## 4. Architecture & Domain Modeling Notes

### Stored vs. Calculated Values
- **Stored Canonical Entities**: `work_orders`, `production_records`, `machines`, `machine_status_events`, `maintenance_requests`, `maintenance_logs`, `quality_inspections`, `materials`, `inventory_transactions`, `shift_handover_reports`, `notifications`, and `audit_logs`.
- **Calculated / Derived Metrics**:
  - **Work Order Completion %**: `min(100, (goodQuantity / plannedQuantity) * 100)`
  - **Defect Rate %**: `(defectiveUnits / totalUnits) * 100`
  - **Non-Overlapping Downtime**: Overlapping maintenance or machine stoppage intervals `[start, end]` are sorted and merged before summing minutes (`calculateNonOverlappingDowntimeMinutes` in `src/lib/domain/logic.ts`) so concurrent tickets never double-count downtime.
  - **OEE (`Availability × Performance × Quality`)**:
    - `Availability = Run Time / Planned Production Time`
    - `Performance = (Total Produced Units × Ideal Cycle Time) / Run Time`
    - `Quality = Good Units / Total Produced Units`

### Deterministic 3D Digital Twin Simulation Engine (`src/lib/simulation/engine.ts`)
- Separated completely from React rendering as a pure, unit-tested TypeScript module.
- Uses a fixed simulation time step (`FIXED_STEP_SEC = 0.2s`) and a deterministic Mulberry32 PRNG.
- Changing simulation speed (`0.5x`, `1x`, `2x`, `4x`) scales simulated time progression (`realDeltaSec * speedMultiplier`) rather than artificially multiplying counters.
- Enforces exclusive single-station ownership for every carton and propagates upstream blocking when a downstream station enters `Error` or `Maintenance` or its buffer fills.

---

## 5. Testing Instructions

### Unit & Domain Tests (Vitest)
Covers production quantity validation, work order transitions, machine safety interlocks, maintenance transitions, inventory non-negative stock validation, non-overlapping downtime calculation, deterministic simulation pause/resume/speed scaling, upstream blocking, defect rates, and OEE formulas:
```bash
npm test
```

### End-to-End Workflow Tests (Playwright)
Verifies all 7 critical user journeys in a real browser against the production build:
```bash
npm run test:e2e
```

---

## 6. Future Real-Machine (PLC / OPC-UA / MQTT) Integration Plan

The system is architected so every record carries a `dataSource` discriminator (`"Telemetry" | "Manual" | "Simulation"`):
1. **Edge Ingestion Gateway**: Deploy an industrial edge gateway (Node-RED / Kepware / custom OPC-UA & MQTT bridge) subscribing to PLC tags on Stations A–E (`ns=2;s=Line1.StationA.Status`, `GoodCount`, `RejectCount`, `AlarmCode`).
2. **Webhook / Streaming Ingestion**: Stream signed telemetry payloads into a server route (`/api/telemetry/ingest`) or Supabase Realtime channel using `SUPABASE_SERVICE_ROLE_KEY`.
3. **Automatic State & Breakdown Triggers**: Map PLC fault bits (`ALM-409`, `E-STOP`) directly to `machine_status_events` (`dataSource: "Telemetry"`) and auto-draft `maintenance_requests` while preserving manual operator overrides and LOTO safety interlocks.
