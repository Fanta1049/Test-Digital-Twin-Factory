"use client";

import React, { useMemo, useState } from "react";
import { useFactoryStore } from "@/lib/store/factory-store";
import { InventoryTransactionType } from "@/lib/domain/types";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  PackageSearch,
  RefreshCw,
  Search,
} from "lucide-react";

export default function InventoryPage() {
  const {
    materials,
    inventoryTransactions,
    recordInventoryTransaction,
    currentUser,
  } = useFactoryStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Transaction form state
  const [materialId, setMaterialId] = useState(materials[0]?.id || "MAT-01");
  const [transactionType, setTransactionType] =
    useState<InventoryTransactionType>("Issue");
  const [quantity, setQuantity] = useState("150");
  const [referenceDoc, setReferenceDoc] = useState("WO-2026-101");
  const [lotNumber, setLotNumber] = useState("");
  const [reason, setReason] = useState("");
  const [txError, setTxError] = useState<string | null>(null);

  const selectedMaterial = useMemo(
    () => materials.find((m) => m.id === materialId) || materials[0],
    [materials, materialId]
  );

  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      if (lowStockOnly && m.quantityAvailable > m.reorderThreshold) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCode = m.code.toLowerCase().includes(q);
        const matchName = m.name.toLowerCase().includes(q);
        const matchSupplier = m.supplierName.toLowerCase().includes(q);
        const matchLot = m.lotNumber.toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchSupplier && !matchLot) {
          return false;
        }
      }
      return true;
    });
  }, [materials, lowStockOnly, searchQuery]);

  const lowStockMaterials = useMemo(
    () => materials.filter((m) => m.quantityAvailable <= m.reorderThreshold),
    [materials]
  );

  function handleTransactionSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTxError(null);

    const parsedQty = Number(quantity);
    const res = recordInventoryTransaction({
      materialId,
      transactionType,
      quantity: parsedQty,
      referenceDoc,
      lotNumber: lotNumber.trim() || selectedMaterial?.lotNumber,
      reason:
        reason.trim() ||
        `${transactionType} logged by ${currentUser.fullName} (${referenceDoc || "Shop floor"})`,
    });

    if (!res.ok) {
      setTxError(res.error || "Inventory transaction failed.");
      return;
    }

    setReason("");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <PackageSearch className="w-5 h-5 text-blue-600" />
            Packaging Material Inventory & Stock Ledger
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Track corrugated blanks, adhesive, label rolls, and shrink film via
            immutable stock movement transactions.
          </p>
        </div>
      </div>

      {/* Low Stock Alert Banner */}
      {lowStockMaterials.length > 0 && (
        <div className="p-3.5 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <div className="font-bold text-amber-900 dark:text-amber-200">
              Low-Stock Replenishment Alert ({lowStockMaterials.length} Items
              At/Below Reorder Point)
            </div>
            <div className="text-amber-800 dark:text-amber-300 mt-1 flex flex-wrap gap-2">
              {lowStockMaterials.map((m) => (
                <span
                  key={m.id}
                  className="px-2 py-0.5 rounded bg-amber-500/15 font-mono text-[11px]"
                >
                  {m.code}: {m.quantityAvailable} / {m.reorderThreshold}{" "}
                  {m.unit}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Split: Material Balances Table (7 cols) + Stock Movement Form (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 space-y-3">
          {/* Search & Low Stock Toggle */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by code, material name, supplier, or lot..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>

            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={lowStockOnly}
                onChange={(e) => setLowStockOnly(e.target.checked)}
                className="rounded"
              />
              <span>Low-Stock Items Only</span>
            </label>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-2.5 px-3 font-medium">Code / Lot</th>
                    <th className="py-2.5 px-3 font-medium">
                      Material & Supplier
                    </th>
                    <th className="py-2.5 px-3 font-medium text-right">
                      Available
                    </th>
                    <th className="py-2.5 px-3 font-medium text-right">
                      Reorder Point
                    </th>
                    <th className="py-2.5 px-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredMaterials.map((m) => {
                    const isLow = m.quantityAvailable <= m.reorderThreshold;
                    return (
                      <tr
                        key={m.id}
                        data-testid={`mat-row-${m.code}`}
                        onClick={() => {
                          setMaterialId(m.id);
                          setLotNumber(m.lotNumber);
                          setTxError(null);
                        }}
                        className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                          materialId === m.id
                            ? "bg-blue-50/40 dark:bg-blue-950/20"
                            : ""
                        }`}
                      >
                        <td className="py-3 px-3 font-mono">
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            {m.code}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {m.lotNumber}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {m.name}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {m.supplierName} • {m.category}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold">
                          <span
                            className={
                              isLow
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-emerald-600 dark:text-emerald-400"
                            }
                          >
                            {m.quantityAvailable.toLocaleString()}
                          </span>{" "}
                          <span className="text-[10px] font-normal text-slate-400">
                            {m.unit}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-500">
                          {m.reorderThreshold.toLocaleString()} {m.unit}
                        </td>
                        <td className="py-3 px-3">
                          {isLow ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                              Reorder Needed
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                              In Stock
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Stock Transaction Form (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 shadow-sm h-fit">
          <div className="pb-2.5 mb-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Record Packaging Stock Transaction
            </h2>
            <p className="text-[11px] text-slate-500">
              Balances update exclusively via validated transactions (non-negative
              stock guard enforced).
            </p>
          </div>

          <form onSubmit={handleTransactionSubmit} className="space-y-3">
            {txError && (
              <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300">
                {txError}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium mb-1">
                Packaging Material *
              </label>
              <select
                data-testid="inv-material-select"
                value={materialId}
                onChange={(e) => setMaterialId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.code} — {m.name} ({m.quantityAvailable} {m.unit})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  {
                    type: "Receipt",
                    label: "Stock Receipt",
                    icon: ArrowDownLeft,
                  },
                  {
                    type: "Issue",
                    label: "Material Issue",
                    icon: ArrowUpRight,
                  },
                  {
                    type: "Adjustment",
                    label: "Adjustment",
                    icon: RefreshCw,
                  },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const active = transactionType === item.type;
                return (
                  <button
                    key={item.type}
                    type="button"
                    data-testid={`inv-type-${item.type}`}
                    onClick={() => {
                      setTransactionType(item.type);
                      setTxError(null);
                    }}
                    className={`py-2 px-2 rounded border text-xs font-medium flex items-center justify-center gap-1 ${
                      active
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {item.label}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-medium mb-1">
                  {transactionType === "Adjustment"
                    ? "Signed Delta (+ or -)"
                    : `Quantity (${selectedMaterial?.unit || "units"}) *`}
                </label>
                <input
                  type="number"
                  data-testid="inv-qty-input"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-mono rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  Reference WO / PO
                </label>
                <input
                  type="text"
                  value={referenceDoc}
                  onChange={(e) => setReferenceDoc(e.target.value)}
                  placeholder="e.g. WO-2026-101 or PO-881"
                  className="w-full px-3 py-1.5 text-xs font-mono rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">
                Transaction Reason / Audit Note *
              </label>
              <input
                type="text"
                data-testid="inv-reason-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Issued to Line 1 Station C or cycle count variance"
                className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                required
              />
            </div>

            <button
              type="submit"
              data-testid="submit-inv-tx-btn"
              className="w-full py-2 px-4 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
            >
              Commit {transactionType} Transaction
            </button>
          </form>
        </div>
      </div>

      {/* Transaction Ledger */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
          Inventory Movement Transaction History ({inventoryTransactions.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-2 px-2.5 font-medium">Tx ID</th>
                <th className="py-2 px-2.5 font-medium">Material</th>
                <th className="py-2 px-2.5 font-medium">Type</th>
                <th className="py-2 px-2.5 font-medium text-right">Delta</th>
                <th className="py-2 px-2.5 font-medium text-right">
                  Prev &rarr; New Balance
                </th>
                <th className="py-2 px-2.5 font-medium">Ref / Lot</th>
                <th className="py-2 px-2.5 font-medium">Reason</th>
                <th className="py-2 px-2.5 font-medium">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {inventoryTransactions.map((tx) => {
                const mat = materials.find((m) => m.id === tx.materialId);
                return (
                  <tr key={tx.id}>
                    <td className="py-2 px-2.5 font-mono font-semibold">
                      {tx.id}
                    </td>
                    <td className="py-2 px-2.5">
                      <span className="font-mono font-bold">{mat?.code}</span>{" "}
                      <span className="text-slate-500">{mat?.name}</span>
                    </td>
                    <td className="py-2 px-2.5 font-medium">
                      {tx.transactionType}
                    </td>
                    <td
                      className={`py-2 px-2.5 text-right font-mono font-bold ${
                        tx.quantityDelta > 0
                          ? "text-emerald-600"
                          : "text-rose-500"
                      }`}
                    >
                      {tx.quantityDelta > 0
                        ? `+${tx.quantityDelta}`
                        : tx.quantityDelta}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono">
                      {tx.previousBalance.toLocaleString()} &rarr;{" "}
                      <strong>{tx.newBalance.toLocaleString()}</strong>
                    </td>
                    <td className="py-2 px-2.5 font-mono text-[11px]">
                      {tx.referenceDoc || "—"} ({tx.lotNumber || "—"})
                    </td>
                    <td className="py-2 px-2.5 text-slate-600 dark:text-slate-300">
                      {tx.reason}
                    </td>
                    <td className="py-2 px-2.5">{tx.performedBy}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
