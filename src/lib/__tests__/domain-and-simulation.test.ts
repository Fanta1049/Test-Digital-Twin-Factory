import { describe, expect, it } from "vitest";
import {
  calculateDefectRatePct,
  calculateNonOverlappingDowntimeMinutes,
  calculateOEE,
  calculateWorkOrderCompletion,
  canTransitionWorkOrder,
  hasPermission,
  validateInventoryTransaction,
  validateMachineStatusTransition,
  validateMaintenanceTransition,
  validateProductionOutput,
  validateQualityInspection,
} from "../domain/logic";
import {
  createInitialSimulationState,
  pauseSimulation,
  setSimulationSpeed,
  startSimulation,
  stepSimulation,
  syncSimulationStationsFromMachines,
} from "../simulation/engine";

describe("Smart Production Assistant — Domain & Simulation Engine Tests", () => {
  // 1. Production quantity validation & 2. Good and defective quantity calculations
  describe("Production Quantity & Work Order Validation", () => {
    it("calculates total produced quantity accurately from good and defective counts", () => {
      const res = validateProductionOutput({
        goodQuantity: 480,
        defectiveQuantity: 15,
      });
      expect(res.valid).toBe(true);
      expect(res.producedQuantity).toBe(495);
    });

    it("rejects negative quantities or zero total output", () => {
      expect(
        validateProductionOutput({ goodQuantity: -5, defectiveQuantity: 10 })
          .valid
      ).toBe(false);
      expect(
        validateProductionOutput({ goodQuantity: 0, defectiveQuantity: 0 })
          .valid
      ).toBe(false);
    });

    it("rejects mismatched reported total vs good + defective sum", () => {
      const res = validateProductionOutput({
        goodQuantity: 100,
        defectiveQuantity: 5,
        producedQuantity: 110,
      });
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Quantity mismatch");
    });

    it("enforces valid work order state transitions and calculates completion %", () => {
      expect(canTransitionWorkOrder("Planned", "In Progress").valid).toBe(true);
      expect(canTransitionWorkOrder("Planned", "Completed").valid).toBe(false);
      expect(canTransitionWorkOrder("Completed", "In Progress").valid).toBe(
        false
      );
      expect(calculateWorkOrderCompletion(750, 1000)).toBe(75.0);
    });
  });

  // 3. Machine state transitions & safety interlock
  describe("Machine State Transitions & Safety Interlock", () => {
    it("blocks returning an unresolved breakdown machine to Running without authorized override", () => {
      const res = validateMachineStatusTransition({
        currentStatus: "Error",
        nextStatus: "Running",
        unresolvedMaintenanceRequests: [
          { id: "MNT-101", status: "In Progress", severity: "Critical" },
        ],
        actorRole: "Operator",
        authorizedOverride: false,
        reason: "Trying to restart line",
      });
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Safety Interlock Active");
    });

    it("allows returning to Running when maintenance requests are Resolved or with Supervisor override", () => {
      const resolvedCase = validateMachineStatusTransition({
        currentStatus: "Maintenance",
        nextStatus: "Running",
        unresolvedMaintenanceRequests: [
          { id: "MNT-101", status: "Resolved", severity: "High" },
        ],
        actorRole: "Operator",
        reason: "Maintenance ticket MNT-101 resolved and verified",
      });
      expect(resolvedCase.valid).toBe(true);

      const overrideCase = validateMachineStatusTransition({
        currentStatus: "Warning",
        nextStatus: "Running",
        unresolvedMaintenanceRequests: [
          { id: "MNT-102", status: "Assigned", severity: "Low" },
        ],
        actorRole: "Supervisor",
        authorizedOverride: true,
        reason: "Supervisor approved temporary run prior to scheduled stop",
      });
      expect(overrideCase.valid).toBe(true);
    });
  });

  // 4. Maintenance workflow transitions
  describe("Maintenance Workflow State Machine", () => {
    it("enforces technician assignment and root cause/corrective action before resolving", () => {
      const missingAssignee = validateMaintenanceTransition({
        currentStatus: "Open",
        nextStatus: "Assigned",
        assignedTo: "",
      });
      expect(missingAssignee.valid).toBe(false);

      const missingRootCause = validateMaintenanceTransition({
        currentStatus: "In Progress",
        nextStatus: "Resolved",
        assignedTo: "Tech M. Vance",
        rootCause: "",
        correctiveAction: "Replaced sensor",
      });
      expect(missingRootCause.valid).toBe(false);

      const validResolve = validateMaintenanceTransition({
        currentStatus: "In Progress",
        nextStatus: "Resolved",
        assignedTo: "Tech M. Vance",
        rootCause: "Photoelectric retro-reflector fouled with adhesive dust",
        correctiveAction:
          "Cleaned optic lens, recalibrated gain threshold, verified 50 cycles",
      });
      expect(validResolve.valid).toBe(true);
    });
  });

  // 5. Inventory stock validation
  describe("Inventory Stock Transaction Validation", () => {
    it("prevents stock from becoming negative during material issue", () => {
      const res = validateInventoryTransaction({
        currentBalance: 120,
        transactionType: "Issue",
        quantity: 150,
        reason: "Issue to Line 1 WO-1001",
      });
      expect(res.valid).toBe(false);
      expect(res.newBalance).toBe(120);
      expect(res.error).toContain("Insufficient stock");
    });

    it("accurately updates balance and delta for receipts, issues, and signed adjustments", () => {
      const receipt = validateInventoryTransaction({
        currentBalance: 100,
        transactionType: "Receipt",
        quantity: 250,
        reason: "PO-88412 Delivery",
      });
      expect(receipt.valid).toBe(true);
      expect(receipt.newBalance).toBe(350);
      expect(receipt.quantityDelta).toBe(250);

      const issue = validateInventoryTransaction({
        currentBalance: 350,
        transactionType: "Issue",
        quantity: 150,
        reason: "Line 1 consumption",
      });
      expect(issue.valid).toBe(true);
      expect(issue.newBalance).toBe(200);
      expect(issue.quantityDelta).toBe(-150);

      const adjustment = validateInventoryTransaction({
        currentBalance: 200,
        transactionType: "Adjustment",
        quantity: -15,
        reason: "Cycle count variance — damaged outer layer",
      });
      expect(adjustment.valid).toBe(true);
      expect(adjustment.newBalance).toBe(185);
      expect(adjustment.quantityDelta).toBe(-15);
    });
  });

  // 6. Downtime calculations (non-overlapping interval merging)
  describe("Downtime Calculation Without Double-Counting", () => {
    it("merges overlapping downtime intervals so overlapping events are never double-counted", () => {
      // Event 1: 10:00 to 10:30 (30 min)
      // Event 2: 10:15 to 10:45 (30 min, overlaps 15 min with Event 1 -> merged 10:00..10:45 = 45 min)
      // Event 3: 11:00 to 11:15 (15 min -> total = 60 min)
      const totalMin = calculateNonOverlappingDowntimeMinutes([
        {
          start: "2026-10-29T10:00:00Z",
          end: "2026-10-29T10:30:00Z",
        },
        {
          start: "2026-10-29T10:15:00Z",
          end: "2026-10-29T10:45:00Z",
        },
        {
          start: "2026-10-29T11:00:00Z",
          end: "2026-10-29T11:15:00Z",
        },
      ]);
      expect(totalMin).toBe(60);
    });
  });

  // 7. Simulation pause and resume & 8. Product movement between stations
  describe("Digital Twin Deterministic Simulation Engine", () => {
    it("supports start, pause, resume, and reset without corrupting production state", () => {
      let state = createInitialSimulationState();
      expect(state.status).toBe("Idle");

      state = startSimulation(state);
      expect(state.status).toBe("Running");

      // Step 4 seconds of simulated time
      state = stepSimulation(state, 2.0);
      state = stepSimulation(state, 2.0);
      const simTimeAtPause = state.simTimeSec;
      const productsSnapshot = JSON.stringify(state.products);
      expect(simTimeAtPause).toBeCloseTo(4.0, 2);

      // Pause and verify stepping while paused does NOT alter state
      state = pauseSimulation(state);
      expect(state.status).toBe("Paused");
      const steppedWhilePaused = stepSimulation(state, 5.0);
      expect(steppedWhilePaused.simTimeSec).toBe(simTimeAtPause);
      expect(JSON.stringify(steppedWhilePaused.products)).toBe(
        productsSnapshot
      );

      // Resume and advance further
      state = startSimulation(steppedWhilePaused);
      expect(state.status).toBe("Running");
      state = stepSimulation(state, 2.0);
      expect(state.simTimeSec).toBeCloseTo(6.0, 2);
    });

    it("moves products across Stations A-E, enforces single-station ownership, and scales simulated time with speedMultiplier", () => {
      // Compare 10s at 1x speed vs 5s wall-clock at 2x speed -> must produce identical deterministic state!
      let state1x = startSimulation(createInitialSimulationState(undefined, 999));
      for (let i = 0; i < 10; i++) {
        state1x = stepSimulation(state1x, 1.0);
      }

      let state2x = setSimulationSpeed(
        startSimulation(createInitialSimulationState(undefined, 999)),
        2.0
      );
      for (let i = 0; i < 5; i++) {
        state2x = stepSimulation(state2x, 1.0);
      }

      expect(state1x.simTimeSec).toBeCloseTo(10.0, 2);
      expect(state2x.simTimeSec).toBeCloseTo(10.0, 2);
      expect(state1x.totalProcessed).toBe(state2x.totalProcessed);
      expect(state1x.totalGood).toBe(state2x.totalGood);
      expect(state1x.totalProcessed).toBeGreaterThan(0);

      // Verify no product is ever active in two stations simultaneously
      const activeIds = Object.values(state1x.stationMetrics)
        .map((m) => m.activeProductId)
        .filter(Boolean);
      const uniqueActiveIds = new Set(activeIds);
      expect(activeIds.length).toBe(uniqueActiveIds.size);
    });

    it("blocks upstream stations when a downstream station enters Error state", () => {
      let state = startSimulation(createInitialSimulationState(undefined, 123));
      // Put Station C into Error state
      state = syncSimulationStationsFromMachines(state, [
        {
          id: "MCH-STA-A",
          name: "A",
          lineId: "LINE-PKG-01",
          stationCode: "Station A",
          stationOrder: 1,
          machineType: "Product Feeding",
          status: "Running",
          capacityPerHour: 700,
          currentOutput: 0,
          goodQuantity: 0,
          defectQuantity: 0,
          downtimeMinutesToday: 0,
          dataSource: "Simulation",
          standardProcessingTimeSec: 1.5,
          stationBufferCapacity: 2,
          lastStatusChange: new Date().toISOString(),
          sopCode: "SOP-1",
        },
        {
          id: "MCH-STA-B",
          name: "B",
          lineId: "LINE-PKG-01",
          stationCode: "Station B",
          stationOrder: 2,
          machineType: "Quality Inspection",
          status: "Running",
          capacityPerHour: 700,
          currentOutput: 0,
          goodQuantity: 0,
          defectQuantity: 0,
          downtimeMinutesToday: 0,
          dataSource: "Simulation",
          standardProcessingTimeSec: 1.5,
          stationBufferCapacity: 2,
          lastStatusChange: new Date().toISOString(),
          sopCode: "SOP-2",
        },
        {
          id: "MCH-STA-C",
          name: "C",
          lineId: "LINE-PKG-01",
          stationCode: "Station C",
          stationOrder: 3,
          machineType: "Box Forming",
          status: "Error",
          capacityPerHour: 700,
          currentOutput: 0,
          goodQuantity: 0,
          defectQuantity: 0,
          downtimeMinutesToday: 0,
          dataSource: "Simulation",
          standardProcessingTimeSec: 1.5,
          stationBufferCapacity: 2,
          lastStatusChange: new Date().toISOString(),
          sopCode: "SOP-3",
        },
        {
          id: "MCH-STA-D",
          name: "D",
          lineId: "LINE-PKG-01",
          stationCode: "Station D",
          stationOrder: 4,
          machineType: "Packing",
          status: "Running",
          capacityPerHour: 700,
          currentOutput: 0,
          goodQuantity: 0,
          defectQuantity: 0,
          downtimeMinutesToday: 0,
          dataSource: "Simulation",
          standardProcessingTimeSec: 1.5,
          stationBufferCapacity: 2,
          lastStatusChange: new Date().toISOString(),
          sopCode: "SOP-4",
        },
        {
          id: "MCH-STA-E",
          name: "E",
          lineId: "LINE-PKG-01",
          stationCode: "Station E",
          stationOrder: 5,
          machineType: "Sealing",
          status: "Running",
          capacityPerHour: 700,
          currentOutput: 0,
          goodQuantity: 0,
          defectQuantity: 0,
          downtimeMinutesToday: 0,
          dataSource: "Simulation",
          standardProcessingTimeSec: 1.5,
          stationBufferCapacity: 2,
          lastStatusChange: new Date().toISOString(),
          sopCode: "SOP-5",
        },
      ]);

      for (let i = 0; i < 8; i++) {
        state = stepSimulation(state, 1.0);
      }

      // Station B should become blocked because Station C is in Error
      expect(state.stationMetrics["MCH-STA-B"].blocked).toBe(true);
    });
  });

  // 9. Defect rate calculations & 10. OEE formulas
  describe("Quality Defect Rate & OEE Calculations", () => {
    it("validates quality inspections and flags defect rates exceeding threshold", () => {
      const passCheck = validateQualityInspection({
        sampleSize: 200,
        defectQuantity: 2,
        thresholdPct: 2.5,
      });
      expect(passCheck.valid).toBe(true);
      expect(passCheck.defectRatePct).toBe(1.0);
      expect(passCheck.exceedsThreshold).toBe(false);
      expect(passCheck.suggestedResult).toBe("Pass");

      const failCheck = validateQualityInspection({
        sampleSize: 100,
        defectQuantity: 6,
        thresholdPct: 2.5,
      });
      expect(failCheck.valid).toBe(true);
      expect(failCheck.defectRatePct).toBe(6.0);
      expect(failCheck.exceedsThreshold).toBe(true);
      expect(failCheck.suggestedResult).toBe("Fail");

      expect(calculateDefectRatePct(15, 500)).toBe(3.0);
    });

    it("computes OEE (Availability x Performance x Quality) accurately", () => {
      // Planned = 480 min, Downtime = 48 min -> RunTime = 432 min (Availability = 90.0%)
      // RunTimeSec = 25,920s. TotalProduced = 4,104 units, IdealCycleTime = 6.0s -> Ideal time = 24,624s -> Performance = 95.0%
      // GoodUnits = 4,022 / 4,104 -> Quality = 98.0%
      // OEE = 0.90 * 0.95 * 0.98 = 83.8%
      const oee = calculateOEE({
        plannedProductionMinutes: 480,
        downtimeMinutes: 48,
        totalProducedUnits: 4104,
        goodUnits: 4022,
        idealCycleTimeSeconds: 6.0,
      });
      expect(oee.available).toBe(true);
      expect(oee.availabilityPct).toBe(90.0);
      expect(oee.performancePct).toBe(95.0);
      expect(oee.qualityPct).toBe(98.0);
      expect(oee.oeePct).toBe(83.8);
    });

    it("enforces role-based permissions accurately", () => {
      expect(hasPermission("Operator", "production:record")).toBe(true);
      expect(hasPermission("Operator", "work_order:create")).toBe(false);
      expect(hasPermission("Supervisor", "work_order:create")).toBe(true);
    });
  });
});
