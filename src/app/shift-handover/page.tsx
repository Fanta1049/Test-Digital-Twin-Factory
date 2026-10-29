"use client";

import React, { useMemo, useState } from "react";
import { useFactoryStore } from "@/lib/store/factory-store";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  HandMetal,
  PlusCircle,
  Search,
  Sparkles,
} from "lucide-react";

export default function ShiftHandoverPage() {
  const {
    lines,
    workOrders,
    maintenanceRequests,
    qualityInspections,
    materials,
    shiftHandovers,
    createShiftHandover,
    acknowledgeShiftHandover,
    currentUser,
  } = useFactoryStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [lineId, setLineId] = useState(lines[0]?.id || "LINE-PKG-01");
  const [outgoingShift, setOutgoingShift] = useState("Shift A (06:00-14:00)");
  const [incomingShift, setIncomingShift] = useState("Shift B (14:00-22:00)");
  const [producedQuantity, setProducedQuantity] = useState("1840");
  const [machineIssues, setMachineIssues] = useState("");
  const [qualityIssues, setQualityIssues] = useState("");
  const [inventoryConcerns, setInventoryConcerns] = useState("");
  const [actionItems, setActionItems] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const openMaintenance = useMemo(
    () =>
      maintenanceRequests.filter(
        (m) => m.status !== "Closed" && m.status !== "Resolved"
      ),
    [maintenanceRequests]
  );

  const failedQuality = useMemo(
    () => qualityInspections.filter((q) => q.result !== "Pass"),
    [qualityInspections]
  );

  const lowStock = useMemo(
    () => materials.filter((m) => m.quantityAvailable <= m.reorderThreshold),
    [materials]
  );

  function autoPopulateUnresolved() {
    setMachineIssues(
      openMaintenance.length > 0
        ? openMaintenance
            .map(
              (m) =>
                `${m.id} (${m.machineId} - ${m.status}): ${m.description}`
            )
            .join(" | ")
        : "All stations running within nominal parameters."
    );
    setQualityIssues(
      failedQuality.length > 0
        ? failedQuality
            .map(
              (q) =>
                `${q.id} Batch ${q.batchNumber} (${q.result}): ${q.defectQuantity}/${q.sampleSize} ${q.defectCategory}`
            )
            .join(" | ")
        : "No quality holds on current shift."
    );
    setInventoryConcerns(
      lowStock.length > 0
        ? lowStock
            .map(
              (m) =>
                `${m.code} (${m.quantityAvailable}/${m.reorderThreshold} ${m.unit})`
            )
            .join(", ")
        : "Packaging stock sufficient for next shift."
    );
    setActionItems(
      "1. Follow up on open maintenance tickets before ramping to 100% speed.\n2. Verify disposition of quarantined QA batches.\n3. Confirm packaging material replenishment from warehouse."
    );
  }

  function handleCreateHandover(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const outstandingWoIds = workOrders
      .filter(
        (w) =>
          w.lineId === lineId &&
          w.status !== "Completed" &&
          w.status !== "Cancelled"
      )
      .map((w) => w.id);

    const res = createShiftHandover({
      lineId,
      outgoingShift,
      incomingShift,
      producedQuantity: Number(producedQuantity) || 0,
      outstandingWorkOrders: outstandingWoIds,
      machineIssues,
      qualityIssues,
      inventoryConcerns,
      actionItems,
    });

    if (!res.ok) {
      setFormError(res.error || "Failed to publish shift handover report.");
      return;
    }

    setActionItems("");
  }

  const filteredHandovers = useMemo(() => {
    return shiftHandovers.filter((h) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        h.id.toLowerCase().includes(q) ||
        h.author.toLowerCase().includes(q) ||
        h.machineIssues.toLowerCase().includes(q) ||
        h.actionItems.toLowerCase().includes(q)
      );
    });
  }, [shiftHandovers, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <HandMetal className="w-5 h-5 text-blue-600" />
            Shift Handover Reports & Continuity Log
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Ensure seamless shift-to-shift visibility of unresolved breakdowns,
            quality holds, material shortages, and required sign-offs.
          </p>
        </div>
      </div>

      {/* Live Unresolved Issues Carry-Over Banner for Incoming Shift */}
      <div className="p-4 rounded-md bg-amber-500/10 border border-amber-500/30 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Active Carry-Over Items Visible to Incoming Shift
          </div>
          <button
            type="button"
            onClick={autoPopulateUnresolved}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-medium"
          >
            <Sparkles className="w-3 h-3" />
            Auto-Fill Form from Live Issues
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1">
          <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded border border-amber-500/20">
            <div className="font-semibold text-rose-600 dark:text-rose-400">
              Unresolved Machine Breakdowns ({openMaintenance.length})
            </div>
            <ul className="mt-1 space-y-0.5 text-[11px] text-slate-600 dark:text-slate-300">
              {openMaintenance.map((m) => (
                <li key={m.id}>
                  • <strong>{m.id}</strong> ({m.machineId}): {m.category} [
                  {m.status}]
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded border border-amber-500/20">
            <div className="font-semibold text-amber-700 dark:text-amber-400">
              Quality Holds / Failed Batches ({failedQuality.length})
            </div>
            <ul className="mt-1 space-y-0.5 text-[11px] text-slate-600 dark:text-slate-300">
              {failedQuality.map((q) => (
                <li key={q.id}>
                  • <strong>{q.batchNumber}</strong>: {q.defectCategory} (
                  {q.result})
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded border border-amber-500/20">
            <div className="font-semibold text-blue-600 dark:text-blue-400">
              Low Packaging Inventory ({lowStock.length})
            </div>
            <ul className="mt-1 space-y-0.5 text-[11px] text-slate-600 dark:text-slate-300">
              {lowStock.map((m) => (
                <li key={m.id}>
                  • <strong>{m.code}</strong>: {m.quantityAvailable} /{" "}
                  {m.reorderThreshold} {m.unit}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Main Split: Create Handover Form (5 cols) + Historical Reports & Acknowledgement (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 shadow-sm h-fit">
          <div className="pb-2.5 mb-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <PlusCircle className="w-4 h-4 text-blue-600" />
              Submit Shift Handover Report
            </h2>
            <p className="text-[11px] text-slate-500">
              Author: {currentUser.fullName} ({currentUser.role})
            </p>
          </div>

          <form onSubmit={handleCreateHandover} className="space-y-3">
            {formError && (
              <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-medium mb-1">
                  Production Line *
                </label>
                <select
                  value={lineId}
                  onChange={(e) => setLineId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  {lines.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  Shift Produced Qty *
                </label>
                <input
                  type="number"
                  min={0}
                  value={producedQuantity}
                  onChange={(e) => setProducedQuantity(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-medium mb-1">
                  Outgoing Shift *
                </label>
                <select
                  value={outgoingShift}
                  onChange={(e) => setOutgoingShift(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  <option value="Shift A (06:00-14:00)">
                    Shift A (06:00-14:00)
                  </option>
                  <option value="Shift B (14:00-22:00)">
                    Shift B (14:00-22:00)
                  </option>
                  <option value="Shift C (22:00-06:00)">
                    Shift C (22:00-06:00)
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  Incoming Shift *
                </label>
                <select
                  value={incomingShift}
                  onChange={(e) => setIncomingShift(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  <option value="Shift B (14:00-22:00)">
                    Shift B (14:00-22:00)
                  </option>
                  <option value="Shift C (22:00-06:00)">
                    Shift C (22:00-06:00)
                  </option>
                  <option value="Shift A (06:00-14:00)">
                    Shift A (06:00-14:00)
                  </option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">
                Machine Issues & Maintenance Summary
              </label>
              <textarea
                rows={2}
                value={machineIssues}
                onChange={(e) => setMachineIssues(e.target.value)}
                placeholder="Active breakdowns, degraded stations, or preventive tasks..."
                className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">
                Quality Issues & Quarantined Batches
              </label>
              <textarea
                rows={2}
                value={qualityIssues}
                onChange={(e) => setQualityIssues(e.target.value)}
                placeholder="Any failed inspections or AQL holds..."
                className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">
                Packaging Inventory Concerns
              </label>
              <input
                type="text"
                value={inventoryConcerns}
                onChange={(e) => setInventoryConcerns(e.target.value)}
                placeholder="Low stock materials or upcoming lot changes..."
                className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">
                Action Items for Incoming Shift *
              </label>
              <textarea
                rows={3}
                value={actionItems}
                onChange={(e) => setActionItems(e.target.value)}
                placeholder="Numbered action items for incoming supervisor/operators..."
                className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 px-4 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
            >
              Publish Shift Handover Report
            </button>
          </form>
        </div>

        {/* Right: Handover History & Acknowledgement (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search handover logs by ID, author, or issue keywords..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>
          </div>

          {filteredHandovers.map((h) => (
            <div
              key={h.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 shadow-sm space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                      {h.id}
                    </span>
                    <span className="text-xs font-mono text-blue-600 dark:text-blue-400">
                      {h.lineId}
                    </span>
                    <span className="text-xs text-slate-500">
                      {h.outgoingShift} &rarr; <strong>{h.incomingShift}</strong>
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Authored by {h.author} • Shift Output:{" "}
                    <strong className="font-mono text-slate-700 dark:text-slate-200">
                      {h.producedQuantity.toLocaleString()} units
                    </strong>
                  </div>
                </div>

                {h.acknowledgedBy ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Acknowledged by {h.acknowledgedBy}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => acknowledgeShiftHandover(h.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-sm"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Acknowledge Incoming Shift
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Machine Issues
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    {h.machineIssues}
                  </p>
                </div>
                <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Quality Issues
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    {h.qualityIssues}
                  </p>
                </div>
                <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Inventory Concerns
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    {h.inventoryConcerns}
                  </p>
                </div>
              </div>

              <div className="p-2.5 rounded bg-blue-50/40 dark:bg-blue-950/20 border border-blue-500/20 text-xs">
                <div className="font-semibold text-blue-900 dark:text-blue-300 mb-1">
                  Action Items for {h.incomingShift}:
                </div>
                <p className="text-[11px] text-slate-700 dark:text-slate-300 whitespace-pre-line">
                  {h.actionItems}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
