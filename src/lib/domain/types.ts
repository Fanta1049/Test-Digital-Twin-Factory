export type UserRole =
  | "Operator"
  | "Maintenance Technician"
  | "Quality Inspector"
  | "Supervisor"
  | "Manager"
  | "Administrator";

export type WorkOrderStatus =
  | "Planned"
  | "In Progress"
  | "Paused"
  | "Completed"
  | "Cancelled";

export type PriorityLevel = "Low" | "Medium" | "High" | "Critical";

export type MachineStatus =
  | "Running"
  | "Idle"
  | "Warning"
  | "Error"
  | "Maintenance";

export type MaintenanceStatus =
  | "Open"
  | "Assigned"
  | "In Progress"
  | "Waiting for Parts"
  | "Resolved"
  | "Closed";

export type DataSourceType = "Telemetry" | "Manual" | "Simulation";

export type DefectCategory =
  | "Damaged carton"
  | "Incorrect label"
  | "Missing product"
  | "Incorrect quantity"
  | "Packaging seal failure";

export type InspectionResult = "Pass" | "Fail" | "Hold";

export type InventoryTransactionType = "Receipt" | "Issue" | "Adjustment";

export interface Facility {
  id: string;
  name: string;
  location: string;
  timezone: string;
}

export interface ProductionLine {
  id: string;
  facilityId: string;
  name: string;
  description: string;
  targetUnitsPerHour: number;
  active: boolean;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  standardCycleTimeSec: number;
  unitsPerCase: number;
}

export interface Machine {
  id: string;
  name: string;
  lineId: string;
  stationCode: string; // e.g. "Station A"
  stationOrder: number; // 1..5
  machineType: string;
  status: MachineStatus;
  capacityPerHour: number;
  currentOutput: number;
  goodQuantity: number;
  defectQuantity: number;
  downtimeMinutesToday: number;
  dataSource: DataSourceType;
  standardProcessingTimeSec: number;
  stationBufferCapacity: number;
  lastStatusChange: string;
  sopCode: string;
  temperatureC?: number;
  vibrationMmPerSec?: number;
}

export interface MachineStatusEvent {
  id: string;
  machineId: string;
  previousStatus: MachineStatus;
  newStatus: MachineStatus;
  reason: string;
  changedBy: string;
  dataSource: DataSourceType;
  startedAt: string;
  endedAt?: string;
}

export interface WorkOrder {
  id: string;
  productId: string;
  lineId: string;
  status: WorkOrderStatus;
  priority: PriorityLevel;
  plannedQuantity: number;
  producedQuantity: number;
  goodQuantity: number;
  defectiveQuantity: number;
  dueDate: string;
  assignedShift: string;
  createdBy: string;
  startedAt?: string;
  completedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionRecord {
  id: string;
  workOrderId: string;
  lineId: string;
  machineId?: string;
  shift: string;
  hourSlot: string;
  producedQuantity: number;
  goodQuantity: number;
  defectiveQuantity: number;
  recordedBy: string;
  dataSource: DataSourceType;
  notes?: string;
  recordedAt: string;
}

export interface MaintenanceLogEntry {
  id: string;
  requestId: string;
  action: string;
  previousStatus?: MaintenanceStatus;
  newStatus?: MaintenanceStatus;
  note: string;
  author: string;
  createdAt: string;
}

export interface MaintenanceRequest {
  id: string;
  machineId: string;
  lineId: string;
  category:
    | "Mechanical Jam"
    | "Pneumatic Pressure Loss"
    | "Optical Sensor Fault"
    | "Servo Drive Overload"
    | "Thermal Adhesive Unit Fault"
    | "Conveyor Belt Misalignment"
    | "Electrical / PLC Alarm";
  severity: PriorityLevel;
  status: MaintenanceStatus;
  description: string;
  attachmentUrl?: string;
  reportedBy: string;
  assignedTo?: string;
  rootCause?: string;
  correctiveAction?: string;
  reportedAt: string;
  repairStartedAt?: string;
  repairCompletedAt?: string;
  closedAt?: string;
  downtimeMinutes: number;
}

export interface QualityInspection {
  id: string;
  workOrderId: string;
  productId: string;
  machineId: string;
  batchNumber: string;
  sampleSize: number;
  defectQuantity: number;
  defectCategory: DefectCategory | "None";
  result: InspectionResult;
  complianceVerified: boolean;
  inspector: string;
  notes: string;
  inspectedAt: string;
}

export interface PackagingMaterial {
  id: string;
  code: string;
  name: string;
  category: "Corrugated Carton" | "Label Stock" | "Hot-Melt Adhesive" | "Shrink Film" | "Partition Insert";
  unit: "pcs" | "rolls" | "kg";
  quantityAvailable: number;
  reorderThreshold: number;
  supplierName: string;
  lotNumber: string;
  unitCost: number;
  updatedAt: string;
}

export interface InventoryTransaction {
  id: string;
  materialId: string;
  transactionType: InventoryTransactionType;
  quantityDelta: number;
  previousBalance: number;
  newBalance: number;
  referenceDoc?: string;
  lotNumber?: string;
  reason: string;
  performedBy: string;
  createdAt: string;
}

export interface ShiftHandoverReport {
  id: string;
  lineId: string;
  outgoingShift: string;
  incomingShift: string;
  producedQuantity: number;
  outstandingWorkOrders: string[];
  machineIssues: string;
  qualityIssues: string;
  inventoryConcerns: string;
  actionItems: string;
  author: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  severity: PriorityLevel;
  category:
    | "Machine"
    | "Maintenance"
    | "Quality"
    | "Inventory"
    | "Production"
    | "Handover"
    | "Simulation";
  title: string;
  message: string;
  relatedEntityId?: string;
  read: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actor: string;
  actorRole: UserRole;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  dataSource: DataSourceType;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  employeeCode: string;
  fullName: string;
  role: UserRole;
  facilityId: string;
  assignedShift: string;
}
