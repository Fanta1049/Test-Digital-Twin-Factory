import { z } from "zod";
import {
  InspectionResult,
  InventoryTransactionType,
  MachineStatus,
  MaintenanceRequest,
  MaintenanceStatus,
  PriorityLevel,
  UserRole,
  WorkOrderStatus,
} from "./types";

// ============================================================================
// 1. WORK ORDER STATE TRANSITIONS & QUANTITY VALIDATION
// ============================================================================

const VALID_WO_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  Planned: ["In Progress", "Cancelled"],
  "In Progress": ["Paused", "Completed", "Cancelled"],
  Paused: ["In Progress", "Completed", "Cancelled"],
  Completed: [],
  Cancelled: [],
};

export function canTransitionWorkOrder(
  current: WorkOrderStatus,
  next: WorkOrderStatus
): { valid: boolean; reason?: string } {
  if (current === next) {
    return { valid: true };
  }
  const allowed = VALID_WO_TRANSITIONS[current] || [];
  if (!allowed.includes(next)) {
    return {
      valid: false,
      reason: `Invalid work order state transition from "${current}" to "${next}". Allowed: ${
        allowed.length ? allowed.join(", ") : "None (terminal state)"
      }.`,
    };
  }
  return { valid: true };
}

export const productionOutputSchema = z
  .object({
    workOrderId: z.string().min(1, "Work order is required"),
    shift: z.string().min(1, "Shift is required"),
    hourSlot: z.string().min(1, "Hour slot is required"),
    goodQuantity: z
      .number()
      .int("Good quantity must be a whole number")
      .min(0, "Good quantity cannot be negative"),
    defectiveQuantity: z
      .number()
      .int("Defective quantity must be a whole number")
      .min(0, "Defective quantity cannot be negative"),
    machineId: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((data) => data.goodQuantity + data.defectiveQuantity > 0, {
    message: "Total recorded output (good + defective) must be greater than zero",
    path: ["goodQuantity"],
  });

export function validateProductionOutput(input: {
  goodQuantity: number;
  defectiveQuantity: number;
  producedQuantity?: number;
}): {
  valid: boolean;
  producedQuantity: number;
  goodQuantity: number;
  defectiveQuantity: number;
  completionRatePct?: number;
  error?: string;
} {
  const { goodQuantity, defectiveQuantity, producedQuantity } = input;

  if (
    !Number.isInteger(goodQuantity) ||
    !Number.isInteger(defectiveQuantity) ||
    goodQuantity < 0 ||
    defectiveQuantity < 0
  ) {
    return {
      valid: false,
      producedQuantity: 0,
      goodQuantity,
      defectiveQuantity,
      error: "Good and defective quantities must be non-negative integers.",
    };
  }

  const calculatedTotal = goodQuantity + defectiveQuantity;

  if (calculatedTotal <= 0) {
    return {
      valid: false,
      producedQuantity: calculatedTotal,
      goodQuantity,
      defectiveQuantity,
      error: "Total produced quantity must be greater than zero.",
    };
  }

  if (
    typeof producedQuantity === "number" &&
    producedQuantity !== calculatedTotal
  ) {
    return {
      valid: false,
      producedQuantity,
      goodQuantity,
      defectiveQuantity,
      error: `Quantity mismatch: good (${goodQuantity}) + defective (${defectiveQuantity}) = ${calculatedTotal}, which does not equal reported total (${producedQuantity}).`,
    };
  }

  return {
    valid: true,
    producedQuantity: calculatedTotal,
    goodQuantity,
    defectiveQuantity,
  };
}

export function calculateWorkOrderCompletion(
  goodQuantity: number,
  plannedQuantity: number
): number {
  if (plannedQuantity <= 0) return 0;
  return Number(Math.min(100, (goodQuantity / plannedQuantity) * 100).toFixed(1));
}

// ============================================================================
// 2. MACHINE STATE TRANSITIONS & SAFETY LOCKS
// ============================================================================

/**
 * Safety & Operational Rule:
 * Do not allow a machine with an active unresolved breakdown (Open, Assigned, In Progress, Waiting for Parts)
 * to return to "Running" without either resolving the maintenance request first OR providing an explicit
 * authorized supervisor/maintenance override flag.
 */
export function validateMachineStatusTransition(params: {
  currentStatus: MachineStatus;
  nextStatus: MachineStatus;
  unresolvedMaintenanceRequests: Pick<MaintenanceRequest, "id" | "status" | "severity">[];
  actorRole: UserRole;
  authorizedOverride?: boolean;
  reason: string;
}): { valid: boolean; error?: string } {
  const {
    currentStatus,
    nextStatus,
    unresolvedMaintenanceRequests,
    actorRole,
    authorizedOverride = false,
    reason,
  } = params;

  if (!reason || reason.trim().length < 3) {
    return {
      valid: false,
      error: "An audit reason (minimum 3 characters) is required for status changes.",
    };
  }

  if (currentStatus === nextStatus) {
    return { valid: true };
  }

  const activeBreakdowns = unresolvedMaintenanceRequests.filter((req) =>
    ["Open", "Assigned", "In Progress", "Waiting for Parts"].includes(req.status)
  );

  if (nextStatus === "Running" && activeBreakdowns.length > 0) {
    const canAuthorize = [
      "Maintenance Technician",
      "Supervisor",
      "Manager",
      "Administrator",
    ].includes(actorRole);

    if (!authorizedOverride || !canAuthorize) {
      return {
        valid: false,
        error: `Safety Interlock Active: Machine has ${activeBreakdowns.length} unresolved maintenance request(s) (${activeBreakdowns
          .map((r) => r.id)
          .join(", ")}). Resolve the maintenance ticket first or provide an authorized Maintenance/Supervisor safety release.`,
      };
    }
  }

  return { valid: true };
}

// ============================================================================
// 3. MAINTENANCE WORKFLOW STATE MACHINE & DOWNTIME CALCULATION
// ============================================================================

const VALID_MAINTENANCE_TRANSITIONS: Record<
  MaintenanceStatus,
  MaintenanceStatus[]
> = {
  Open: ["Assigned", "In Progress", "Closed"],
  Assigned: ["In Progress", "Waiting for Parts", "Resolved"],
  "In Progress": ["Waiting for Parts", "Resolved"],
  "Waiting for Parts": ["In Progress", "Resolved"],
  Resolved: ["Closed", "In Progress"],
  Closed: [],
};

export function validateMaintenanceTransition(params: {
  currentStatus: MaintenanceStatus;
  nextStatus: MaintenanceStatus;
  assignedTo?: string;
  rootCause?: string;
  correctiveAction?: string;
}): { valid: boolean; error?: string } {
  const {
    currentStatus,
    nextStatus,
    assignedTo,
    rootCause,
    correctiveAction,
  } = params;

  if (currentStatus === nextStatus) {
    return { valid: true };
  }

  const allowed = VALID_MAINTENANCE_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    return {
      valid: false,
      error: `Cannot transition maintenance request from "${currentStatus}" to "${nextStatus}". Allowed: ${allowed.join(
        ", "
      )}.`,
    };
  }

  if (
    ["Assigned", "In Progress", "Resolved"].includes(nextStatus) &&
    (!assignedTo || assignedTo.trim().length === 0)
  ) {
    return {
      valid: false,
      error: `Technician assignment is required before moving to "${nextStatus}".`,
    };
  }

  if (nextStatus === "Resolved" || nextStatus === "Closed") {
    if (!rootCause || rootCause.trim().length < 4) {
      return {
        valid: false,
        error: "Root cause must be documented before resolving or closing a breakdown.",
      };
    }
    if (!correctiveAction || correctiveAction.trim().length < 4) {
      return {
        valid: false,
        error:
          "Corrective action must be documented before resolving or closing a breakdown.",
      };
    }
  }

  return { valid: true };
}

export interface TimeInterval {
  startMs: number;
  endMs: number;
}

/**
 * Merges overlapping downtime intervals so overlapping maintenance tickets or status events
 * on the same machine are never double-counted.
 * Returns total non-overlapping downtime in rounded minutes.
 */
export function calculateNonOverlappingDowntimeMinutes(
  intervals: Array<{ start: string | number | Date; end?: string | number | Date }>,
  referenceNow: number = Date.now()
): number {
  const parsed: TimeInterval[] = [];

  for (const item of intervals) {
    const startMs = new Date(item.start).getTime();
    const endMs = item.end ? new Date(item.end).getTime() : referenceNow;
    if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs > startMs) {
      parsed.push({ startMs, endMs });
    }
  }

  if (parsed.length === 0) return 0;

  parsed.sort((a, b) => a.startMs - b.startMs);

  const merged: TimeInterval[] = [parsed[0]];
  for (let i = 1; i < parsed.length; i++) {
    const current = parsed[i];
    const last = merged[merged.length - 1];
    if (current.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, current.endMs);
    } else {
      merged.push({ ...current });
    }
  }

  const totalMs = merged.reduce(
    (sum, interval) => sum + (interval.endMs - interval.startMs),
    0
  );
  return Math.round(totalMs / 60000);
}

// ============================================================================
// 4. INVENTORY VALIDATION & TRANSACTION ENGINE
// ============================================================================

export function validateInventoryTransaction(params: {
  currentBalance: number;
  transactionType: InventoryTransactionType;
  quantity: number;
  reason: string;
}): {
  valid: boolean;
  newBalance: number;
  quantityDelta: number;
  error?: string;
} {
  const { currentBalance, transactionType, quantity, reason } = params;

  if (!reason || reason.trim().length < 3) {
    return {
      valid: false,
      newBalance: currentBalance,
      quantityDelta: 0,
      error: "A valid transaction reason or reference is required.",
    };
  }

  if (!Number.isInteger(quantity)) {
    return {
      valid: false,
      newBalance: currentBalance,
      quantityDelta: 0,
      error: "Quantity must be an integer.",
    };
  }

  if (transactionType === "Receipt") {
    if (quantity <= 0) {
      return {
        valid: false,
        newBalance: currentBalance,
        quantityDelta: 0,
        error: "Receipt quantity must be greater than zero.",
      };
    }
    return {
      valid: true,
      newBalance: currentBalance + quantity,
      quantityDelta: quantity,
    };
  }

  if (transactionType === "Issue") {
    if (quantity <= 0) {
      return {
        valid: false,
        newBalance: currentBalance,
        quantityDelta: 0,
        error: "Issue quantity must be greater than zero.",
      };
    }
    if (currentBalance - quantity < 0) {
      return {
        valid: false,
        newBalance: currentBalance,
        quantityDelta: 0,
        error: `Insufficient stock: cannot issue ${quantity} units when available balance is ${currentBalance}.`,
      };
    }
    return {
      valid: true,
      newBalance: currentBalance - quantity,
      quantityDelta: -quantity,
    };
  }

  // Adjustment: quantity represents signed delta (+ or -)
  if (quantity === 0) {
    return {
      valid: false,
      newBalance: currentBalance,
      quantityDelta: 0,
      error: "Stock adjustment delta cannot be zero.",
    };
  }

  const adjustedBalance = currentBalance + quantity;
  if (adjustedBalance < 0) {
    return {
      valid: false,
      newBalance: currentBalance,
      quantityDelta: 0,
      error: `Invalid adjustment: resulting stock balance (${adjustedBalance}) cannot be negative.`,
    };
  }

  return {
    valid: true,
    newBalance: adjustedBalance,
    quantityDelta: quantity,
  };
}

// ============================================================================
// 5. QUALITY CONTROL & DEFECT CALCULATIONS
// ============================================================================

export function validateQualityInspection(params: {
  sampleSize: number;
  defectQuantity: number;
  thresholdPct?: number;
}): {
  valid: boolean;
  defectRatePct: number;
  exceedsThreshold: boolean;
  suggestedResult: InspectionResult;
  error?: string;
} {
  const { sampleSize, defectQuantity, thresholdPct = 2.5 } = params;

  if (!Number.isInteger(sampleSize) || sampleSize <= 0) {
    return {
      valid: false,
      defectRatePct: 0,
      exceedsThreshold: false,
      suggestedResult: "Hold",
      error: "Sample size (inspected quantity) must be a positive integer.",
    };
  }

  if (!Number.isInteger(defectQuantity) || defectQuantity < 0) {
    return {
      valid: false,
      defectRatePct: 0,
      exceedsThreshold: false,
      suggestedResult: "Hold",
      error: "Defective quantity must be a non-negative integer.",
    };
  }

  if (defectQuantity > sampleSize) {
    return {
      valid: false,
      defectRatePct: 0,
      exceedsThreshold: true,
      suggestedResult: "Fail",
      error: `Defective quantity (${defectQuantity}) cannot exceed inspected sample size (${sampleSize}).`,
    };
  }

  const defectRatePct = Number(((defectQuantity / sampleSize) * 100).toFixed(2));
  const exceedsThreshold = defectRatePct > thresholdPct;

  return {
    valid: true,
    defectRatePct,
    exceedsThreshold,
    suggestedResult: exceedsThreshold ? "Fail" : "Pass",
  };
}

export function calculateDefectRatePct(
  defectiveUnits: number,
  totalUnits: number
): number {
  if (totalUnits <= 0 || defectiveUnits < 0) return 0;
  return Number(((defectiveUnits / totalUnits) * 100).toFixed(2));
}

// ============================================================================
// 6. OEE (OVERALL EQUIPMENT EFFECTIVENESS) FORMULAS
// ============================================================================
/**
 * Standard Manufacturing OEE Definition:
 * - Planned Production Time = Shift Duration - Planned Breaks
 * - Run Time = Planned Production Time - Unplanned Downtime
 * - Availability = Run Time / Planned Production Time
 * - Performance = (Total Count * Ideal Cycle Time) / Run Time
 *   (or equivalently Actual Output Rate / Ideal Output Rate during Run Time, capped at 100% for OEE display or reported raw)
 * - Quality = Good Count / Total Count
 * - OEE = Availability * Performance * Quality
 */
export interface OEEInput {
  plannedProductionMinutes: number;
  downtimeMinutes: number;
  totalProducedUnits: number;
  goodUnits: number;
  idealCycleTimeSeconds: number;
}

export interface OEEResult {
  available: boolean;
  reason?: string;
  runTimeMinutes: number;
  availabilityPct: number;
  performancePct: number;
  qualityPct: number;
  oeePct: number;
}

export function calculateOEE(input: OEEInput): OEEResult {
  const {
    plannedProductionMinutes,
    downtimeMinutes,
    totalProducedUnits,
    goodUnits,
    idealCycleTimeSeconds,
  } = input;

  if (
    plannedProductionMinutes <= 0 ||
    idealCycleTimeSeconds <= 0 ||
    totalProducedUnits < 0 ||
    goodUnits < 0 ||
    goodUnits > totalProducedUnits
  ) {
    return {
      available: false,
      reason:
        "Missing or invalid OEE denominator parameters (planned time, cycle time, or unit counts).",
      runTimeMinutes: 0,
      availabilityPct: 0,
      performancePct: 0,
      qualityPct: 0,
      oeePct: 0,
    };
  }

  const clampedDowntime = Math.max(
    0,
    Math.min(plannedProductionMinutes, downtimeMinutes)
  );
  const runTimeMinutes = plannedProductionMinutes - clampedDowntime;

  if (runTimeMinutes <= 0 || totalProducedUnits === 0) {
    return {
      available: true,
      runTimeMinutes: Math.max(0, runTimeMinutes),
      availabilityPct: Number(
        ((Math.max(0, runTimeMinutes) / plannedProductionMinutes) * 100).toFixed(1)
      ),
      performancePct: 0,
      qualityPct: 0,
      oeePct: 0,
    };
  }

  const availability = runTimeMinutes / plannedProductionMinutes;
  const runTimeSeconds = runTimeMinutes * 60;
  const rawPerformance =
    (totalProducedUnits * idealCycleTimeSeconds) / runTimeSeconds;
  const performance = Math.min(1.0, Math.max(0, rawPerformance));
  const quality = goodUnits / totalProducedUnits;

  const oee = availability * performance * quality;

  return {
    available: true,
    runTimeMinutes,
    availabilityPct: Number((availability * 100).toFixed(1)),
    performancePct: Number((performance * 100).toFixed(1)),
    qualityPct: Number((quality * 100).toFixed(1)),
    oeePct: Number((oee * 100).toFixed(1)),
  };
}

// ============================================================================
// 7. ROLE-BASED ACCESS CONTROL (RBAC) MATRIX
// ============================================================================

export type PermissionAction =
  | "work_order:create"
  | "work_order:update_status"
  | "production:record"
  | "machine:update_status"
  | "machine:override_safety"
  | "maintenance:report"
  | "maintenance:assign_resolve"
  | "maintenance:close"
  | "quality:record_inspection"
  | "quality:verify_compliance"
  | "inventory:transact"
  | "inventory:adjust"
  | "handover:create"
  | "handover:acknowledge"
  | "settings:manage";

const ROLE_PERMISSIONS: Record<UserRole, PermissionAction[]> = {
  Operator: [
    "production:record",
    "work_order:update_status",
    "machine:update_status",
    "maintenance:report",
    "inventory:transact",
    "handover:create",
    "handover:acknowledge",
  ],
  "Maintenance Technician": [
    "machine:update_status",
    "machine:override_safety",
    "maintenance:report",
    "maintenance:assign_resolve",
    "maintenance:close",
    "handover:create",
    "handover:acknowledge",
  ],
  "Quality Inspector": [
    "quality:record_inspection",
    "quality:verify_compliance",
    "maintenance:report",
    "handover:create",
    "handover:acknowledge",
  ],
  Supervisor: [
    "work_order:create",
    "work_order:update_status",
    "production:record",
    "machine:update_status",
    "machine:override_safety",
    "maintenance:report",
    "maintenance:assign_resolve",
    "maintenance:close",
    "quality:record_inspection",
    "quality:verify_compliance",
    "inventory:transact",
    "inventory:adjust",
    "handover:create",
    "handover:acknowledge",
  ],
  Manager: [
    "work_order:create",
    "work_order:update_status",
    "production:record",
    "machine:update_status",
    "machine:override_safety",
    "maintenance:report",
    "maintenance:assign_resolve",
    "maintenance:close",
    "quality:record_inspection",
    "quality:verify_compliance",
    "inventory:transact",
    "inventory:adjust",
    "handover:create",
    "handover:acknowledge",
    "settings:manage",
  ],
  Administrator: [
    "work_order:create",
    "work_order:update_status",
    "production:record",
    "machine:update_status",
    "machine:override_safety",
    "maintenance:report",
    "maintenance:assign_resolve",
    "maintenance:close",
    "quality:record_inspection",
    "quality:verify_compliance",
    "inventory:transact",
    "inventory:adjust",
    "handover:create",
    "handover:acknowledge",
    "settings:manage",
  ],
};

export function hasPermission(role: UserRole, action: PermissionAction): boolean {
  return ROLE_PERMISSIONS[role]?.includes(action) ?? false;
}

export function getRolePermissions(role: UserRole): PermissionAction[] {
  return ROLE_PERMISSIONS[role] || [];
}

export const WORK_ORDER_SCHEMA = z.object({
  productId: z.string().min(1, "Select a product"),
  lineId: z.string().min(1, "Select a production line"),
  plannedQuantity: z
    .number()
    .int()
    .min(10, "Planned quantity must be at least 10 units")
    .max(100000, "Planned quantity cannot exceed 100,000 units"),
  priority: z.enum(["Low", "Medium", "High", "Critical"] as [
    PriorityLevel,
    ...PriorityLevel[]
  ]),
  dueDate: z.string().min(1, "Due date is required"),
  assignedShift: z.string().min(1, "Assigned shift is required"),
  notes: z.string().optional(),
});
