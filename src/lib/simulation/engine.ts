import { Machine, MachineStatus } from "../domain/types";

/**
 * Deterministic Fixed-Step Packaging Line Simulation Engine
 * =========================================================
 * Assumptions & Modeling Notes:
 * 1. The packaging line consists of 5 sequential stations (Station A -> B -> C -> D -> E).
 * 2. Each product unit has a unique ID, current position index/progress along the conveyor,
 *    and an exclusive assignment (`currentStationId` or `inTransitToStationId`) so a product
 *    can NEVER be processed by multiple stations simultaneously.
 * 3. Each station has a configurable `processingTimeSec` and `bufferCapacity`.
 * 4. If a downstream station is in `Error` or `Maintenance` (or its input buffer is full),
 *    upstream products block in transit / station output buffer without disappearing or double-counting.
 * 5. Simulation speed (`speedMultiplier`, e.g., 0.5x, 1x, 2x, 4x) scales the advancing simulation clock
 *    (`simTimeSec`) and drives fixed sub-steps (`FIXED_STEP_SEC = 0.2`), ensuring identical production physics
 *    per simulated second rather than artificially multiplying counters.
 */

export const FIXED_STEP_SEC = 0.2;

export interface SimStationConfig {
  stationId: string; // e.g. "MCH-STA-A"
  stationCode: string; // "Station A"
  name: string;
  order: number; // 1..5
  machineType: string;
  processingTimeSec: number;
  bufferCapacity: number;
  status: MachineStatus;
  defectProbability: number; // e.g., 0.02 at Station B
}

export interface SimProductItem {
  id: string;
  serialNumber: number;
  /**
   * Exclusive location state:
   * - "in_station": actively being processed at `stationId`
   * - "queued": waiting in input buffer of `stationId`
   * - "transit": moving on conveyor toward `stationId`
   * - "completed": exited Station E
   * - "rejected": diverted at Quality Inspection (Station B) or defective output
   */
  phase: "queued" | "in_station" | "transit" | "completed" | "rejected";
  stationId: string; // Target or current station ID
  stationOrder: number; // 1..5
  progress: number; // 0..1 within current phase (transit or processing)
  isDefective: boolean;
  defectReason?: string;
  spawnedAtSimSec: number;
  completedAtSimSec?: number;
}

export interface SimEvent {
  id: string;
  simTimeSec: number;
  stationId?: string;
  type:
    | "SIM_START"
    | "SIM_PAUSE"
    | "SIM_RESUME"
    | "SIM_RESET"
    | "PRODUCT_SPAWNED"
    | "PRODUCT_COMPLETED"
    | "PRODUCT_DEFECT"
    | "STATION_BLOCKED"
    | "STATION_FAILURE"
    | "STATION_RECOVERED";
  severity: "info" | "warning" | "error" | "success";
  message: string;
}

export interface StationRuntimeMetrics {
  stationId: string;
  processedCount: number;
  goodCount: number;
  defectCount: number;
  activeProductId: string | null;
  queuedProductIds: string[];
  blocked: boolean;
  utilizationTicks: number;
  totalTicks: number;
}

export interface PackagingLineSimState {
  status: "Idle" | "Running" | "Paused";
  speedMultiplier: number; // 0.5, 1, 2, 4
  simTimeSec: number;
  accumulatorSec: number;
  spawnIntervalSec: number;
  timeSinceLastSpawnSec: number;
  nextSerialNumber: number;
  rngState: number;
  stations: SimStationConfig[];
  stationMetrics: Record<string, StationRuntimeMetrics>;
  products: SimProductItem[];
  totalSpawned: number;
  totalProcessed: number;
  totalGood: number;
  totalDefective: number;
  events: SimEvent[];
}

const DEFAULT_STATIONS: SimStationConfig[] = [
  {
    stationId: "MCH-STA-A",
    stationCode: "Station A",
    name: "Product Feeding",
    order: 1,
    machineType: "Product Feeding",
    processingTimeSec: 1.8,
    bufferCapacity: 5,
    status: "Running",
    defectProbability: 0.005,
  },
  {
    stationId: "MCH-STA-B",
    stationCode: "Station B",
    name: "Quality Inspection",
    order: 2,
    machineType: "Quality Inspection",
    processingTimeSec: 2.0,
    bufferCapacity: 5,
    status: "Running",
    defectProbability: 0.03,
  },
  {
    stationId: "MCH-STA-C",
    stationCode: "Station C",
    name: "Box Forming",
    order: 3,
    machineType: "Box Forming",
    processingTimeSec: 2.2,
    bufferCapacity: 5,
    status: "Warning",
    defectProbability: 0.015,
  },
  {
    stationId: "MCH-STA-D",
    stationCode: "Station D",
    name: "Packing",
    order: 4,
    machineType: "Packing",
    processingTimeSec: 2.0,
    bufferCapacity: 5,
    status: "Running",
    defectProbability: 0.01,
  },
  {
    stationId: "MCH-STA-E",
    stationCode: "Station E",
    name: "Sealing and Finished Goods",
    order: 5,
    machineType: "Sealing and Finished Goods",
    processingTimeSec: 1.8,
    bufferCapacity: 6,
    status: "Running",
    defectProbability: 0.01,
  },
];

function nextRandom(rngState: number): { value: number; nextState: number } {
  // Deterministic Mulberry32-style step
  const nextState = (rngState + 0x6d2b79f5) | 0;
  let t = Math.imul(nextState ^ (nextState >>> 15), 1 | nextState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, nextState };
}

export function createInitialSimulationState(
  machines?: Machine[],
  seed: number = 42026
): PackagingLineSimState {
  const stations: SimStationConfig[] =
    machines && machines.length > 0
      ? machines
          .filter((m) => m.lineId === "LINE-PKG-01")
          .sort((a, b) => a.stationOrder - b.stationOrder)
          .map((m) => ({
            stationId: m.id,
            stationCode: m.stationCode,
            name: m.name,
            order: m.stationOrder,
            machineType: m.machineType,
            processingTimeSec: m.standardProcessingTimeSec || 2.0,
            bufferCapacity: m.stationBufferCapacity || 5,
            status: m.status,
            defectProbability: m.stationOrder === 2 ? 0.03 : 0.01,
          }))
      : DEFAULT_STATIONS.map((s) => ({ ...s }));

  const stationMetrics: Record<string, StationRuntimeMetrics> = {};
  for (const st of stations) {
    stationMetrics[st.stationId] = {
      stationId: st.stationId,
      processedCount: 0,
      goodCount: 0,
      defectCount: 0,
      activeProductId: null,
      queuedProductIds: [],
      blocked: false,
      utilizationTicks: 0,
      totalTicks: 0,
    };
  }

  // Seed 4 initial boxes along the line so the 3D view is immediately informative
  const initialProducts: SimProductItem[] = [];
  let serial = 1001;
  for (let i = 0; i < Math.min(4, stations.length); i++) {
    const st = stations[i];
    if (st.status === "Running" || st.status === "Warning") {
      const prodId = `BOX-${serial}`;
      initialProducts.push({
        id: prodId,
        serialNumber: serial,
        phase: "in_station",
        stationId: st.stationId,
        stationOrder: st.order,
        progress: 0.35,
        isDefective: false,
        spawnedAtSimSec: 0,
      });
      stationMetrics[st.stationId].activeProductId = prodId;
      serial++;
    }
  }

  return {
    status: "Idle",
    speedMultiplier: 1,
    simTimeSec: 0,
    accumulatorSec: 0,
    spawnIntervalSec: 2.6,
    timeSinceLastSpawnSec: 0,
    nextSerialNumber: serial,
    rngState: seed,
    stations,
    stationMetrics,
    products: initialProducts,
    totalSpawned: initialProducts.length,
    totalProcessed: 0,
    totalGood: 0,
    totalDefective: 0,
    events: [
      {
        id: "EVT-INIT",
        simTimeSec: 0,
        type: "SIM_RESET",
        severity: "info",
        message:
          "Digital Twin simulation initialized and synchronized with Line 1 stations (A-E).",
      },
    ],
  };
}

function appendEvent(
  events: SimEvent[],
  event: Omit<SimEvent, "id">
): SimEvent[] {
  const newEvt: SimEvent = {
    ...event,
    id: `SIM-EVT-${Math.round(event.simTimeSec * 10)}-${events.length + 1}`,
  };
  return [newEvt, ...events].slice(0, 60);
}

export function startSimulation(
  state: PackagingLineSimState
): PackagingLineSimState {
  if (state.status === "Running") {
    return state;
  }
  const isResume = state.status === "Paused" && state.simTimeSec > 0;
  return {
    ...state,
    status: "Running",
    events: appendEvent(state.events, {
      simTimeSec: Number(state.simTimeSec.toFixed(1)),
      type: isResume ? "SIM_RESUME" : "SIM_START",
      severity: "info",
      message: isResume
        ? `Simulation resumed at ${state.simTimeSec.toFixed(1)}s (${state.speedMultiplier}x speed).`
        : `Simulation started at ${state.speedMultiplier}x speed.`,
    }),
  };
}

export function pauseSimulation(
  state: PackagingLineSimState
): PackagingLineSimState {
  if (state.status !== "Running") {
    return state;
  }
  return {
    ...state,
    status: "Paused",
    events: appendEvent(state.events, {
      simTimeSec: Number(state.simTimeSec.toFixed(1)),
      type: "SIM_PAUSE",
      severity: "info",
      message: `Simulation paused at ${state.simTimeSec.toFixed(1)}s. Production state preserved.`,
    }),
  };
}

export function setSimulationSpeed(
  state: PackagingLineSimState,
  speedMultiplier: number
): PackagingLineSimState {
  const clamped = Math.max(0.25, Math.min(8, speedMultiplier));
  return {
    ...state,
    speedMultiplier: clamped,
  };
}

export function syncSimulationStationsFromMachines(
  state: PackagingLineSimState,
  machines: Machine[]
): PackagingLineSimState {
  const lineMachines = machines
    .filter((m) => m.lineId === "LINE-PKG-01")
    .sort((a, b) => a.stationOrder - b.stationOrder);

  if (lineMachines.length === 0) return state;

  let updatedEvents = state.events;
  const updatedStations = state.stations.map((st) => {
    const match = lineMachines.find((m) => m.id === st.stationId);
    if (!match) return st;
    if (match.status !== st.status) {
      const isFailure =
        match.status === "Error" || match.status === "Maintenance";
      updatedEvents = appendEvent(updatedEvents, {
        simTimeSec: Number(state.simTimeSec.toFixed(1)),
        stationId: st.stationId,
        type: isFailure ? "STATION_FAILURE" : "STATION_RECOVERED",
        severity:
          match.status === "Error"
            ? "error"
            : match.status === "Warning"
            ? "warning"
            : "info",
        message: `${st.stationCode} (${st.name}) transitioned from ${st.status} to ${match.status}.`,
      });
    }
    return {
      ...st,
      status: match.status,
      processingTimeSec: match.standardProcessingTimeSec || st.processingTimeSec,
      bufferCapacity: match.stationBufferCapacity || st.bufferCapacity,
    };
  });

  return {
    ...state,
    stations: updatedStations,
    events: updatedEvents,
  };
}

function isStationOperational(status: MachineStatus): boolean {
  return status === "Running" || status === "Warning";
}

function effectiveProcessingTime(station: SimStationConfig): number {
  // Warning status runs 25% slower due to minor degraded operation
  return station.status === "Warning"
    ? station.processingTimeSec * 1.25
    : station.processingTimeSec;
}

/**
 * Advances the simulation by a single fixed time step `dt` (in simulated seconds).
 * Enforces single-station ownership per product and upstream blocking when downstream buffers fill.
 */
function advanceSingleFixedStep(
  state: PackagingLineSimState,
  dt: number
): PackagingLineSimState {
  const nextSimTime = Number((state.simTimeSec + dt).toFixed(4));
  let rng = state.rngState;
  let events = state.events;
  let totalSpawned = state.totalSpawned;
  let totalProcessed = state.totalProcessed;
  let totalGood = state.totalGood;
  let totalDefective = state.totalDefective;
  let nextSerial = state.nextSerialNumber;

  // Deep clone mutable structures
  const products: SimProductItem[] = state.products.map((p) => ({ ...p }));
  const metrics: Record<string, StationRuntimeMetrics> = {};
  for (const [k, v] of Object.entries(state.stationMetrics)) {
    metrics[k] = {
      ...v,
      queuedProductIds: [...v.queuedProductIds],
    };
  }

  const stations = [...state.stations].sort((a, b) => a.order - b.order);

  // 1. Update products in transit between stations
  const TRANSIT_DURATION_SEC = 1.2;
  for (const product of products) {
    if (product.phase === "transit") {
      const targetStation = stations.find(
        (s) => s.stationId === product.stationId
      );
      if (!targetStation) continue;

      const targetMetrics = metrics[targetStation.stationId];
      const currentOccupancy =
        targetMetrics.queuedProductIds.length +
        (targetMetrics.activeProductId ? 1 : 0);

      // Can advance to end of conveyor belt; if target station buffer has room, enter queue
      const nextProgress = product.progress + dt / TRANSIT_DURATION_SEC;
      if (nextProgress >= 1.0) {
        if (currentOccupancy < targetStation.bufferCapacity) {
          product.phase = "queued";
          product.progress = 0;
          if (!targetMetrics.queuedProductIds.includes(product.id)) {
            targetMetrics.queuedProductIds.push(product.id);
          }
        } else {
          // Hold at end of conveyor (blocked by full downstream buffer)
          product.progress = 1.0;
        }
      } else {
        product.progress = Number(nextProgress.toFixed(4));
      }
    }
  }

  // 2. Process stations from downstream (Station E) to upstream (Station A)
  // Processing downstream first ensures freed buffer slots are accurately reflected
  for (let i = stations.length - 1; i >= 0; i--) {
    const station = stations[i];
    const stMetrics = metrics[station.stationId];
    stMetrics.totalTicks += 1;

    const operational = isStationOperational(station.status);

    // If station is active with a product
    if (stMetrics.activeProductId) {
      const activeProduct = products.find(
        (p) => p.id === stMetrics.activeProductId
      );

      if (!activeProduct) {
        stMetrics.activeProductId = null;
      } else if (operational) {
        stMetrics.utilizationTicks += 1;
        const procTime = effectiveProcessingTime(station);
        const nextProgress = activeProduct.progress + dt / procTime;

        if (nextProgress < 1.0) {
          activeProduct.progress = Number(nextProgress.toFixed(4));
          stMetrics.blocked = false;
        } else {
          // Product finished processing at this station
          activeProduct.progress = 1.0;

          // Determine if next station can accept transit/queue
          const nextStation = stations[i + 1];

          // Check quality defect roll upon completing station processing
          if (!activeProduct.isDefective) {
            const roll = nextRandom(rng);
            rng = roll.nextState;
            const effectiveDefectProb =
              station.status === "Warning"
                ? station.defectProbability * 1.8
                : station.defectProbability;

            if (roll.value < effectiveDefectProb) {
              activeProduct.isDefective = true;
              activeProduct.defectReason =
                station.order === 2
                  ? "Optical checkweigher reject"
                  : station.order === 3
                  ? "Carton flap fold tolerance deviation"
                  : "Seal integrity variance";
            }
          }

          if (!nextStation) {
            // Completed final station (Station E)!
            activeProduct.phase = activeProduct.isDefective
              ? "rejected"
              : "completed";
            activeProduct.completedAtSimSec = nextSimTime;
            stMetrics.activeProductId = null;
            stMetrics.blocked = false;
            stMetrics.processedCount += 1;

            totalProcessed += 1;
            if (activeProduct.isDefective) {
              stMetrics.defectCount += 1;
              totalDefective += 1;
              events = appendEvent(events, {
                simTimeSec: Number(nextSimTime.toFixed(1)),
                stationId: station.stationId,
                type: "PRODUCT_DEFECT",
                severity: "warning",
                message: `Unit ${activeProduct.id} flagged defective at ${station.stationCode} (${activeProduct.defectReason}).`,
              });
            } else {
              stMetrics.goodCount += 1;
              totalGood += 1;
              if (totalGood % 5 === 0 || totalGood === 1) {
                events = appendEvent(events, {
                  simTimeSec: Number(nextSimTime.toFixed(1)),
                  stationId: station.stationId,
                  type: "PRODUCT_COMPLETED",
                  severity: "success",
                  message: `Unit ${activeProduct.id} completed packaging at ${station.stationCode} (Total Good: ${totalGood}).`,
                });
              }
            }
          } else {
            // Check if downstream station has capacity (including items currently in transit to it)
            const downstreamMetrics = metrics[nextStation.stationId];
            const inTransitToDownstream = products.filter(
              (p) =>
                p.phase === "transit" && p.stationId === nextStation.stationId
            ).length;
            const downstreamLoad =
              downstreamMetrics.queuedProductIds.length +
              (downstreamMetrics.activeProductId ? 1 : 0) +
              inTransitToDownstream;

            const downstreamAvailable =
              isStationOperational(nextStation.status) &&
              downstreamLoad < nextStation.bufferCapacity;

            if (downstreamAvailable) {
              // Release from current station into transit toward nextStation
              stMetrics.activeProductId = null;
              stMetrics.blocked = false;
              stMetrics.processedCount += 1;
              if (activeProduct.isDefective) {
                stMetrics.defectCount += 1;
              } else {
                stMetrics.goodCount += 1;
              }

              activeProduct.phase = "transit";
              activeProduct.stationId = nextStation.stationId;
              activeProduct.stationOrder = nextStation.order;
              activeProduct.progress = 0;
            } else {
              // Downstream blocked! Product remains held at 100% in current station
              if (!stMetrics.blocked) {
                stMetrics.blocked = true;
                events = appendEvent(events, {
                  simTimeSec: Number(nextSimTime.toFixed(1)),
                  stationId: station.stationId,
                  type: "STATION_BLOCKED",
                  severity: "warning",
                  message: `${station.stationCode} output blocked — ${nextStation.stationCode} is ${nextStation.status} or buffer full.`,
                });
              }
            }
          }
        }
      }
    }

    // 3. If station now has no active product and is operational, pull next from its queue
    if (!stMetrics.activeProductId && operational) {
      while (stMetrics.queuedProductIds.length > 0) {
        const nextProdId = stMetrics.queuedProductIds.shift()!;
        const nextProd = products.find((p) => p.id === nextProdId);
        if (nextProd && nextProd.phase === "queued") {
          nextProd.phase = "in_station";
          nextProd.stationId = station.stationId;
          nextProd.stationOrder = station.order;
          nextProd.progress = 0;
          stMetrics.activeProductId = nextProd.id;
          stMetrics.blocked = false;
          break;
        }
      }
    }
  }

  // 4. Spawn new product at Station A at regular intervals if Station A is operational and has room
  let timeSinceLastSpawn = state.timeSinceLastSpawnSec + dt;
  const firstStation = stations[0];
  if (firstStation && timeSinceLastSpawn >= state.spawnIntervalSec) {
    const stAMetrics = metrics[firstStation.stationId];
    const currentStALoad =
      stAMetrics.queuedProductIds.length +
      (stAMetrics.activeProductId ? 1 : 0);

    if (
      isStationOperational(firstStation.status) &&
      currentStALoad < firstStation.bufferCapacity
    ) {
      const newId = `BOX-${nextSerial}`;
      nextSerial += 1;
      totalSpawned += 1;
      timeSinceLastSpawn = 0;

      const newProduct: SimProductItem = {
        id: newId,
        serialNumber: nextSerial - 1,
        phase: stAMetrics.activeProductId ? "queued" : "in_station",
        stationId: firstStation.stationId,
        stationOrder: firstStation.order,
        progress: 0,
        isDefective: false,
        spawnedAtSimSec: nextSimTime,
      };

      products.push(newProduct);
      if (!stAMetrics.activeProductId) {
        stAMetrics.activeProductId = newProduct.id;
      } else {
        stAMetrics.queuedProductIds.push(newProduct.id);
      }
    }
  }

  // Prune old completed/rejected products so memory stays bounded while keeping active line items
  const activeOrRecentProducts = products.filter(
    (p) =>
      p.phase !== "completed" && p.phase !== "rejected"
        ? true
        : nextSimTime - (p.completedAtSimSec ?? nextSimTime) < 2.0
  );

  return {
    ...state,
    simTimeSec: nextSimTime,
    timeSinceLastSpawnSec: Number(timeSinceLastSpawn.toFixed(4)),
    nextSerialNumber: nextSerial,
    rngState: rng,
    stationMetrics: metrics,
    products: activeOrRecentProducts,
    totalSpawned,
    totalProcessed,
    totalGood,
    totalDefective,
    events,
  };
}

/**
 * Steps the simulation forward by `realDeltaSec` wall-clock seconds.
 * If the simulation is not in `Running` status, state is returned untouched.
 * Speed multiplier scales simulated time, which is then integrated using fixed sub-steps (`FIXED_STEP_SEC`).
 */
export function stepSimulation(
  state: PackagingLineSimState,
  realDeltaSec: number
): PackagingLineSimState {
  if (state.status !== "Running" || realDeltaSec <= 0) {
    return state;
  }

  // Cap realDeltaSec to prevent spiral of death on background tab wake
  const clampedRealDelta = Math.min(realDeltaSec, 2.0);
  const scaledSimDelta = clampedRealDelta * state.speedMultiplier;
  let totalAvailable = state.accumulatorSec + scaledSimDelta;

  let current = state;
  while (totalAvailable >= FIXED_STEP_SEC - 1e-7) {
    current = advanceSingleFixedStep(current, FIXED_STEP_SEC);
    totalAvailable -= FIXED_STEP_SEC;
  }

  return {
    ...current,
    accumulatorSec: Math.max(0, Number(totalAvailable.toFixed(5))),
  };
}
