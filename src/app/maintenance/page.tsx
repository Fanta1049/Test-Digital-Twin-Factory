"use client";

import React, { useMemo, useState } from "react";
import { useFactoryStore } from "@/lib/store/factory-store";
import { calculateNonOverlappingDowntimeMinutes } from "@/lib/domain/logic";
import {
  MaintenanceRequest,
  MaintenanceStatus,
  PriorityLevel,
} from "@/lib/domain/types";
import {
  MaintenanceStatusBadge,
  PriorityBadge,
} from "@/components/ui/badges";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  PlusCircle,
  UserCheck,
  Wrench,
} from "lucide-react";

const CATEGORIES: MaintenanceRequest["category"][] = [
  "Mechanical Jam",
  "Pneumatic Pressure Loss",
  "Optical Sensor Fault",
  "Servo Drive Overload",
  "Thermal Adhesive Unit Fault",
  "Conveyor Belt Misalignment",
  "Electrical / PLC Alarm",
];

const SEVERITIES: PriorityLevel[] = ["Low", "Medium", "High", "Critical"];

const STATUSES: MaintenanceStatus[] = [
  "Open",
  "Assigned",
  "In Progress",
  "Waiting for Parts",
  "Resolved",
  "Closed",
];

export default function MaintenancePage() {
  const {
    machines,
    maintenanceRequests,
    maintenanceLogs,
    users,
    selectedLineId,
    reportBreakdown,
    updateMaintenanceRequest,
    currentUser,
  } = useFactoryStore();

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedRequestId, setSelectedRequestId] = useState<string>(
    maintenanceRequests[0]?.id || "MNT-2001"
  );
  const [showReportModal, setShowReportModal] = useState(false);

  // Report breakdown form state
  const [machineId, setMachineId] = useState(machines[0]?.id || "MCH-STA-C");
  const [category, setCategory] = useState<MaintenanceRequest["category"]>(
    "Pneumatic Pressure Loss"
  );
  const [severity, setSeverity] = useState<PriorityLevel>("High");
  const [description, setDescription] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [putMachineInError, setPutMachineInError] = useState(true);
  const [reportError, setReportError] = useState<string | null>(null);

  // Update ticket form state
  const selectedRequest = useMemo(
    () =>
      maintenanceRequests.find((r) => r.id === selectedRequestId) ||
      maintenanceRequests[0],
    [maintenanceRequests, selectedRequestId]
  );

  const [nextStatus, setNextStatus] = useState<MaintenanceStatus>(
    selectedRequest?.status || "In Progress"
  );
  const [assignedTo, setAssignedTo] = useState(
    selectedRequest?.assignedTo || "Devon Vance"
  );
  const [rootCause, setRootCause] = useState(selectedRequest?.rootCause || "");
  const [correctiveAction, setCorrectiveAction] = useState(
    selectedRequest?.correctiveAction || ""
  );
  const [note, setNote] = useState("");
  const [restoreMachineToRunning, setRestoreMachineToRunning] = useState(true);
  const [updateError, setUpdateError] = useState<string | null>(null);

  function selectTicket(req: MaintenanceRequest) {
    setSelectedRequestId(req.id);
    setNextStatus(req.status);
    setAssignedTo(req.assignedTo || "Devon Vance");
    setRootCause(req.rootCause || "");
    setCorrectiveAction(req.correctiveAction || "");
    setNote("");
    setUpdateError(null);
  }

  const filteredRequests = useMemo(() => {
    return maintenanceRequests.filter((r) => {
      if (selectedLineId !== "ALL" && r.lineId !== selectedLineId) {
        return false;
      }
      if (statusFilter !== "ALL" && r.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [maintenanceRequests, selectedLineId, statusFilter]);

  const nonOverlappingDowntimeTotal = useMemo(() => {
    const intervals = filteredRequests.map((r) => ({
      start: r.reportedAt,
      end:
        r.repairCompletedAt ||
        new Date(
          new Date(r.reportedAt).getTime() + r.downtimeMinutes * 60000
        ).toISOString(),
    }));
    return calculateNonOverlappingDowntimeMinutes(intervals);
  }, [filteredRequests]);

  function handleReportBreakdown(e: React.FormEvent) {
    e.preventDefault();
    setReportError(null);

    const res = reportBreakdown({
      machineId,
      category,
      severity,
      description,
      attachmentUrl,
      putMachineInError,
    });

    if (!res.ok) {
      setReportError(res.error || "Failed to submit breakdown report.");
      return;
    }

    setDescription("");
    setAttachmentUrl("");
    setShowReportModal(false);
    if (res.id) {
      setSelectedRequestId(res.id);
    }
  }

  function handleUpdateRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRequest) return;
    setUpdateError(null);

    const res = updateMaintenanceRequest({
      requestId: selectedRequest.id,
      nextStatus,
      assignedTo,
      rootCause,
      correctiveAction,
      note,
      restoreMachineToRunning,
    });

    if (!res.ok) {
      setUpdateError(res.error || "Failed to update maintenance ticket.");
      return;
    }

    setNote("");
  }

  const selectedTicketLogs = useMemo(
    () =>
      maintenanceLogs.filter((l) => l.requestId === selectedRequest?.id),
    [maintenanceLogs, selectedRequest]
  );

  const technicianUsers = useMemo(
    () =>
      users.filter((u) =>
        ["Maintenance Technician", "Supervisor", "Administrator"].includes(
          u.role
        )
      ),
    [users]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-rose-500" />
            Maintenance & Breakdown Work Orders
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Report equipment breakdowns, dispatch technicians, document root
            cause & corrective actions, and release machine safety locks.
          </p>
        </div>

        <button
          type="button"
          data-testid="open-report-breakdown-btn"
          onClick={() => {
            setReportError(null);
            setShowReportModal(true);
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Report Machine Breakdown
        </button>
      </div>

      {/* Summary Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-3">
          <div className="text-[11px] text-slate-500">Open / Unassigned</div>
          <div className="text-xl font-bold font-mono text-rose-600 mt-1">
            {filteredRequests.filter((r) => r.status === "Open").length}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-3">
          <div className="text-[11px] text-slate-500">
            Assigned / In Progress
          </div>
          <div className="text-xl font-bold font-mono text-blue-600 mt-1">
            {
              filteredRequests.filter((r) =>
                ["Assigned", "In Progress", "Waiting for Parts"].includes(
                  r.status
                )
              ).length
            }
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-3">
          <div className="text-[11px] text-slate-500">Resolved / Closed</div>
          <div className="text-xl font-bold font-mono text-emerald-600 mt-1">
            {
              filteredRequests.filter((r) =>
                ["Resolved", "Closed"].includes(r.status)
              ).length
            }
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-3">
          <div className="text-[11px] text-slate-500">
            Non-Overlapping Downtime
          </div>
          <div className="text-xl font-bold font-mono text-amber-600 mt-1">
            {nonOverlappingDowntimeTotal} min
          </div>
        </div>
      </div>

      {/* Main Split: Ticket Queue (7 cols) + Repair & Resolution Panel (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-2.5">
            <span className="text-xs font-semibold px-1">
              Maintenance Work Orders ({filteredRequests.length})
            </span>
            <div className="flex items-center gap-1.5 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                aria-label="Filter Maintenance Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              >
                <option value="ALL">All Statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredRequests.map((req) => {
            const machine = machines.find((m) => m.id === req.machineId);
            const active = selectedRequest?.id === req.id;
            return (
              <div
                key={req.id}
                data-testid={`mnt-card-${req.id}`}
                onClick={() => selectTicket(req)}
                className={`cursor-pointer rounded-md border p-4 transition-all ${
                  active
                    ? "bg-blue-50/40 dark:bg-blue-950/20 border-blue-500 ring-1 ring-blue-500"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                      {req.id}
                    </span>
                    <PriorityBadge priority={req.severity} />
                    <MaintenanceStatusBadge status={req.status} />
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    Downtime: {req.downtimeMinutes} min
                  </span>
                </div>

                <div className="mt-2">
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {machine?.name || req.machineId} ({machine?.stationCode}) —{" "}
                    <span className="text-rose-600 dark:text-rose-400">
                      {req.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                    {req.description}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span>Reported by: {req.reportedBy}</span>
                  <span>
                    Assigned to:{" "}
                    <strong className="text-slate-800 dark:text-slate-200">
                      {req.assignedTo || "Unassigned"}
                    </strong>
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Technician Dispatch, Root Cause & Resolution Form */}
        {selectedRequest && (
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 shadow-sm space-y-4 h-fit sticky top-20">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-blue-600">
                  {selectedRequest.id} • {selectedRequest.machineId}
                </span>
                <MaintenanceStatusBadge status={selectedRequest.status} />
              </div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">
                {selectedRequest.category}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {selectedRequest.description}
              </p>
            </div>

            <form onSubmit={handleUpdateRequest} className="space-y-3">
              {updateError && (
                <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300">
                  {updateError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Next Repair Status *
                  </label>
                  <select
                    data-testid="mnt-next-status-select"
                    value={nextStatus}
                    onChange={(e) =>
                      setNextStatus(e.target.value as MaintenanceStatus)
                    }
                    className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">
                    Assigned Technician *
                  </label>
                  <select
                    data-testid="mnt-assignee-select"
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="">-- Select Technician --</option>
                    {technicianUsers.map((u) => (
                      <option key={u.id} value={u.fullName}>
                        {u.fullName} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  Root Cause Analysis{" "}
                  {(nextStatus === "Resolved" || nextStatus === "Closed") && "*"}
                </label>
                <textarea
                  rows={2}
                  data-testid="mnt-root-cause-input"
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value)}
                  placeholder="Document verified mechanical, electrical, or process root cause..."
                  className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  Corrective Action Taken{" "}
                  {(nextStatus === "Resolved" || nextStatus === "Closed") && "*"}
                </label>
                <textarea
                  rows={2}
                  data-testid="mnt-corrective-action-input"
                  value={correctiveAction}
                  onChange={(e) => setCorrectiveAction(e.target.value)}
                  placeholder="Parts replaced, calibration performed, and test cycles verified..."
                  className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  Technician Log Note
                </label>
                <input
                  type="text"
                  data-testid="mnt-note-input"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional LOTO tag number or spare part reference..."
                  className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              {(nextStatus === "Resolved" || nextStatus === "Closed") && (
                <label className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={restoreMachineToRunning}
                    onChange={(e) =>
                      setRestoreMachineToRunning(e.target.checked)
                    }
                    className="rounded"
                  />
                  Release Safety Interlock & Restore Machine to Running
                </label>
              )}

              <button
                type="submit"
                data-testid="submit-mnt-update-btn"
                className="w-full py-2 px-4 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
              >
                <UserCheck className="w-4 h-4" />
                Save Maintenance Update
              </button>
            </form>

            {/* Audit Trail for Selected Ticket */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Repair Timeline & Logs ({selectedTicketLogs.length})
              </h3>
              <div className="space-y-2 max-h-44 overflow-y-auto">
                {selectedTicketLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs"
                  >
                    <div className="flex justify-between font-medium">
                      <span>{log.action}</span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {new Date(log.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                      {log.note}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      By {log.author}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Report Breakdown Modal */}
      {showReportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="dialog"
          aria-label="Report Machine Breakdown"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md max-w-lg w-full p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Report Machine Breakdown
                </h2>
                <p className="text-[11px] text-slate-500">
                  Reporter: {currentUser.fullName} ({currentUser.role})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleReportBreakdown} className="space-y-3.5 mt-4">
              {reportError && (
                <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300">
                  {reportError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium mb-1">
                  1. Affected Machine / Station *
                </label>
                <select
                  data-testid="breakdown-machine-select"
                  value={machineId}
                  onChange={(e) => setMachineId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.stationCode} — {m.name} ({m.lineId})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    2. Problem Category *
                  </label>
                  <select
                    data-testid="breakdown-category-select"
                    value={category}
                    onChange={(e) =>
                      setCategory(
                        e.target.value as MaintenanceRequest["category"]
                      )
                    }
                    className="w-full px-3 py-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">
                    3. Severity Level *
                  </label>
                  <select
                    data-testid="breakdown-severity-select"
                    value={severity}
                    onChange={(e) =>
                      setSeverity(e.target.value as PriorityLevel)
                    }
                    className="w-full px-3 py-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    {SEVERITIES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  4. Fault Description & Observed Symptoms *
                </label>
                <textarea
                  rows={3}
                  data-testid="breakdown-description-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe alarm code, abnormal noise/vibration, or jam location..."
                  className="w-full px-3 py-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  5. Optional Photo / Diagnostic Attachment Reference
                </label>
                <input
                  type="text"
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                  placeholder="e.g. HMI-Alarm-Capture-409.png"
                  className="w-full px-3 py-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={putMachineInError}
                  onChange={(e) => setPutMachineInError(e.target.checked)}
                  className="rounded"
                />
                Transition machine status to Error/Warning and engage safety
                interlock
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="submit-breakdown-btn"
                  className="px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
                >
                  Submit Breakdown Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
