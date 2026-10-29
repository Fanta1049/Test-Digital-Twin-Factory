"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useFactoryStore } from "@/lib/store/factory-store";
import {
  calculateDefectRatePct,
  calculateWorkOrderCompletion,
} from "@/lib/domain/logic";
import {
  DataSourceBadge,
  WorkOrderStatusBadge,
} from "@/components/ui/badges";
import {
  Activity,
  CheckCircle2,
  ClipboardList,
  PlusCircle,
  Search,
} from "lucide-react";

const HOUR_SLOTS = [
  "06:00 - 07:00",
  "07:00 - 08:00",
  "08:00 - 09:00",
  "09:00 - 10:00",
  "10:00 - 11:00",
  "11:00 - 12:00",
  "12:00 - 13:00",
  "13:00 - 14:00",
  "14:00 - 15:00",
  "15:00 - 16:00",
];

export default function ProductionPage() {
  const {
    workOrders,
    productionRecords,
    machines,
    products,
    selectedLineId,
    recordProductionOutput,
    currentUser,
  } = useFactoryStore();

  const eligibleOrders = useMemo(
    () =>
      workOrders.filter(
        (w) => w.status !== "Completed" && w.status !== "Cancelled"
      ),
    [workOrders]
  );

  const [workOrderId, setWorkOrderId] = useState(
    eligibleOrders[0]?.id || "WO-2026-101"
  );
  const [shift, setShift] = useState("Shift A (06:00-14:00)");
  const [hourSlot, setHourSlot] = useState("11:00 - 12:00");
  const [goodQuantity, setGoodQuantity] = useState("380");
  const [defectiveQuantity, setDefectiveQuantity] = useState("8");
  const [machineId, setMachineId] = useState("MCH-STA-E");
  const [notes, setNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [shiftFilter, setShiftFilter] = useState("ALL");

  const calculatedTotal =
    (Number(goodQuantity) || 0) + (Number(defectiveQuantity) || 0);

  const filteredRecords = useMemo(() => {
    return productionRecords.filter((rec) => {
      if (selectedLineId !== "ALL" && rec.lineId !== selectedLineId) {
        return false;
      }
      if (shiftFilter !== "ALL" && rec.shift !== shiftFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchWo = rec.workOrderId.toLowerCase().includes(q);
        const matchUser = rec.recordedBy.toLowerCase().includes(q);
        const matchNote = rec.notes?.toLowerCase().includes(q) ?? false;
        if (!matchWo && !matchUser && !matchNote) return false;
      }
      return true;
    });
  }, [productionRecords, selectedLineId, shiftFilter, searchQuery]);

  function handleRecordOutput(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const good = Number(goodQuantity);
    const defective = Number(defectiveQuantity);

    const res = recordProductionOutput({
      workOrderId,
      shift,
      hourSlot,
      goodQuantity: good,
      defectiveQuantity: defective,
      machineId: machineId || undefined,
      dataSource: "Manual",
      notes,
    });

    if (!res.ok) {
      setErrorMsg(res.error || "Failed to record production output.");
      return;
    }

    setNotes("");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            Production Tracking & Shift Output
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Record shift and hourly packaging quantities, track work order
            completion, and audit shop-floor output records.
          </p>
        </div>

        <Link
          href="/work-orders"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50"
        >
          <ClipboardList className="w-3.5 h-3.5 text-blue-600" />
          Manage Work Orders
        </Link>
      </div>

      {/* Main Split: Record Production Form + Active Work Order Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Form Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <PlusCircle className="w-4 h-4 text-blue-600" />
                Record Production Output
              </h2>
              <p className="text-[11px] text-slate-500">
                Operator: {currentUser.fullName} ({currentUser.role})
              </p>
            </div>
          </div>

          <form onSubmit={handleRecordOutput} className="space-y-3">
            {errorMsg && (
              <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium mb-1">
                Active Work Order *
              </label>
              <select
                data-testid="prod-wo-select"
                value={workOrderId}
                onChange={(e) => setWorkOrderId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                {eligibleOrders.map((wo) => {
                  const prod = products.find((p) => p.id === wo.productId);
                  return (
                    <option key={wo.id} value={wo.id}>
                      {wo.id} — {prod?.name} ({wo.goodQuantity}/
                      {wo.plannedQuantity})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-medium mb-1">
                  Shift *
                </label>
                <select
                  value={shift}
                  onChange={(e) => setShift(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
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
                  Hour Slot *
                </label>
                <select
                  value={hourSlot}
                  onChange={(e) => setHourSlot(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  {HOUR_SLOTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-medium mb-1">
                  Good Quantity (Cases) *
                </label>
                <input
                  type="number"
                  data-testid="prod-good-input"
                  min={0}
                  value={goodQuantity}
                  onChange={(e) => setGoodQuantity(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  Defective / Scrap *
                </label>
                <input
                  type="number"
                  data-testid="prod-defect-input"
                  min={0}
                  value={defectiveQuantity}
                  onChange={(e) => setDefectiveQuantity(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  required
                />
              </div>
            </div>

            <div className="p-2.5 rounded bg-slate-100 dark:bg-slate-800/80 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-600 dark:text-slate-400">
                Validated Total Output:
              </span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {calculatedTotal.toLocaleString()} units
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">
                Reporting Station / Machine
              </label>
              <select
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

            <div>
              <label className="block text-xs font-medium mb-1">
                Shift Operator Notes
              </label>
              <input
                type="text"
                data-testid="prod-notes-input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional changeover, speed adjustment, or lot note..."
                className="w-full px-3 py-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>

            <button
              type="submit"
              data-testid="submit-prod-output-btn"
              className="w-full py-2 px-4 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm inline-flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              Log Verified Output
            </button>
          </form>
        </div>

        {/* Active Work Order Progress Summary (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 shadow-sm flex flex-col">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
            Work Order Quantity & Completion Tracker
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
            {workOrders.map((wo) => {
              const prod = products.find((p) => p.id === wo.productId);
              const pct = calculateWorkOrderCompletion(
                wo.goodQuantity,
                wo.plannedQuantity
              );
              const scrapRate = calculateDefectRatePct(
                wo.defectiveQuantity,
                wo.producedQuantity
              );
              return (
                <div
                  key={wo.id}
                  className="p-3.5 rounded border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                        {wo.id}
                      </span>
                      <WorkOrderStatusBadge status={wo.status} />
                    </div>
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">
                      {prod?.name}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      Line: {wo.lineId} • {wo.assignedShift}
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-200/70 dark:border-slate-800">
                    <div className="grid grid-cols-4 gap-2 text-center font-mono text-xs mb-2">
                      <div className="bg-white dark:bg-slate-900 p-1.5 rounded border border-slate-200 dark:border-slate-800">
                        <div className="text-[10px] text-slate-400">Planned</div>
                        <div className="font-semibold">
                          {wo.plannedQuantity.toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-1.5 rounded border border-slate-200 dark:border-slate-800">
                        <div className="text-[10px] text-slate-400">Produced</div>
                        <div className="font-semibold">
                          {wo.producedQuantity.toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-1.5 rounded border border-slate-200 dark:border-slate-800">
                        <div className="text-[10px] text-slate-400">Good</div>
                        <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {wo.goodQuantity.toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-1.5 rounded border border-slate-200 dark:border-slate-800">
                        <div className="text-[10px] text-slate-400">Scrap</div>
                        <div className="font-semibold text-rose-500">
                          {wo.defectiveQuantity} ({scrapRate}%)
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between text-[11px] font-mono mb-1">
                      <span className="text-slate-500">
                        Target Completion Rate
                      </span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">
                        {pct}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Historical Production Log */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Shift Production History Ledger
            </h2>
            <p className="text-[11px] text-slate-500">
              Immutable log of recorded packaging runs with timestamp, station,
              and operator attribution
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by WO, operator, notes..."
                className="pl-8 pr-3 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>

            <select
              aria-label="Filter by Shift"
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            >
              <option value="ALL">All Shifts</option>
              <option value="Shift A (06:00-14:00)">Shift A (06:00-14:00)</option>
              <option value="Shift B (14:00-22:00)">Shift B (14:00-22:00)</option>
              <option value="Shift C (22:00-06:00)">Shift C (22:00-06:00)</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-2 px-2.5 font-medium">Record ID</th>
                <th className="py-2 px-2.5 font-medium">Work Order / Line</th>
                <th className="py-2 px-2.5 font-medium">Shift & Hour Slot</th>
                <th className="py-2 px-2.5 font-medium">Station</th>
                <th className="py-2 px-2.5 font-medium text-right">Produced</th>
                <th className="py-2 px-2.5 font-medium text-right">Good</th>
                <th className="py-2 px-2.5 font-medium text-right">Defective</th>
                <th className="py-2 px-2.5 font-medium">Source</th>
                <th className="py-2 px-2.5 font-medium">Recorded By</th>
                <th className="py-2 px-2.5 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRecords.map((rec) => (
                <tr
                  key={rec.id}
                  data-testid={`prod-record-${rec.id}`}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <td className="py-2.5 px-2.5 font-mono font-semibold">
                    {rec.id}
                  </td>
                  <td className="py-2.5 px-2.5 font-mono">
                    <div>{rec.workOrderId}</div>
                    <div className="text-[10px] text-slate-400">{rec.lineId}</div>
                  </td>
                  <td className="py-2.5 px-2.5">
                    <div className="font-mono font-medium">{rec.hourSlot}</div>
                    <div className="text-[10px] text-slate-500">{rec.shift}</div>
                  </td>
                  <td className="py-2.5 px-2.5 font-mono text-slate-600 dark:text-slate-300">
                    {rec.machineId || "Line Aggregate"}
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono font-medium">
                    {rec.producedQuantity.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    {rec.goodQuantity.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono text-rose-500">
                    {rec.defectiveQuantity}
                  </td>
                  <td className="py-2.5 px-2.5">
                    <DataSourceBadge source={rec.dataSource} />
                  </td>
                  <td className="py-2.5 px-2.5">{rec.recordedBy}</td>
                  <td className="py-2.5 px-2.5 text-slate-500 max-w-xs truncate">
                    {rec.notes || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
