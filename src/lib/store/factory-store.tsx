"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  canTransitionWorkOrder,
  hasPermission,
  validateInventoryTransaction,
  validateMachineStatusTransition,
  validateMaintenanceTransition,
  validateProductionOutput,
  validateQualityInspection,
} from "../domain/logic";
import {
  AppNotification,
  AuditLog,
  DataSourceType,
  DefectCategory,
  Facility,
  InspectionResult,
  InventoryTransaction,
  InventoryTransactionType,
  Machine,
  MachineStatus,
  MachineStatusEvent,
  MaintenanceLogEntry,
  MaintenanceRequest,
  MaintenanceStatus,
  PackagingMaterial,
  PriorityLevel,
  Product,
  ProductionLine,
  ProductionRecord,
  QualityInspection,
  ShiftHandoverReport,
  UserProfile,
  WorkOrder,
  WorkOrderStatus,
} from "../domain/types";
import {
  createInitialSimulationState,
  PackagingLineSimState,
  pauseSimulation,
  setSimulationSpeed,
  startSimulation,
  stepSimulation,
  syncSimulationStationsFromMachines,
} from "../simulation/engine";
import { isSupabaseConfigured } from "../supabase/client";
import {
  SEED_AUDIT_LOGS,
  SEED_FACILITIES,
  SEED_INVENTORY_TRANSACTIONS,
  SEED_MACHINES,
  SEED_MACHINE_STATUS_EVENTS,
  SEED_MAINTENANCE_LOGS,
  SEED_MAINTENANCE_REQUESTS,
  SEED_MATERIALS,
  SEED_NOTIFICATIONS,
  SEED_PRODUCTION_LINES,
  SEED_PRODUCTION_RECORDS,
  SEED_PRODUCTS,
  SEED_QUALITY_INSPECTIONS,
  SEED_SHIFT_HANDOVERS,
  SEED_USERS,
  SEED_WORK_ORDERS,
} from "./seed-data";

const STORAGE_KEY = "fantafac_factory_state_v1";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  description?: string;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

interface PersistedState {
  selectedFacilityId: string;
  selectedLineId: string; // "ALL" or line ID
  currentUserId: string;
  qualityThresholdPct: number;
  facilities: Facility[];
  lines: ProductionLine[];
  products: Product[];
  users: UserProfile[];
  machines: Machine[];
  machineStatusEvents: MachineStatusEvent[];
  workOrders: WorkOrder[];
  productionRecords: ProductionRecord[];
  maintenanceRequests: MaintenanceRequest[];
  maintenanceLogs: MaintenanceLogEntry[];
  qualityInspections: QualityInspection[];
  materials: PackagingMaterial[];
  inventoryTransactions: InventoryTransaction[];
  shiftHandovers: ShiftHandoverReport[];
  notifications: AppNotification[];
  auditLogs: AuditLog[];
}

function getDefaultPersistedState(): PersistedState {
  return {
    selectedFacilityId: "FAC-NORTH-01",
    selectedLineId: "ALL",
    currentUserId: "USR-SUP-01", // Default Supervisor so all workflows can be tested smoothly, with quick role switcher in header
    qualityThresholdPct: 2.5,
    facilities: SEED_FACILITIES,
    lines: SEED_PRODUCTION_LINES,
    products: SEED_PRODUCTS,
    users: SEED_USERS,
    machines: SEED_MACHINES,
    machineStatusEvents: SEED_MACHINE_STATUS_EVENTS,
    workOrders: SEED_WORK_ORDERS,
    productionRecords: SEED_PRODUCTION_RECORDS,
    maintenanceRequests: SEED_MAINTENANCE_REQUESTS,
    maintenanceLogs: SEED_MAINTENANCE_LOGS,
    qualityInspections: SEED_QUALITY_INSPECTIONS,
    materials: SEED_MATERIALS,
    inventoryTransactions: SEED_INVENTORY_TRANSACTIONS,
    shiftHandovers: SEED_SHIFT_HANDOVERS,
    notifications: SEED_NOTIFICATIONS,
    auditLogs: SEED_AUDIT_LOGS,
  };
}

interface FactoryStoreContextValue extends PersistedState {
  hydrated: boolean;
  persistenceMode: "Local Demo Persistence" | "Supabase Connected";
  currentUser: UserProfile;
  simState: PackagingLineSimState;
  toasts: ToastMessage[];
  aiDrawerOpen: boolean;
  setAiDrawerOpen: (open: boolean) => void;
  addToast: (toast: Omit<ToastMessage, "id">) => void;
  dismissToast: (id: string) => void;

  // Global selectors / setters
  setSelectedFacilityId: (id: string) => void;
  setSelectedLineId: (id: string) => void;
  setCurrentUserId: (id: string) => void;
  setQualityThresholdPct: (pct: number) => void;
  resetDemoData: () => void;

  // Work Orders & Production
  createWorkOrder: (input: {
    productId: string;
    lineId: string;
    plannedQuantity: number;
    priority: PriorityLevel;
    dueDate: string;
    assignedShift: string;
    notes?: string;
  }) => ActionResult;
  updateWorkOrderStatus: (
    workOrderId: string,
    nextStatus: WorkOrderStatus
  ) => ActionResult;
  recordProductionOutput: (input: {
    workOrderId: string;
    shift: string;
    hourSlot: string;
    goodQuantity: number;
    defectiveQuantity: number;
    machineId?: string;
    dataSource?: DataSourceType;
    notes?: string;
  }) => ActionResult;

  // Machines
  updateMachineStatus: (input: {
    machineId: string;
    nextStatus: MachineStatus;
    reason: string;
    authorizedOverride?: boolean;
    dataSource?: DataSourceType;
  }) => ActionResult;

  // Maintenance
  reportBreakdown: (input: {
    machineId: string;
    category: MaintenanceRequest["category"];
    severity: PriorityLevel;
    description: string;
    attachmentUrl?: string;
    putMachineInError?: boolean;
  }) => ActionResult;
  updateMaintenanceRequest: (input: {
    requestId: string;
    nextStatus: MaintenanceStatus;
    assignedTo?: string;
    rootCause?: string;
    correctiveAction?: string;
    note?: string;
    restoreMachineToRunning?: boolean;
  }) => ActionResult;

  // Quality
  recordQualityInspection: (input: {
    workOrderId: string;
    machineId: string;
    batchNumber: string;
    sampleSize: number;
    defectQuantity: number;
    defectCategory: DefectCategory | "None";
    complianceVerified: boolean;
    notes: string;
  }) => ActionResult;

  // Inventory
  recordInventoryTransaction: (input: {
    materialId: string;
    transactionType: InventoryTransactionType;
    quantity: number;
    referenceDoc?: string;
    lotNumber?: string;
    reason: string;
  }) => ActionResult;

  // Shift Handover
  createShiftHandover: (input: {
    lineId: string;
    outgoingShift: string;
    incomingShift: string;
    producedQuantity: number;
    outstandingWorkOrders: string[];
    machineIssues: string;
    qualityIssues: string;
    inventoryConcerns: string;
    actionItems: string;
  }) => ActionResult;
  acknowledgeShiftHandover: (handoverId: string) => ActionResult;

  // Notifications
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  // Digital Twin Simulation Controls
  startDigitalTwin: () => void;
  pauseDigitalTwin: () => void;
  resetDigitalTwin: () => void;
  setDigitalTwinSpeed: (speed: number) => void;
  triggerSimulatedStationFault: (
    stationId: string,
    targetStatus: MachineStatus
  ) => void;
}

const FactoryStoreContext = createContext<FactoryStoreContextValue | null>(
  null
);

export function FactoryStoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<PersistedState>(getDefaultPersistedState);
  const [hydrated, setHydrated] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);

  const [simState, setSimState] = useState<PackagingLineSimState>(() =>
    createInitialSimulationState(SEED_MACHINES)
  );

  // Hydrate from localStorage on client mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedState>;
        if (parsed && Array.isArray(parsed.machines) && Array.isArray(parsed.workOrders)) {
          const merged = {
            ...getDefaultPersistedState(),
            ...parsed,
          };
          setState(merged);
          setSimState((prev) =>
            syncSimulationStationsFromMachines(prev, merged.machines)
          );
        }
      }
    } catch (err) {
      console.warn("Failed to read local state from localStorage:", err);
    } finally {
      setHydrated(true);
    }
  }, []);

  // Persist to localStorage whenever state updates after hydration
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn("Failed to persist state to localStorage:", err);
    }
  }, [state, hydrated]);

  // Keep simulation stations synchronized with canonical machine statuses
  useEffect(() => {
    setSimState((prev) =>
      syncSimulationStationsFromMachines(prev, state.machines)
    );
  }, [state.machines]);

  // Single simulation loop — never creates multiple intervals on repeated Start/Pause
  const lastTickRef = useRef<number | null>(null);
  useEffect(() => {
    if (simState.status !== "Running") {
      lastTickRef.current = null;
      return;
    }

    lastTickRef.current = performance.now();
    const intervalId = window.setInterval(() => {
      const now = performance.now();
      const last = lastTickRef.current ?? now;
      const realDeltaSec = Math.max(0.05, Math.min(0.5, (now - last) / 1000));
      lastTickRef.current = now;

      setSimState((prev) => stepSimulation(prev, realDeltaSec));
    }, 200);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [simState.status]);

  const addToast = useCallback((toast: Omit<ToastMessage, "id">) => {
    const id = `TST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const currentUser = useMemo(() => {
    return (
      state.users.find((u) => u.id === state.currentUserId) || state.users[0]
    );
  }, [state.users, state.currentUserId]);

  const setSelectedFacilityId = useCallback((id: string) => {
    setState((prev) => ({ ...prev, selectedFacilityId: id }));
  }, []);

  const setSelectedLineId = useCallback((id: string) => {
    setState((prev) => ({ ...prev, selectedLineId: id }));
  }, []);

  const setCurrentUserId = useCallback(
    (id: string) => {
      const targetUser = state.users.find((u) => u.id === id);
      setState((prev) => ({ ...prev, currentUserId: id }));
      if (targetUser) {
        addToast({
          type: "info",
          title: `Switched Active Profile: ${targetUser.fullName}`,
          description: `Active Role: ${targetUser.role} (Demo RBAC Context)`,
        });
      }
    },
    [state.users, addToast]
  );

  const setQualityThresholdPct = useCallback(
    (pct: number) => {
      const clamped = Math.max(0.1, Math.min(25, pct));
      setState((prev) => ({ ...prev, qualityThresholdPct: clamped }));
      addToast({
        type: "success",
        title: "Quality Threshold Updated",
        description: `Defect warning threshold set to ${clamped.toFixed(1)}%.`,
      });
    },
    [addToast]
  );

  const resetDemoData = useCallback(() => {
    const fresh = getDefaultPersistedState();
    setState(fresh);
    setSimState(createInitialSimulationState(fresh.machines));
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    } catch {
      // ignore storage errors
    }
    addToast({
      type: "info",
      title: "Factory Demo State Reset",
      description:
        "All operational tables and Digital Twin counters restored to initial seed data.",
    });
  }, [addToast]);

  // ==========================================================================
  // WORK ORDERS & PRODUCTION RECORDING
  // ==========================================================================
  const createWorkOrder = useCallback(
    (input: {
      productId: string;
      lineId: string;
      plannedQuantity: number;
      priority: PriorityLevel;
      dueDate: string;
      assignedShift: string;
      notes?: string;
    }): ActionResult => {
      if (!hasPermission(currentUser.role, "work_order:create")) {
        const msg = `Role "${currentUser.role}" is not authorized to create production work orders. Switch to Supervisor, Manager, or Administrator.`;
        addToast({ type: "error", title: "Authorization Denied", description: msg });
        return { ok: false, error: msg };
      }

      if (!input.productId || !input.lineId) {
        return { ok: false, error: "Product and Production Line are required." };
      }
      if (!Number.isInteger(input.plannedQuantity) || input.plannedQuantity < 10) {
        return {
          ok: false,
          error: "Planned quantity must be an integer of at least 10 units.",
        };
      }

      const nowIso = new Date().toISOString();
      const newId = `WO-2026-${100 + state.workOrders.length + 1}`;
      const newWo: WorkOrder = {
        id: newId,
        productId: input.productId,
        lineId: input.lineId,
        status: "Planned",
        priority: input.priority,
        plannedQuantity: input.plannedQuantity,
        producedQuantity: 0,
        goodQuantity: 0,
        defectiveQuantity: 0,
        dueDate: input.dueDate,
        assignedShift: input.assignedShift,
        createdBy: currentUser.fullName,
        notes: input.notes?.trim() || undefined,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const auditEntry: AuditLog = {
        id: `AUD-${Date.now()}`,
        actor: currentUser.fullName,
        actorRole: currentUser.role,
        action: "WORK_ORDER_CREATED",
        entityType: "WorkOrder",
        entityId: newId,
        details: `Created work order ${newId} for ${input.plannedQuantity} units on ${input.lineId}`,
        dataSource: "Manual",
        createdAt: nowIso,
      };

      setState((prev) => ({
        ...prev,
        workOrders: [newWo, ...prev.workOrders],
        auditLogs: [auditEntry, ...prev.auditLogs],
      }));

      addToast({
        type: "success",
        title: `Work Order ${newId} Created`,
        description: `Planned ${input.plannedQuantity.toLocaleString()} units assigned to ${input.assignedShift}.`,
      });
      return { ok: true, id: newId };
    },
    [currentUser, state.workOrders.length, addToast]
  );

  const updateWorkOrderStatus = useCallback(
    (workOrderId: string, nextStatus: WorkOrderStatus): ActionResult => {
      if (!hasPermission(currentUser.role, "work_order:update_status")) {
        const msg = `Role "${currentUser.role}" cannot change work order statuses.`;
        addToast({ type: "error", title: "Authorization Denied", description: msg });
        return { ok: false, error: msg };
      }

      const target = state.workOrders.find((w) => w.id === workOrderId);
      if (!target) {
        return { ok: false, error: "Work order not found." };
      }

      const check = canTransitionWorkOrder(target.status, nextStatus);
      if (!check.valid) {
        addToast({
          type: "error",
          title: "Invalid Status Transition",
          description: check.reason,
        });
        return { ok: false, error: check.reason };
      }

      const nowIso = new Date().toISOString();
      setState((prev) => ({
        ...prev,
        workOrders: prev.workOrders.map((wo) =>
          wo.id === workOrderId
            ? {
                ...wo,
                status: nextStatus,
                startedAt:
                  nextStatus === "In Progress" && !wo.startedAt
                    ? nowIso
                    : wo.startedAt,
                completedAt:
                  nextStatus === "Completed" ? nowIso : wo.completedAt,
                updatedAt: nowIso,
              }
            : wo
        ),
        auditLogs: [
          {
            id: `AUD-${Date.now()}`,
            actor: currentUser.fullName,
            actorRole: currentUser.role,
            action: "WORK_ORDER_STATUS_CHANGE",
            entityType: "WorkOrder",
            entityId: workOrderId,
            details: `Transitioned ${workOrderId} from ${target.status} to ${nextStatus}`,
            dataSource: "Manual",
            createdAt: nowIso,
          },
          ...prev.auditLogs,
        ],
      }));

      addToast({
        type: "success",
        title: `${workOrderId} -> ${nextStatus}`,
        description: `Work order status updated by ${currentUser.fullName}.`,
      });
      return { ok: true, id: workOrderId };
    },
    [currentUser, state.workOrders, addToast]
  );

  const recordProductionOutput = useCallback(
    (input: {
      workOrderId: string;
      shift: string;
      hourSlot: string;
      goodQuantity: number;
      defectiveQuantity: number;
      machineId?: string;
      dataSource?: DataSourceType;
      notes?: string;
    }): ActionResult => {
      if (!hasPermission(currentUser.role, "production:record")) {
        const msg = `Role "${currentUser.role}" is not permitted to record production output.`;
        addToast({ type: "error", title: "Authorization Denied", description: msg });
        return { ok: false, error: msg };
      }

      const wo = state.workOrders.find((w) => w.id === input.workOrderId);
      if (!wo) {
        return { ok: false, error: "Selected work order does not exist." };
      }
      if (wo.status === "Completed" || wo.status === "Cancelled") {
        const err = `Cannot record output against a ${wo.status} work order.`;
        addToast({ type: "error", title: "Work Order Closed", description: err });
        return { ok: false, error: err };
      }

      const validation = validateProductionOutput({
        goodQuantity: input.goodQuantity,
        defectiveQuantity: input.defectiveQuantity,
      });

      if (!validation.valid) {
        addToast({
          type: "error",
          title: "Invalid Output Quantities",
          description: validation.error,
        });
        return { ok: false, error: validation.error };
      }

      const nowIso = new Date().toISOString();
      const recordId = `PRC-${1000 + state.productionRecords.length + 1}`;
      const newRecord: ProductionRecord = {
        id: recordId,
        workOrderId: wo.id,
        lineId: wo.lineId,
        machineId: input.machineId || undefined,
        shift: input.shift,
        hourSlot: input.hourSlot,
        producedQuantity: validation.producedQuantity,
        goodQuantity: validation.goodQuantity,
        defectiveQuantity: validation.defectiveQuantity,
        recordedBy: currentUser.fullName,
        dataSource: input.dataSource || "Manual",
        notes: input.notes?.trim() || undefined,
        recordedAt: nowIso,
      };

      const nextGood = wo.goodQuantity + validation.goodQuantity;
      const nextDefective = wo.defectiveQuantity + validation.defectiveQuantity;
      const nextProduced = wo.producedQuantity + validation.producedQuantity;
      const autoStatus: WorkOrderStatus =
        nextGood >= wo.plannedQuantity
          ? "Completed"
          : wo.status === "Planned"
          ? "In Progress"
          : wo.status;

      setState((prev) => ({
        ...prev,
        productionRecords: [newRecord, ...prev.productionRecords],
        workOrders: prev.workOrders.map((item) =>
          item.id === wo.id
            ? {
                ...item,
                status: autoStatus,
                producedQuantity: nextProduced,
                goodQuantity: nextGood,
                defectiveQuantity: nextDefective,
                startedAt: item.startedAt || nowIso,
                completedAt:
                  autoStatus === "Completed" ? nowIso : item.completedAt,
                updatedAt: nowIso,
              }
            : item
        ),
        machines: input.machineId
          ? prev.machines.map((m) =>
              m.id === input.machineId
                ? {
                    ...m,
                    currentOutput: m.currentOutput + validation.producedQuantity,
                    goodQuantity: m.goodQuantity + validation.goodQuantity,
                    defectQuantity: m.defectQuantity + validation.defectiveQuantity,
                  }
                : m
            )
          : prev.machines,
        auditLogs: [
          {
            id: `AUD-${Date.now()}`,
            actor: currentUser.fullName,
            actorRole: currentUser.role,
            action: "PRODUCTION_OUTPUT_RECORDED",
            entityType: "ProductionRecord",
            entityId: recordId,
            details: `Logged ${validation.goodQuantity} good + ${validation.defectiveQuantity} scrap (${validation.producedQuantity} total) on ${wo.id}`,
            dataSource: input.dataSource || "Manual",
            createdAt: nowIso,
          },
          ...prev.auditLogs,
        ],
      }));

      addToast({
        type: "success",
        title: "Production Output Recorded",
        description: `+${validation.goodQuantity} good units logged on ${wo.id} (${input.hourSlot}).`,
      });
      return { ok: true, id: recordId };
    },
    [currentUser, state.workOrders, state.productionRecords.length, addToast]
  );

  // ==========================================================================
  // MACHINE STATUS MANAGEMENT
  // ==========================================================================
  const updateMachineStatus = useCallback(
    (input: {
      machineId: string;
      nextStatus: MachineStatus;
      reason: string;
      authorizedOverride?: boolean;
      dataSource?: DataSourceType;
    }): ActionResult => {
      if (!hasPermission(currentUser.role, "machine:update_status")) {
        const msg = `Role "${currentUser.role}" cannot change machine status.`;
        addToast({ type: "error", title: "Authorization Denied", description: msg });
        return { ok: false, error: msg };
      }

      const machine = state.machines.find((m) => m.id === input.machineId);
      if (!machine) {
        return { ok: false, error: "Machine not found." };
      }

      const machineTickets = state.maintenanceRequests.filter(
        (r) => r.machineId === machine.id
      );

      const check = validateMachineStatusTransition({
        currentStatus: machine.status,
        nextStatus: input.nextStatus,
        unresolvedMaintenanceRequests: machineTickets,
        actorRole: currentUser.role,
        authorizedOverride: input.authorizedOverride,
        reason: input.reason,
      });

      if (!check.valid) {
        addToast({
          type: "error",
          title: "Machine Status Interlock",
          description: check.error,
        });
        return { ok: false, error: check.error };
      }

      const nowIso = new Date().toISOString();
      const evtId = `MSE-${100 + state.machineStatusEvents.length + 1}`;
      const newEvt: MachineStatusEvent = {
        id: evtId,
        machineId: machine.id,
        previousStatus: machine.status,
        newStatus: input.nextStatus,
        reason: input.reason.trim(),
        changedBy: currentUser.fullName,
        dataSource: input.dataSource || "Manual",
        startedAt: nowIso,
      };

      const shouldNotify =
        input.nextStatus === "Error" ||
        input.nextStatus === "Warning" ||
        input.nextStatus === "Maintenance";

      setState((prev) => ({
        ...prev,
        machines: prev.machines.map((m) =>
          m.id === machine.id
            ? {
                ...m,
                status: input.nextStatus,
                dataSource: input.dataSource || "Manual",
                lastStatusChange: nowIso,
              }
            : m
        ),
        machineStatusEvents: [
          newEvt,
          ...prev.machineStatusEvents.map((e) =>
            e.machineId === machine.id && !e.endedAt
              ? { ...e, endedAt: nowIso }
              : e
          ),
        ],
        notifications: shouldNotify
          ? [
              {
                id: `NTF-${Date.now()}`,
                severity: input.nextStatus === "Error" ? "Critical" : "High",
                category: "Machine",
                title: `${machine.name} -> ${input.nextStatus}`,
                message: `${machine.stationCode} status changed to ${input.nextStatus}: ${input.reason}`,
                relatedEntityId: machine.id,
                read: false,
                createdAt: nowIso,
              },
              ...prev.notifications,
            ]
          : prev.notifications,
        auditLogs: [
          {
            id: `AUD-${Date.now()}`,
            actor: currentUser.fullName,
            actorRole: currentUser.role,
            action: "MACHINE_STATUS_CHANGE",
            entityType: "Machine",
            entityId: machine.id,
            details: `${machine.name}: ${machine.status} -> ${input.nextStatus} (${input.reason})`,
            dataSource: input.dataSource || "Manual",
            createdAt: nowIso,
          },
          ...prev.auditLogs,
        ],
      }));

      addToast({
        type: input.nextStatus === "Error" ? "warning" : "success",
        title: `${machine.stationCode} Status: ${input.nextStatus}`,
        description: `${machine.name} updated and synchronized with Digital Twin.`,
      });
      return { ok: true, id: evtId };
    },
    [
      currentUser,
      state.machines,
      state.maintenanceRequests,
      state.machineStatusEvents.length,
      addToast,
    ]
  );

  // ==========================================================================
  // MAINTENANCE BREAKDOWN WORKFLOW
  // ==========================================================================
  const reportBreakdown = useCallback(
    (input: {
      machineId: string;
      category: MaintenanceRequest["category"];
      severity: PriorityLevel;
      description: string;
      attachmentUrl?: string;
      putMachineInError?: boolean;
    }): ActionResult => {
      if (!hasPermission(currentUser.role, "maintenance:report")) {
        return {
          ok: false,
          error: "Current role is not authorized to submit breakdown reports.",
        };
      }

      const machine = state.machines.find((m) => m.id === input.machineId);
      if (!machine) {
        return { ok: false, error: "Selected machine does not exist." };
      }
      if (!input.description || input.description.trim().length < 5) {
        return {
          ok: false,
          error: "Please enter a clear problem description (at least 5 characters).",
        };
      }

      const nowIso = new Date().toISOString();
      const reqId = `MNT-${2000 + state.maintenanceRequests.length + 1}`;
      const newReq: MaintenanceRequest = {
        id: reqId,
        machineId: machine.id,
        lineId: machine.lineId,
        category: input.category,
        severity: input.severity,
        status: "Open",
        description: input.description.trim(),
        attachmentUrl: input.attachmentUrl?.trim() || undefined,
        reportedBy: currentUser.fullName,
        reportedAt: nowIso,
        downtimeMinutes: 0,
      };

      const logEntry: MaintenanceLogEntry = {
        id: `MLG-${Date.now()}`,
        requestId: reqId,
        action: "Breakdown Reported",
        newStatus: "Open",
        note: `${input.category} (${input.severity}): ${input.description.trim()}`,
        author: currentUser.fullName,
        createdAt: nowIso,
      };

      const nextMachineStatus: MachineStatus =
        input.putMachineInError !== false
          ? input.severity === "Critical" || input.severity === "High"
            ? "Error"
            : "Warning"
          : machine.status;

      setState((prev) => ({
        ...prev,
        maintenanceRequests: [newReq, ...prev.maintenanceRequests],
        maintenanceLogs: [logEntry, ...prev.maintenanceLogs],
        machines: prev.machines.map((m) =>
          m.id === machine.id
            ? {
                ...m,
                status: nextMachineStatus,
                dataSource: "Manual",
                lastStatusChange: nowIso,
              }
            : m
        ),
        notifications: [
          {
            id: `NTF-${Date.now()}`,
            severity: input.severity,
            category: "Maintenance",
            title: `New Breakdown ${reqId} — ${machine.name}`,
            message: `${input.category} reported by ${currentUser.fullName}. Machine set to ${nextMachineStatus}.`,
            relatedEntityId: reqId,
            read: false,
            createdAt: nowIso,
          },
          ...prev.notifications,
        ],
        auditLogs: [
          {
            id: `AUD-${Date.now()}`,
            actor: currentUser.fullName,
            actorRole: currentUser.role,
            action: "BREAKDOWN_REPORTED",
            entityType: "MaintenanceRequest",
            entityId: reqId,
            details: `Reported ${input.category} on ${machine.name} (${reqId})`,
            dataSource: "Manual",
            createdAt: nowIso,
          },
          ...prev.auditLogs,
        ],
      }));

      addToast({
        type: "warning",
        title: `Breakdown Ticket ${reqId} Opened`,
        description: `${machine.name} marked ${nextMachineStatus} and alert dispatched.`,
      });
      return { ok: true, id: reqId };
    },
    [currentUser, state.machines, state.maintenanceRequests.length, addToast]
  );

  const updateMaintenanceRequest = useCallback(
    (input: {
      requestId: string;
      nextStatus: MaintenanceStatus;
      assignedTo?: string;
      rootCause?: string;
      correctiveAction?: string;
      note?: string;
      restoreMachineToRunning?: boolean;
    }): ActionResult => {
      if (!hasPermission(currentUser.role, "maintenance:assign_resolve")) {
        const msg = `Role "${currentUser.role}" cannot update maintenance repair workflows. Switch to Maintenance Technician, Supervisor, Manager, or Administrator.`;
        addToast({ type: "error", title: "Authorization Denied", description: msg });
        return { ok: false, error: msg };
      }

      const req = state.maintenanceRequests.find(
        (r) => r.id === input.requestId
      );
      if (!req) {
        return { ok: false, error: "Maintenance request not found." };
      }

      const effectiveAssignee =
        input.assignedTo !== undefined ? input.assignedTo : req.assignedTo;
      const effectiveRootCause =
        input.rootCause !== undefined ? input.rootCause : req.rootCause;
      const effectiveAction =
        input.correctiveAction !== undefined
          ? input.correctiveAction
          : req.correctiveAction;

      const check = validateMaintenanceTransition({
        currentStatus: req.status,
        nextStatus: input.nextStatus,
        assignedTo: effectiveAssignee,
        rootCause: effectiveRootCause,
        correctiveAction: effectiveAction,
      });

      if (!check.valid) {
        addToast({
          type: "error",
          title: "Maintenance Workflow Validation",
          description: check.error,
        });
        return { ok: false, error: check.error };
      }

      const nowIso = new Date().toISOString();
      const reportedMs = new Date(req.reportedAt).getTime();
      const elapsedMin = Math.max(
        req.downtimeMinutes,
        Math.round((Date.now() - reportedMs) / 60000)
      );

      const updatedReq: MaintenanceRequest = {
        ...req,
        status: input.nextStatus,
        assignedTo: effectiveAssignee?.trim() || req.assignedTo,
        rootCause: effectiveRootCause?.trim() || req.rootCause,
        correctiveAction: effectiveAction?.trim() || req.correctiveAction,
        repairStartedAt:
          input.nextStatus === "In Progress" && !req.repairStartedAt
            ? nowIso
            : req.repairStartedAt,
        repairCompletedAt:
          input.nextStatus === "Resolved" ? nowIso : req.repairCompletedAt,
        closedAt: input.nextStatus === "Closed" ? nowIso : req.closedAt,
        downtimeMinutes:
          req.downtimeMinutes > 0 ? req.downtimeMinutes : Math.max(15, elapsedMin),
      };

      const logEntry: MaintenanceLogEntry = {
        id: `MLG-${Date.now()}`,
        requestId: req.id,
        action: `Status -> ${input.nextStatus}`,
        previousStatus: req.status,
        newStatus: input.nextStatus,
        note:
          input.note?.trim() ||
          (input.nextStatus === "Resolved"
            ? `Resolved: ${updatedReq.correctiveAction}`
            : `Updated status to ${input.nextStatus} (Assigned: ${updatedReq.assignedTo || "Unassigned"})`),
        author: currentUser.fullName,
        createdAt: nowIso,
      };

      setState((prev) => ({
        ...prev,
        maintenanceRequests: prev.maintenanceRequests.map((r) =>
          r.id === req.id ? updatedReq : r
        ),
        maintenanceLogs: [logEntry, ...prev.maintenanceLogs],
        machines: prev.machines.map((m) => {
          if (m.id !== req.machineId) return m;
          if (input.nextStatus === "In Progress") {
            return { ...m, status: "Maintenance", lastStatusChange: nowIso };
          }
          if (
            (input.nextStatus === "Resolved" || input.nextStatus === "Closed") &&
            input.restoreMachineToRunning
          ) {
            return { ...m, status: "Running", lastStatusChange: nowIso };
          }
          return m;
        }),
        notifications: [
          {
            id: `NTF-${Date.now()}`,
            severity:
              input.nextStatus === "Resolved" || input.nextStatus === "Closed"
                ? "Low"
                : "Medium",
            category: "Maintenance",
            title: `Maintenance ${req.id} -> ${input.nextStatus}`,
            message: `Ticket ${req.id} on ${req.machineId} updated to ${input.nextStatus} by ${currentUser.fullName}.`,
            relatedEntityId: req.id,
            read: false,
            createdAt: nowIso,
          },
          ...prev.notifications,
        ],
        auditLogs: [
          {
            id: `AUD-${Date.now()}`,
            actor: currentUser.fullName,
            actorRole: currentUser.role,
            action: "MAINTENANCE_STATUS_UPDATE",
            entityType: "MaintenanceRequest",
            entityId: req.id,
            details: `${req.id} transitioned from ${req.status} to ${input.nextStatus}`,
            dataSource: "Manual",
            createdAt: nowIso,
          },
          ...prev.auditLogs,
        ],
      }));

      addToast({
        type: "success",
        title: `${req.id} Updated to ${input.nextStatus}`,
        description: input.restoreMachineToRunning
          ? "Machine restored to Running state."
          : `Logged by ${currentUser.fullName}.`,
      });
      return { ok: true, id: req.id };
    },
    [currentUser, state.maintenanceRequests, addToast]
  );

  // ==========================================================================
  // QUALITY CONTROL
  // ==========================================================================
  const recordQualityInspection = useCallback(
    (input: {
      workOrderId: string;
      machineId: string;
      batchNumber: string;
      sampleSize: number;
      defectQuantity: number;
      defectCategory: DefectCategory | "None";
      complianceVerified: boolean;
      notes: string;
    }): ActionResult => {
      if (!hasPermission(currentUser.role, "quality:record_inspection")) {
        const msg = `Role "${currentUser.role}" cannot record quality inspections. Switch to Quality Inspector, Supervisor, Manager, or Administrator.`;
        addToast({ type: "error", title: "Authorization Denied", description: msg });
        return { ok: false, error: msg };
      }

      const wo = state.workOrders.find((w) => w.id === input.workOrderId);
      if (!wo) {
        return { ok: false, error: "Work order not found." };
      }

      const check = validateQualityInspection({
        sampleSize: input.sampleSize,
        defectQuantity: input.defectQuantity,
        thresholdPct: state.qualityThresholdPct,
      });

      if (!check.valid) {
        addToast({
          type: "error",
          title: "Inspection Validation Error",
          description: check.error,
        });
        return { ok: false, error: check.error };
      }

      // Never automatically classify as Pass/Compliant if compliance criteria are not verified when defects exist
      let finalResult: InspectionResult = check.suggestedResult;
      if (
        finalResult === "Pass" &&
        input.defectQuantity > 0 &&
        !input.complianceVerified
      ) {
        finalResult = "Hold";
      }

      const nowIso = new Date().toISOString();
      const qaId = `QA-${5000 + state.qualityInspections.length + 1}`;
      const newInspection: QualityInspection = {
        id: qaId,
        workOrderId: wo.id,
        productId: wo.productId,
        machineId: input.machineId,
        batchNumber: input.batchNumber.trim(),
        sampleSize: input.sampleSize,
        defectQuantity: input.defectQuantity,
        defectCategory:
          input.defectQuantity === 0 ? "None" : input.defectCategory,
        result: finalResult,
        complianceVerified: input.complianceVerified,
        inspector: currentUser.fullName,
        notes: input.notes.trim(),
        inspectedAt: nowIso,
      };

      setState((prev) => ({
        ...prev,
        qualityInspections: [newInspection, ...prev.qualityInspections],
        notifications: check.exceedsThreshold
          ? [
              {
                id: `NTF-${Date.now()}`,
                severity: "High",
                category: "Quality",
                title: `Quality Threshold Exceeded (${check.defectRatePct}%) — ${input.batchNumber}`,
                message: `Inspection ${qaId} recorded ${input.defectQuantity}/${input.sampleSize} defects (${input.defectCategory}) on ${input.machineId}.`,
                relatedEntityId: qaId,
                read: false,
                createdAt: nowIso,
              },
              ...prev.notifications,
            ]
          : prev.notifications,
        auditLogs: [
          {
            id: `AUD-${Date.now()}`,
            actor: currentUser.fullName,
            actorRole: currentUser.role,
            action: `QUALITY_INSPECTION_${finalResult.toUpperCase()}`,
            entityType: "QualityInspection",
            entityId: qaId,
            details: `Batch ${input.batchNumber}: ${input.defectQuantity}/${input.sampleSize} defects (${check.defectRatePct}%) -> ${finalResult}`,
            dataSource: "Manual",
            createdAt: nowIso,
          },
          ...prev.auditLogs,
        ],
      }));

      addToast({
        type: check.exceedsThreshold ? "warning" : "success",
        title: `Inspection ${qaId} Recorded (${finalResult})`,
        description: `Defect rate: ${check.defectRatePct}% (Threshold: ${state.qualityThresholdPct}%).`,
      });
      return { ok: true, id: qaId };
    },
    [
      currentUser,
      state.workOrders,
      state.qualityThresholdPct,
      state.qualityInspections.length,
      addToast,
    ]
  );

  // ==========================================================================
  // PACKAGING INVENTORY TRANSACTIONS
  // ==========================================================================
  const recordInventoryTransaction = useCallback(
    (input: {
      materialId: string;
      transactionType: InventoryTransactionType;
      quantity: number;
      referenceDoc?: string;
      lotNumber?: string;
      reason: string;
    }): ActionResult => {
      const requiredPerm =
        input.transactionType === "Adjustment"
          ? "inventory:adjust"
          : "inventory:transact";

      if (!hasPermission(currentUser.role, requiredPerm)) {
        const msg = `Role "${currentUser.role}" is not permitted to perform ${input.transactionType} transactions.`;
        addToast({ type: "error", title: "Authorization Denied", description: msg });
        return { ok: false, error: msg };
      }

      const material = state.materials.find((m) => m.id === input.materialId);
      if (!material) {
        return { ok: false, error: "Packaging material not found." };
      }

      const check = validateInventoryTransaction({
        currentBalance: material.quantityAvailable,
        transactionType: input.transactionType,
        quantity: input.quantity,
        reason: input.reason,
      });

      if (!check.valid) {
        addToast({
          type: "error",
          title: "Inventory Transaction Rejected",
          description: check.error,
        });
        return { ok: false, error: check.error };
      }

      const nowIso = new Date().toISOString();
      const txId = `ITX-${9000 + state.inventoryTransactions.length + 1}`;
      const newTx: InventoryTransaction = {
        id: txId,
        materialId: material.id,
        transactionType: input.transactionType,
        quantityDelta: check.quantityDelta,
        previousBalance: material.quantityAvailable,
        newBalance: check.newBalance,
        referenceDoc: input.referenceDoc?.trim() || undefined,
        lotNumber: input.lotNumber?.trim() || material.lotNumber,
        reason: input.reason.trim(),
        performedBy: currentUser.fullName,
        createdAt: nowIso,
      };

      const crossedBelowReorder =
        check.newBalance <= material.reorderThreshold &&
        material.quantityAvailable > material.reorderThreshold;

      setState((prev) => ({
        ...prev,
        materials: prev.materials.map((m) =>
          m.id === material.id
            ? {
                ...m,
                quantityAvailable: check.newBalance,
                lotNumber: input.lotNumber?.trim() || m.lotNumber,
                updatedAt: nowIso,
              }
            : m
        ),
        inventoryTransactions: [newTx, ...prev.inventoryTransactions],
        notifications: crossedBelowReorder
          ? [
              {
                id: `NTF-${Date.now()}`,
                severity: "Medium",
                category: "Inventory",
                title: `Low Stock Alert — ${material.code}`,
                message: `${material.name} dropped to ${check.newBalance} ${material.unit} (Reorder threshold: ${material.reorderThreshold} ${material.unit}).`,
                relatedEntityId: material.id,
                read: false,
                createdAt: nowIso,
              },
              ...prev.notifications,
            ]
          : prev.notifications,
        auditLogs: [
          {
            id: `AUD-${Date.now()}`,
            actor: currentUser.fullName,
            actorRole: currentUser.role,
            action: `INVENTORY_${input.transactionType.toUpperCase()}`,
            entityType: "PackagingMaterial",
            entityId: material.id,
            details: `${material.code}: ${material.quantityAvailable} -> ${check.newBalance} ${material.unit} (${input.reason})`,
            dataSource: "Manual",
            createdAt: nowIso,
          },
          ...prev.auditLogs,
        ],
      }));

      addToast({
        type: crossedBelowReorder ? "warning" : "success",
        title: `Stock ${input.transactionType} Logged (${material.code})`,
        description: `Updated balance: ${check.newBalance.toLocaleString()} ${material.unit}.`,
      });
      return { ok: true, id: txId };
    },
    [currentUser, state.materials, state.inventoryTransactions.length, addToast]
  );

  // ==========================================================================
  // SHIFT HANDOVER REPORTS
  // ==========================================================================
  const createShiftHandover = useCallback(
    (input: {
      lineId: string;
      outgoingShift: string;
      incomingShift: string;
      producedQuantity: number;
      outstandingWorkOrders: string[];
      machineIssues: string;
      qualityIssues: string;
      inventoryConcerns: string;
      actionItems: string;
    }): ActionResult => {
      if (!hasPermission(currentUser.role, "handover:create")) {
        return { ok: false, error: "Not authorized to create shift handover reports." };
      }

      if (!input.actionItems || input.actionItems.trim().length < 5) {
        return {
          ok: false,
          error: "Please include clear handover notes and action items.",
        };
      }

      const nowIso = new Date().toISOString();
      const shrId = `SHR-${700 + state.shiftHandovers.length + 1}`;
      const newReport: ShiftHandoverReport = {
        id: shrId,
        lineId: input.lineId,
        outgoingShift: input.outgoingShift,
        incomingShift: input.incomingShift,
        producedQuantity: Math.max(0, Math.round(input.producedQuantity)),
        outstandingWorkOrders: input.outstandingWorkOrders,
        machineIssues: input.machineIssues.trim() || "None reported",
        qualityIssues: input.qualityIssues.trim() || "None reported",
        inventoryConcerns: input.inventoryConcerns.trim() || "None reported",
        actionItems: input.actionItems.trim(),
        author: currentUser.fullName,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      setState((prev) => ({
        ...prev,
        shiftHandovers: [newReport, ...prev.shiftHandovers],
        notifications: [
          {
            id: `NTF-${Date.now()}`,
            severity: "Medium",
            category: "Handover",
            title: `Shift Handover Submitted (${shrId})`,
            message: `${input.outgoingShift} -> ${input.incomingShift} logged by ${currentUser.fullName}. Awaiting incoming shift acknowledgement.`,
            relatedEntityId: shrId,
            read: false,
            createdAt: nowIso,
          },
          ...prev.notifications,
        ],
        auditLogs: [
          {
            id: `AUD-${Date.now()}`,
            actor: currentUser.fullName,
            actorRole: currentUser.role,
            action: "SHIFT_HANDOVER_CREATED",
            entityType: "ShiftHandoverReport",
            entityId: shrId,
            details: `Submitted handover ${shrId} from ${input.outgoingShift} to ${input.incomingShift}`,
            dataSource: "Manual",
            createdAt: nowIso,
          },
          ...prev.auditLogs,
        ],
      }));

      addToast({
        type: "success",
        title: `Shift Handover ${shrId} Published`,
        description: `Ready for incoming shift (${input.incomingShift}) acknowledgement.`,
      });
      return { ok: true, id: shrId };
    },
    [currentUser, state.shiftHandovers.length, addToast]
  );

  const acknowledgeShiftHandover = useCallback(
    (handoverId: string): ActionResult => {
      const report = state.shiftHandovers.find((r) => r.id === handoverId);
      if (!report) {
        return { ok: false, error: "Handover report not found." };
      }
      if (report.acknowledgedBy) {
        return { ok: false, error: "Handover report is already acknowledged." };
      }

      const nowIso = new Date().toISOString();
      setState((prev) => ({
        ...prev,
        shiftHandovers: prev.shiftHandovers.map((r) =>
          r.id === handoverId
            ? {
                ...r,
                acknowledgedBy: currentUser.fullName,
                acknowledgedAt: nowIso,
                updatedAt: nowIso,
              }
            : r
        ),
        auditLogs: [
          {
            id: `AUD-${Date.now()}`,
            actor: currentUser.fullName,
            actorRole: currentUser.role,
            action: "SHIFT_HANDOVER_ACKNOWLEDGED",
            entityType: "ShiftHandoverReport",
            entityId: handoverId,
            details: `Acknowledged handover ${handoverId} for ${report.incomingShift}`,
            dataSource: "Manual",
            createdAt: nowIso,
          },
          ...prev.auditLogs,
        ],
      }));

      addToast({
        type: "success",
        title: `Handover ${handoverId} Acknowledged`,
        description: `Signed off by ${currentUser.fullName}.`,
      });
      return { ok: true, id: handoverId };
    },
    [currentUser, state.shiftHandovers, addToast]
  );

  // ==========================================================================
  // NOTIFICATIONS
  // ==========================================================================
  const markNotificationRead = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    }));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => ({ ...n, read: true })),
    }));
  }, []);

  // ==========================================================================
  // DIGITAL TWIN CONTROLS
  // ==========================================================================
  const startDigitalTwin = useCallback(() => {
    setSimState((prev) => startSimulation(prev));
  }, []);

  const pauseDigitalTwin = useCallback(() => {
    setSimState((prev) => pauseSimulation(prev));
  }, []);

  const resetDigitalTwin = useCallback(() => {
    setSimState(createInitialSimulationState(state.machines));
    addToast({
      type: "info",
      title: "Digital Twin Simulation Reset",
      description:
        "Conveyor positions and simulation clock reset to initial state.",
    });
  }, [state.machines, addToast]);

  const setDigitalTwinSpeed = useCallback((speed: number) => {
    setSimState((prev) => setSimulationSpeed(prev, speed));
  }, []);

  const triggerSimulatedStationFault = useCallback(
    (stationId: string, targetStatus: MachineStatus) => {
      updateMachineStatus({
        machineId: stationId,
        nextStatus: targetStatus,
        reason: `Digital Twin scenario injection (${targetStatus})`,
        authorizedOverride: true,
        dataSource: "Simulation",
      });
    },
    [updateMachineStatus]
  );

  const value: FactoryStoreContextValue = {
    ...state,
    hydrated,
    persistenceMode: isSupabaseConfigured
      ? "Supabase Connected"
      : "Local Demo Persistence",
    currentUser,
    simState,
    toasts,
    aiDrawerOpen,
    setAiDrawerOpen,
    addToast,
    dismissToast,
    setSelectedFacilityId,
    setSelectedLineId,
    setCurrentUserId,
    setQualityThresholdPct,
    resetDemoData,
    createWorkOrder,
    updateWorkOrderStatus,
    recordProductionOutput,
    updateMachineStatus,
    reportBreakdown,
    updateMaintenanceRequest,
    recordQualityInspection,
    recordInventoryTransaction,
    createShiftHandover,
    acknowledgeShiftHandover,
    markNotificationRead,
    markAllNotificationsRead,
    startDigitalTwin,
    pauseDigitalTwin,
    resetDigitalTwin,
    setDigitalTwinSpeed,
    triggerSimulatedStationFault,
  };

  return (
    <FactoryStoreContext.Provider value={value}>
      {children}
    </FactoryStoreContext.Provider>
  );
}

export function useFactoryStore(): FactoryStoreContextValue {
  const ctx = useContext(FactoryStoreContext);
  if (!ctx) {
    throw new Error("useFactoryStore must be used within FactoryStoreProvider");
  }
  return ctx;
}
