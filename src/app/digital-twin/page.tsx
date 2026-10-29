"use client";

import React, { Component, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useFactoryStore } from "@/lib/store/factory-store";
import { MachineStatus } from "@/lib/domain/types";
import { MachineStatusBadge } from "@/components/ui/badges";
import {
  Activity,
  AlertTriangle,
  Box,
  Clock,
  FastForward,
  Info,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  Wrench,
} from "lucide-react";

const PackagingLineScene = dynamic(
  () =>
    import("@/components/digital-twin/packaging-line-scene").then(
      (mod) => mod.PackagingLineScene
    ),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[480px] rounded-md bg-slate-950 border border-slate-800 flex items-center justify-center text-xs text-slate-400 font-mono">
        Initializing 3D Packaging Line Digital Twin Scene...
      </div>
    ),
  }
);

class WebGLErrorBoundary extends Component<
  {
    fallback: React.ReactNode;
    children: React.ReactNode;
  },
  { hasError: boolean }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export default function DigitalTwinPage() {
  const {
    machines,
    simState,
    startDigitalTwin,
    pauseDigitalTwin,
    resetDigitalTwin,
    setDigitalTwinSpeed,
    triggerSimulatedStationFault,
  } = useFactoryStore();

  const [selectedStationId, setSelectedStationId] = useState<string>("MCH-STA-C");

  const selectedStation = useMemo(
    () =>
      simState.stations.find((s) => s.stationId === selectedStationId) ||
      simState.stations[0],
    [simState.stations, selectedStationId]
  );

  const selectedCanonicalMachine = useMemo(
    () => machines.find((m) => m.id === selectedStation?.stationId),
    [machines, selectedStation]
  );

  const selectedMetrics = useMemo(
    () =>
      selectedStation
        ? simState.stationMetrics[selectedStation.stationId]
        : undefined,
    [simState.stationMetrics, selectedStation]
  );

  return (
    <div className="space-y-6">
      {/* Header & Top Simulation Control Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Box className="w-5 h-5 text-blue-600" />
            3D Digital Twin — Line 1 Packaging Conveyor (Stations A–E)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Deterministic fixed-step packaging line simulation synchronized with
            canonical plant machine states.
          </p>
        </div>

        {/* Simulation Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            data-testid="sim-status-badge"
            className={`px-2.5 py-1.5 rounded text-xs font-mono font-bold border ${
              simState.status === "Running"
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                : simState.status === "Paused"
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                : "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30"
            }`}
          >
            SIM: {simState.status.toUpperCase()} ({simState.simTimeSec.toFixed(1)}s)
          </div>

          {simState.status !== "Running" ? (
            <button
              type="button"
              data-testid="sim-start-btn"
              onClick={startDigitalTwin}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm"
            >
              <Play className="w-3.5 h-3.5" />
              {simState.status === "Paused" ? "Resume" : "Start Simulation"}
            </button>
          ) : (
            <button
              type="button"
              data-testid="sim-pause-btn"
              onClick={pauseDigitalTwin}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-sm"
            >
              <Pause className="w-3.5 h-3.5" />
              Pause
            </button>
          )}

          <button
            type="button"
            data-testid="sim-reset-btn"
            onClick={resetDigitalTwin}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium hover:bg-slate-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>

          {/* Speed Multiplier Selector */}
          <div className="inline-flex items-center rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-0.5 text-xs">
            <FastForward className="w-3.5 h-3.5 text-slate-400 mx-1.5" />
            {[0.5, 1, 2, 4].map((spd) => (
              <button
                key={spd}
                type="button"
                data-testid={`sim-speed-${spd}x`}
                onClick={() => setDigitalTwinSpeed(spd)}
                className={`px-2 py-1 rounded font-mono text-[11px] font-semibold ${
                  simState.speedMultiplier === spd
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Simulation KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-3">
          <div className="text-[11px] text-slate-500">Simulated Clock</div>
          <div
            data-testid="sim-clock-value"
            className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-0.5"
          >
            {simState.simTimeSec.toFixed(1)}s
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-3">
          <div className="text-[11px] text-slate-500">Units Fed (Station A)</div>
          <div className="text-xl font-bold font-mono text-blue-600 mt-0.5">
            {simState.totalSpawned}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-3">
          <div className="text-[11px] text-slate-500">
            Completed (Station E)
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-0.5">
            {simState.totalProcessed}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-3">
          <div className="text-[11px] text-slate-500">Sim Good Cartons</div>
          <div className="text-xl font-bold font-mono text-emerald-600 mt-0.5">
            {simState.totalGood}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-3">
          <div className="text-[11px] text-slate-500">Sim Rejects / Scrap</div>
          <div className="text-xl font-bold font-mono text-rose-500 mt-0.5">
            {simState.totalDefective}
          </div>
        </div>
      </div>

      {/* Main Split: 3D Scene (8 cols) + Selected Station Inspector & Failure Scenarios (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 space-y-3">
          <WebGLErrorBoundary
            fallback={
              <div
                data-testid="digital-twin-fallback"
                className="w-full h-[480px] rounded-md bg-slate-900 border border-slate-800 p-6 flex flex-col justify-between text-slate-200"
              >
                <div>
                  <h3 className="text-sm font-bold">
                    Interactive Packaging Line Topology (Stations A–E)
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    WebGL hardware context unavailable in this browser session —
                    showing synchronized interactive station schematic.
                  </p>
                </div>
                <div className="grid grid-cols-5 gap-3 my-auto">
                  {simState.stations.map((st) => (
                    <button
                      key={st.stationId}
                      type="button"
                      data-testid={`select-station-${st.stationId}`}
                      onClick={() => setSelectedStationId(st.stationId)}
                      className={`p-3 rounded border text-left ${
                        selectedStationId === st.stationId
                          ? "border-blue-500 bg-blue-950/40"
                          : "border-slate-700 bg-slate-800"
                      }`}
                    >
                      <div className="font-mono text-xs font-bold">
                        {st.stationCode}
                      </div>
                      <div className="text-[11px] text-slate-300 mt-1">
                        {st.machineType}
                      </div>
                      <div className="mt-2">
                        <MachineStatusBadge status={st.status} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            }
          >
            <PackagingLineScene
              simState={simState}
              selectedStationId={selectedStationId}
              onSelectStation={setSelectedStationId}
            />
          </WebGLErrorBoundary>

          {/* Color Legend & Modeling Assumptions */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Status Color Mapping:
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Running
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                Idle
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                Warning
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                Error
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                Maintenance
              </span>
            </div>
            <div className="text-[11px] text-slate-500 flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-blue-500" />
              Software simulation model • Fixed-step (0.2s) deterministic clock
            </div>
          </div>
        </div>

        {/* Right: Selected Machine Station Panel & Failure Scenario Injector */}
        {selectedStation && (
          <div
            data-testid="selected-station-panel"
            className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 shadow-sm flex flex-col justify-between space-y-4"
          >
            <div className="space-y-4">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                    {selectedStation.stationCode} • {selectedStation.stationId}
                  </span>
                  <MachineStatusBadge status={selectedStation.status} />
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1">
                  {selectedCanonicalMachine?.name || selectedStation.name}
                </h2>
                <p className="text-xs text-slate-500">
                  Stage {selectedStation.order} of 5 —{" "}
                  {selectedStation.machineType}
                </p>
              </div>

              {/* Station Runtime Metrics */}
              <div className="grid grid-cols-2 gap-2.5 font-mono text-xs">
                <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] font-sans text-slate-400">
                    Cycle Time
                  </div>
                  <div className="font-bold mt-0.5">
                    {selectedStation.processingTimeSec}s / unit
                  </div>
                </div>
                <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] font-sans text-slate-400">
                    Buffer Queue
                  </div>
                  <div className="font-bold mt-0.5">
                    {selectedMetrics?.queuedProductIds.length ?? 0} /{" "}
                    {selectedStation.bufferCapacity} units
                  </div>
                </div>
                <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] font-sans text-slate-400">
                    Sim Station Good
                  </div>
                  <div className="font-bold text-emerald-600 mt-0.5">
                    {selectedMetrics?.goodCount ?? 0}
                  </div>
                </div>
                <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] font-sans text-slate-400">
                    Active Carton
                  </div>
                  <div className="font-bold text-blue-600 mt-0.5">
                    {selectedMetrics?.activeProductId || "None"}
                  </div>
                </div>
              </div>

              {selectedMetrics?.blocked && (
                <div className="p-2.5 rounded bg-amber-500/15 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    Station output is currently <strong>BLOCKED</strong> by
                    downstream station stoppage or full buffer.
                  </span>
                </div>
              )}

              {/* Machine Failure Scenario Controls (Synchronized with Canonical State) */}
              <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Station Scenario & State Controls (Canonical Sync)
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Triggering a state change here updates the canonical machine
                  registry, dashboard KPIs, and 3D conveyor physics.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      "Running",
                      "Warning",
                      "Error",
                      "Maintenance",
                      "Idle",
                    ] as MachineStatus[]
                  ).map((st) => (
                    <button
                      key={st}
                      type="button"
                      data-testid={`twin-set-status-${st}`}
                      onClick={() =>
                        triggerSimulatedStationFault(
                          selectedStation.stationId,
                          st
                        )
                      }
                      className={`py-1.5 px-2.5 rounded text-xs font-medium border transition-colors ${
                        selectedStation.status === st
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:border-blue-500"
                      }`}
                    >
                      Set {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Simulation Event Stream */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                Simulation Event History ({simState.events.length})
              </h3>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {simState.events.slice(0, 15).map((evt) => (
                  <div
                    key={evt.id}
                    className="p-2 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-[11px]"
                  >
                    <div className="flex justify-between font-mono text-[10px] text-slate-400">
                      <span>t = {evt.simTimeSec.toFixed(1)}s</span>
                      <span>{evt.type}</span>
                    </div>
                    <div className="text-slate-700 dark:text-slate-200 mt-0.5">
                      {evt.message}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
