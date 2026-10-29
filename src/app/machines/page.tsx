"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useFactoryStore } from "@/lib/store/factory-store";
import { MachineStatus } from "@/lib/domain/types";
import {
  DataSourceBadge,
  MachineStatusBadge,
  MaintenanceStatusBadge,
  PriorityBadge,
} from "@/components/ui/badges";
import {
  Activity,
  AlertTriangle,
  Box,
  Clock,
  Cpu,
  Filter,
  History,
  Search,
  ShieldAlert,
  Thermometer,
  Wrench,
} from "lucide-react";

const MACHINE_STATUSES: MachineStatus[] = [
  "Running",
  "Idle",
  "Warning",
  "Error",
  "Maintenance",
];

export default function MachinesPage() {
  const {
    machines,
    machineStatusEvents,
    productionRecords,
    maintenanceRequests,
    selectedLineId,
    updateMachineStatus,
    currentUser,
  } = useFactoryStore();

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMachineId, setSelectedMachineId] = useState<string>(
    machines[0]?.id || "MCH-STA-C"
  );

  // Status update form state
  const [nextStatus, setNextStatus] = useState<MachineStatus>("Running");
  const [reason, setReason] = useState("");
  const [authorizedOverride, setAuthorizedOverride] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const filteredMachines = useMemo(() => {
    return machines.filter((m) => {
      if (selectedLineId !== "ALL" && m.lineId !== selectedLineId) {
        return false;
      }
      if (statusFilter !== "ALL" && m.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = m.id.toLowerCase().includes(q);
        const matchName = m.name.toLowerCase().includes(q);
        const matchStation = m.stationCode.toLowerCase().includes(q);
        const matchType = m.machineType.toLowerCase().includes(q);
        if (!matchId && !matchName && !matchStation && !matchType) {
          return false;
        }
      }
      return true;
    });
  }, [machines, selectedLineId, statusFilter, searchQuery]);

  const selectedMachine = useMemo(
    () =>
      machines.find((m) => m.id === selectedMachineId) ||
      filteredMachines[0] ||
      machines[0],
    [machines, selectedMachineId, filteredMachines]
  );

  const selectedMachineEvents = useMemo(
    () =>
      machineStatusEvents.filter((e) => e.machineId === selectedMachine?.id),
    [machineStatusEvents, selectedMachine]
  );

  const selectedMachineRecords = useMemo(
    () =>
      productionRecords.filter((r) => r.machineId === selectedMachine?.id),
    [productionRecords, selectedMachine]
  );

  const selectedMachineMaintenance = useMemo(
    () =>
      maintenanceRequests.filter((r) => r.machineId === selectedMachine?.id),
    [maintenanceRequests, selectedMachine]
  );

  const hasActiveBreakdown = useMemo(
    () =>
      selectedMachineMaintenance.some((r) =>
        ["Open", "Assigned", "In Progress", "Waiting for Parts"].includes(
          r.status
        )
      ),
    [selectedMachineMaintenance]
  );

  function handleStatusSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMachine) return;
    setStatusError(null);

    const res = updateMachineStatus({
      machineId: selectedMachine.id,
      nextStatus,
      reason,
      authorizedOverride,
      dataSource: "Manual",
    });

    if (!res.ok) {
      setStatusError(res.error || "Status update rejected.");
      return;
    }

    setReason("");
    setAuthorizedOverride(false);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-blue-600" />
            Machine Registry & Station Telemetry
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Monitor packaging stations, inspect status audit logs, and execute
            safety-interlocked state transitions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/maintenance"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium hover:bg-slate-50"
          >
            <Wrench className="w-3.5 h-3.5 text-rose-500" />
            Report Breakdown
          </Link>
          <Link
            href="/digital-twin"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-900 dark:bg-slate-800 text-white text-xs font-medium border border-slate-700"
          >
            <Box className="w-3.5 h-3.5 text-blue-400" />
            View in 3D Digital Twin
          </Link>
        </div>
      </div>

      {/* Search & Status Filter */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Machine ID, Station Code, Name, or Type..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-500">Status:</span>
          <select
            aria-label="Filter by Machine Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
          >
            <option value="ALL">All States</option>
            {MACHINE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Layout: Machine Registry List (Left 7 cols) + Machine Detail Inspector (Right 5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Machine Cards / Table */}
        <div className="lg:col-span-7 space-y-3">
          {filteredMachines.map((m) => {
            const isSelected = selectedMachine?.id === m.id;
            return (
              <div
                key={m.id}
                data-testid={`machine-card-${m.id}`}
                onClick={() => {
                  setSelectedMachineId(m.id);
                  setNextStatus(m.status);
                  setStatusError(null);
                }}
                className={`cursor-pointer rounded-md border p-4 transition-all ${
                  isSelected
                    ? "bg-blue-50/40 dark:bg-blue-950/20 border-blue-500 ring-1 ring-blue-500"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono text-[11px] font-bold">
                        {m.stationCode}
                      </span>
                      <span className="font-mono text-xs text-slate-500">
                        {m.id}
                      </span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs font-mono text-slate-500">
                        {m.lineId}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">
                      {m.name}
                    </h3>
                    <p className="text-xs text-slate-500">{m.machineType}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <DataSourceBadge source={m.dataSource} />
                    <MachineStatusBadge status={m.status} />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-mono">
                  <div>
                    <div className="text-[10px] text-slate-400 font-sans">
                      Capacity
                    </div>
                    <div className="font-semibold">{m.capacityPerHour}/hr</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-sans">
                      Total Output
                    </div>
                    <div className="font-semibold">
                      {m.currentOutput.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-sans">
                      Good Units
                    </div>
                    <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {m.goodQuantity.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-sans">
                      Defective
                    </div>
                    <div className="font-semibold text-rose-500">
                      {m.defectQuantity}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-sans">
                      Downtime Today
                    </div>
                    <div className="font-semibold text-amber-600 dark:text-amber-400">
                      {m.downtimeMinutesToday} min
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Detailed Inspector Panel */}
        {selectedMachine && (
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 shadow-sm space-y-5 h-fit sticky top-20">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                  {selectedMachine.id} • {selectedMachine.stationCode}
                </span>
                <MachineStatusBadge status={selectedMachine.status} />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1">
                {selectedMachine.name}
              </h2>
              <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-slate-500 font-mono">
                <span>SOP: {selectedMachine.sopCode}</span>
                {selectedMachine.temperatureC !== undefined && (
                  <span className="inline-flex items-center gap-1">
                    <Thermometer className="w-3 h-3 text-amber-500" />
                    {selectedMachine.temperatureC}°C
                  </span>
                )}
                {selectedMachine.vibrationMmPerSec !== undefined && (
                  <span className="inline-flex items-center gap-1">
                    <Activity className="w-3 h-3 text-blue-500" />
                    {selectedMachine.vibrationMmPerSec} mm/s
                  </span>
                )}
              </div>
            </div>

            {/* Manual Status Update with Audit Logging & Safety Interlock */}
            <form
              onSubmit={handleStatusSubmit}
              className="p-3 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3"
            >
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                <span>Manual Status Update (Audited)</span>
                <span className="text-[10px] font-normal text-slate-500">
                  Actor: {currentUser.role}
                </span>
              </div>

              {hasActiveBreakdown && (
                <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <span>
                    <strong>Safety Interlock Active:</strong> This station has
                    unresolved maintenance ticket(s). Returning to{" "}
                    <code>Running</code> requires resolving the ticket first or
                    an authorized Supervisor/Maintenance release.
                  </span>
                </div>
              )}

              {statusError && (
                <div className="p-2 rounded bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300">
                  {statusError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium mb-1">
                    Target Status
                  </label>
                  <select
                    data-testid="machine-next-status-select"
                    value={nextStatus}
                    onChange={(e) =>
                      setNextStatus(e.target.value as MachineStatus)
                    }
                    className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  >
                    {MACHINE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium mb-1">
                    Audit Reason *
                  </label>
                  <input
                    type="text"
                    data-testid="machine-status-reason-input"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Cleared jam & verified guard"
                    className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    required
                  />
                </div>
              </div>

              {hasActiveBreakdown && nextStatus === "Running" && (
                <label className="flex items-center gap-2 text-[11px] text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={authorizedOverride}
                    onChange={(e) => setAuthorizedOverride(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Authorized Maintenance/Supervisor Safety Release Override
                </label>
              )}

              <button
                type="submit"
                data-testid="submit-machine-status-btn"
                className="w-full py-1.5 px-3 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
              >
                Apply Status Transition
              </button>
            </form>

            {/* Related Maintenance Requests */}
            <div>
              <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 mb-2">
                <Wrench className="w-3.5 h-3.5 text-rose-500" />
                Related Maintenance History (
                {selectedMachineMaintenance.length})
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {selectedMachineMaintenance.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    No maintenance tickets recorded for this machine.
                  </p>
                ) : (
                  selectedMachineMaintenance.map((req) => (
                    <div
                      key={req.id}
                      className="p-2 rounded border border-slate-200 dark:border-slate-800 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold">{req.id}</span>
                        <div className="flex items-center gap-1">
                          <PriorityBadge priority={req.severity} />
                          <MaintenanceStatusBadge status={req.status} />
                        </div>
                      </div>
                      <div className="text-[11px] font-medium mt-1">
                        {req.category}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {req.description}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Status Change History */}
            <div>
              <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 mb-2">
                <History className="w-3.5 h-3.5 text-blue-500" />
                Status Transition Audit Log ({selectedMachineEvents.length})
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {selectedMachineEvents.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    No recent status transitions logged.
                  </p>
                ) : (
                  selectedMachineEvents.map((evt) => (
                    <div
                      key={evt.id}
                      className="p-2 rounded border border-slate-200 dark:border-slate-800 text-xs"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-mono font-semibold">
                          {evt.previousStatus} &rarr; {evt.newStatus}
                        </span>
                        <span className="text-slate-400 font-mono">
                          {new Date(evt.startedAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                        {evt.reason}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        By {evt.changedBy} ({evt.dataSource})
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Related Production Output */}
            <div>
              <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 mb-2">
                <Clock className="w-3.5 h-3.5 text-emerald-500" />
                Related Station Output Records ({selectedMachineRecords.length})
              </h3>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {selectedMachineRecords.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800/40 text-xs font-mono"
                  >
                    <span>
                      {rec.id} ({rec.hourSlot})
                    </span>
                    <span>
                      <strong className="text-emerald-600">
                        +{rec.goodQuantity}
                      </strong>{" "}
                      / <span className="text-rose-500">{rec.defectiveQuantity}</span>
                    </span>
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
