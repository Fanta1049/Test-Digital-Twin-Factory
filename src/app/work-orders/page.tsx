"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useFactoryStore } from "@/lib/store/factory-store";
import {
  calculateWorkOrderCompletion,
  canTransitionWorkOrder,
} from "@/lib/domain/logic";
import { PriorityLevel, WorkOrderStatus } from "@/lib/domain/types";
import {
  PriorityBadge,
  WorkOrderStatusBadge,
} from "@/components/ui/badges";
import {
  Activity,
  CheckCircle2,
  ClipboardList,
  Filter,
  PauseCircle,
  PlayCircle,
  Plus,
  Search,
  XCircle,
} from "lucide-react";

const ALL_STATUSES: WorkOrderStatus[] = [
  "Planned",
  "In Progress",
  "Paused",
  "Completed",
  "Cancelled",
];

const ALL_PRIORITIES: PriorityLevel[] = ["Low", "Medium", "High", "Critical"];

export default function WorkOrdersPage() {
  const {
    workOrders,
    products,
    lines,
    selectedLineId,
    createWorkOrder,
    updateWorkOrderStatus,
    currentUser,
  } = useFactoryStore();

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create form state
  const [productId, setProductId] = useState(products[0]?.id || "PROD-01");
  const [lineId, setLineId] = useState(lines[0]?.id || "LINE-PKG-01");
  const [plannedQuantity, setPlannedQuantity] = useState("1200");
  const [priority, setPriority] = useState<PriorityLevel>("High");
  const [assignedShift, setAssignedShift] = useState("Shift A (06:00-14:00)");
  const [dueDate, setDueDate] = useState("2026-10-30T14:00");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const filteredOrders = useMemo(() => {
    return workOrders.filter((wo) => {
      if (selectedLineId !== "ALL" && wo.lineId !== selectedLineId) {
        return false;
      }
      if (statusFilter !== "ALL" && wo.status !== statusFilter) {
        return false;
      }
      if (priorityFilter !== "ALL" && wo.priority !== priorityFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const prod = products.find((p) => p.id === wo.productId);
        const matchesId = wo.id.toLowerCase().includes(q);
        const matchesProd = prod?.name.toLowerCase().includes(q) ?? false;
        const matchesSku = prod?.sku.toLowerCase().includes(q) ?? false;
        if (!matchesId && !matchesProd && !matchesSku) return false;
      }
      return true;
    });
  }, [workOrders, selectedLineId, statusFilter, priorityFilter, searchQuery, products]);

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);

    const parsedQty = Number(plannedQuantity);
    if (!Number.isInteger(parsedQty) || parsedQty < 10) {
      setFormError("Planned quantity must be a whole number of at least 10 units.");
      return;
    }

    setSubmitting(true);
    const res = createWorkOrder({
      productId,
      lineId,
      plannedQuantity: parsedQty,
      priority,
      dueDate: new Date(dueDate).toISOString(),
      assignedShift,
      notes,
    });
    setSubmitting(false);

    if (!res.ok) {
      setFormError(res.error || "Failed to create work order.");
      return;
    }

    setNotes("");
    setPlannedQuantity("1200");
    setShowCreateModal(false);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-600" />
            Production Work Orders
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Schedule, prioritize, and control packaging work order lifecycles
            with state transition validation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/production"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50"
          >
            <Activity className="w-3.5 h-3.5 text-blue-600" />
            Record Shift Output
          </Link>
          <button
            type="button"
            data-testid="open-create-wo-btn"
            onClick={() => {
              setFormError(null);
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            New Work Order
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by WO ID, Product Name, or SKU..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-500">Status:</span>
          <select
            aria-label="Filter by Work Order Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
          >
            <option value="ALL">All Statuses</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-500">Priority:</span>
          <select
            aria-label="Filter by Work Order Priority"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
          >
            <option value="ALL">All Priorities</option>
            {ALL_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Work Orders Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-3 font-medium">Work Order ID</th>
                <th className="py-2.5 px-3 font-medium">Product / SKU</th>
                <th className="py-2.5 px-3 font-medium">Line & Shift</th>
                <th className="py-2.5 px-3 font-medium">Priority</th>
                <th className="py-2.5 px-3 font-medium">Status</th>
                <th className="py-2.5 px-3 font-medium">
                  Progress (Good / Target)
                </th>
                <th className="py-2.5 px-3 font-medium text-right">
                  State Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-8 text-center text-slate-400 text-xs"
                  >
                    No work orders match the active filters.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((wo) => {
                  const prod = products.find((p) => p.id === wo.productId);
                  const pct = calculateWorkOrderCompletion(
                    wo.goodQuantity,
                    wo.plannedQuantity
                  );
                  return (
                    <tr
                      key={wo.id}
                      data-testid={`wo-row-${wo.id}`}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                    >
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                        <div>{wo.id}</div>
                        <div className="text-[10px] font-normal text-slate-400">
                          Due: {new Date(wo.dueDate).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {prod?.name || wo.productId}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {prod?.sku}
                        </div>
                        {wo.notes && (
                          <div className="text-[11px] text-slate-500 mt-0.5 italic">
                            {wo.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-mono font-medium">{wo.lineId}</div>
                        <div className="text-[11px] text-slate-500">
                          {wo.assignedShift}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <PriorityBadge priority={wo.priority} />
                      </td>
                      <td className="py-3 px-3">
                        <WorkOrderStatusBadge status={wo.status} />
                      </td>
                      <td className="py-3 px-3 min-w-[200px]">
                        <div className="flex justify-between font-mono text-[11px] mb-1">
                          <span>
                            <strong className="text-emerald-600 dark:text-emerald-400">
                              {wo.goodQuantity.toLocaleString()}
                            </strong>{" "}
                            / {wo.plannedQuantity.toLocaleString()}
                          </span>
                          <span className="font-semibold text-blue-600 dark:text-blue-400">
                            {pct}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 mt-1">
                          Total Produced: {wo.producedQuantity.toLocaleString()}{" "}
                          • Defective: {wo.defectiveQuantity}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center gap-1 justify-end">
                          {canTransitionWorkOrder(wo.status, "In Progress")
                            .valid &&
                            wo.status !== "In Progress" && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateWorkOrderStatus(wo.id, "In Progress")
                                }
                                title="Start or Resume Work Order"
                                className="px-2 py-1 rounded bg-blue-600/10 hover:bg-blue-600/20 text-blue-700 dark:text-blue-300 border border-blue-500/30 text-[11px] font-medium inline-flex items-center gap-1"
                              >
                                <PlayCircle className="w-3 h-3" />
                                Start
                              </button>
                            )}
                          {canTransitionWorkOrder(wo.status, "Paused").valid &&
                            wo.status !== "Paused" && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateWorkOrderStatus(wo.id, "Paused")
                                }
                                title="Pause Work Order"
                                className="px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[11px] font-medium inline-flex items-center gap-1"
                              >
                                <PauseCircle className="w-3 h-3" />
                                Pause
                              </button>
                            )}
                          {canTransitionWorkOrder(wo.status, "Completed")
                            .valid &&
                            wo.status !== "Completed" && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateWorkOrderStatus(wo.id, "Completed")
                                }
                                title="Mark Work Order Completed"
                                className="px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[11px] font-medium inline-flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                Complete
                              </button>
                            )}
                          {canTransitionWorkOrder(wo.status, "Cancelled")
                            .valid &&
                            wo.status !== "Cancelled" && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateWorkOrderStatus(wo.id, "Cancelled")
                                }
                                title="Cancel Work Order"
                                className="px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-[11px] font-medium inline-flex items-center gap-1"
                              >
                                <XCircle className="w-3 h-3" />
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Work Order Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="dialog"
          aria-label="Create Production Work Order"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md max-w-lg w-full p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Create Production Work Order
                </h2>
                <p className="text-[11px] text-slate-500">
                  Author: {currentUser.fullName} ({currentUser.role})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 mt-4">
              {formError && (
                <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium mb-1">
                  Product / Packaging SKU *
                </label>
                <select
                  data-testid="wo-product-select"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Production Line *
                  </label>
                  <select
                    data-testid="wo-line-select"
                    value={lineId}
                    onChange={(e) => setLineId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
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
                    Target Quantity (Cases) *
                  </label>
                  <input
                    type="number"
                    data-testid="wo-quantity-input"
                    min={10}
                    max={100000}
                    value={plannedQuantity}
                    onChange={(e) => setPlannedQuantity(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Priority *
                  </label>
                  <select
                    data-testid="wo-priority-select"
                    value={priority}
                    onChange={(e) =>
                      setPriority(e.target.value as PriorityLevel)
                    }
                    className="w-full px-3 py-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    {ALL_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">
                    Assigned Shift *
                  </label>
                  <select
                    value={assignedShift}
                    onChange={(e) => setAssignedShift(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
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
                    Due Date *
                  </label>
                  <input
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  Production & Packaging Notes
                </label>
                <textarea
                  rows={2}
                  data-testid="wo-notes-input"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional carton spec, lot traceability, or changeover instructions..."
                  className="w-full px-3 py-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="submit-create-wo-btn"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
                >
                  Create Work Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
