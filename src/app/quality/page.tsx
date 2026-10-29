"use client";

import React, { useMemo, useState } from "react";
import { useFactoryStore } from "@/lib/store/factory-store";
import { validateQualityInspection } from "@/lib/domain/logic";
import { DefectCategory } from "@/lib/domain/types";
import { InspectionResultBadge } from "@/components/ui/badges";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  ShieldCheck,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const DEFECT_CATEGORIES: DefectCategory[] = [
  "Damaged carton",
  "Incorrect label",
  "Missing product",
  "Incorrect quantity",
  "Packaging seal failure",
];

export default function QualityPage() {
  const {
    workOrders,
    products,
    machines,
    qualityInspections,
    qualityThresholdPct,
    setQualityThresholdPct,
    recordQualityInspection,
    currentUser,
  } = useFactoryStore();

  const [workOrderId, setWorkOrderId] = useState(
    workOrders[0]?.id || "WO-2026-101"
  );
  const [machineId, setMachineId] = useState("MCH-STA-B");
  const [batchNumber, setBatchNumber] = useState("BCH-20261029-A4");
  const [sampleSize, setSampleSize] = useState("200");
  const [defectQuantity, setDefectQuantity] = useState("4");
  const [defectCategory, setDefectCategory] =
    useState<DefectCategory>("Damaged carton");
  const [complianceVerified, setComplianceVerified] = useState(true);
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const livePreview = useMemo(() => {
    return validateQualityInspection({
      sampleSize: Number(sampleSize),
      defectQuantity: Number(defectQuantity),
      thresholdPct: qualityThresholdPct,
    });
  }, [sampleSize, defectQuantity, qualityThresholdPct]);

  // Pareto chart data by defect category
  const paretoData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of DEFECT_CATEGORIES) {
      counts[cat] = 0;
    }
    for (const insp of qualityInspections) {
      if (insp.defectQuantity > 0 && insp.defectCategory !== "None") {
        counts[insp.defectCategory] =
          (counts[insp.defectCategory] || 0) + insp.defectQuantity;
      }
    }

    const sorted = Object.entries(counts)
      .map(([category, defects]) => ({ category, defects }))
      .sort((a, b) => b.defects - a.defects);

    const total = sorted.reduce((s, i) => s + i.defects, 0);
    let cumulative = 0;
    return sorted.map((item) => {
      cumulative += item.defects;
      return {
        ...item,
        cumulativePct:
          total > 0 ? Number(((cumulative / total) * 100).toFixed(1)) : 0,
      };
    });
  }, [qualityInspections]);

  // Defect rate trend across inspections
  const trendData = useMemo(() => {
    return [...qualityInspections]
      .reverse()
      .map((insp) => ({
        batch: insp.batchNumber.replace("BCH-20261029-", ""),
        defectRatePct: Number(
          ((insp.defectQuantity / insp.sampleSize) * 100).toFixed(2)
        ),
        threshold: qualityThresholdPct,
      }));
  }, [qualityInspections, qualityThresholdPct]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!batchNumber.trim()) {
      setFormError("Batch number is required.");
      return;
    }

    const res = recordQualityInspection({
      workOrderId,
      machineId,
      batchNumber,
      sampleSize: Number(sampleSize),
      defectQuantity: Number(defectQuantity),
      defectCategory: Number(defectQuantity) === 0 ? "None" : defectCategory,
      complianceVerified,
      notes:
        notes.trim() ||
        `AQL sample inspection (${defectQuantity}/${sampleSize} defects).`,
    });

    if (!res.ok) {
      setFormError(res.error || "Failed to record quality inspection.");
      return;
    }

    setNotes("");
    setBatchNumber(`BCH-20261029-A${qualityInspections.length + 1}`);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-blue-600" />
            Quality Control & Defect Pareto Analysis
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Log batch quality inspections, enforce AQL defect thresholds, and
            verify compliance criteria prior to release.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-1.5 text-xs">
          <span className="text-slate-500">Configurable Defect Threshold:</span>
          <input
            type="number"
            step="0.5"
            min="0.5"
            max="20"
            aria-label="Configurable Defect Rate Threshold (%)"
            value={qualityThresholdPct}
            onChange={(e) => setQualityThresholdPct(Number(e.target.value))}
            className="w-16 px-2 py-0.5 font-mono font-bold rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
          />
          <span className="font-mono">%</span>
        </div>
      </div>

      {/* Main Split: Record Inspection Form + Pareto & Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Form (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 shadow-sm">
          <div className="pb-2.5 mb-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Record Quality Inspection Result
            </h2>
            <p className="text-[11px] text-slate-500">
              Inspector: {currentUser.fullName} ({currentUser.role})
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {formError && (
              <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-medium mb-1">
                  Production Work Order *
                </label>
                <select
                  data-testid="qa-wo-select"
                  value={workOrderId}
                  onChange={(e) => setWorkOrderId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  {workOrders.map((wo) => {
                    const prod = products.find((p) => p.id === wo.productId);
                    return (
                      <option key={wo.id} value={wo.id}>
                        {wo.id} ({prod?.sku})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  Station / Machine *
                </label>
                <select
                  data-testid="qa-machine-select"
                  value={machineId}
                  onChange={(e) => setMachineId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.stationCode} — {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-xs font-medium mb-1">
                  Batch / Lot Number *
                </label>
                <input
                  type="text"
                  data-testid="qa-batch-input"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  Sample Size *
                </label>
                <input
                  type="number"
                  data-testid="qa-sample-input"
                  min={1}
                  value={sampleSize}
                  onChange={(e) => setSampleSize(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  Defective Qty *
                </label>
                <input
                  type="number"
                  data-testid="qa-defect-qty-input"
                  min={0}
                  value={defectQuantity}
                  onChange={(e) => setDefectQuantity(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">
                Primary Defect Category *
              </label>
              <select
                data-testid="qa-defect-category-select"
                value={defectCategory}
                onChange={(e) =>
                  setDefectCategory(e.target.value as DefectCategory)
                }
                className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                {DEFECT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Live Threshold Evaluation Box */}
            {livePreview.valid && (
              <div
                className={`p-2.5 rounded border text-xs flex items-center justify-between ${
                  livePreview.exceedsThreshold
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {livePreview.exceedsThreshold ? (
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  )}
                  <span>
                    Calculated Defect Rate:{" "}
                    <strong className="font-mono">
                      {livePreview.defectRatePct}%
                    </strong>{" "}
                    (Limit: {qualityThresholdPct}%)
                  </span>
                </div>
                <span className="font-bold uppercase">
                  {livePreview.exceedsThreshold
                    ? "FAIL (Exceeds Limit)"
                    : complianceVerified
                    ? "PASS"
                    : "HOLD (Unverified)"}
                </span>
              </div>
            )}

            <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded border border-slate-200 dark:border-slate-800">
              <input
                type="checkbox"
                checked={complianceVerified}
                onChange={(e) => setComplianceVerified(e.target.checked)}
                className="rounded mt-0.5"
              />
              <span>
                <strong>Verified Packaging Compliance Criteria:</strong> Seal
                integrity, barcode readability, and weight check verified per
                SOP. (Unchecked inspections with defects are placed on{" "}
                <code>Hold</code>.)
              </span>
            </label>

            <div>
              <label className="block text-xs font-medium mb-1">
                Inspection Notes
              </label>
              <textarea
                rows={2}
                data-testid="qa-notes-input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Document measurement observations or containment action..."
                className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>

            <button
              type="submit"
              data-testid="submit-qa-inspection-btn"
              className="w-full py-2 px-4 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              Record Quality Inspection
            </button>
          </form>
        </div>

        {/* Right: Pareto & Trend Charts (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Defect Pareto Chart */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Packaging Defect Pareto Breakdown
            </h2>
            <p className="text-[11px] text-slate-500 mb-3">
              Defective unit count and cumulative percentage by failure mode
            </p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={paretoData}
                  margin={{ top: 8, right: 10, left: -15, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#334155"
                    opacity={0.2}
                  />
                  <XAxis dataKey="category" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#334155",
                      color: "#f8fafc",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Bar
                    dataKey="defects"
                    name="Defective Units"
                    fill="#f43f5e"
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Batch Defect Rate vs Threshold Trend */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Batch Defect Rate Trend vs AQL Threshold ({qualityThresholdPct}%)
            </h2>
            <div className="h-48 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={trendData}
                  margin={{ top: 8, right: 12, left: -15, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#334155"
                    opacity={0.2}
                  />
                  <XAxis dataKey="batch" tick={{ fontSize: 10 }} />
                  <YAxis unit="%" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#334155",
                      color: "#f8fafc",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Line
                    type="monotone"
                    dataKey="defectRatePct"
                    name="Batch Defect Rate (%)"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                  />
                  <Line
                    type="monotone"
                    dataKey="threshold"
                    name="Max Threshold (%)"
                    stroke="#f43f5e"
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Quality Inspection History Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
          Quality Inspection Ledger ({qualityInspections.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-2 px-2.5 font-medium">ID / Batch</th>
                <th className="py-2 px-2.5 font-medium">Work Order & Station</th>
                <th className="py-2 px-2.5 font-medium">Defect Category</th>
                <th className="py-2 px-2.5 font-medium text-right">
                  Defects / Sample
                </th>
                <th className="py-2 px-2.5 font-medium text-right">
                  Defect Rate
                </th>
                <th className="py-2 px-2.5 font-medium">Result</th>
                <th className="py-2 px-2.5 font-medium">Inspector</th>
                <th className="py-2 px-2.5 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {qualityInspections.map((insp) => {
                const rate = Number(
                  ((insp.defectQuantity / insp.sampleSize) * 100).toFixed(2)
                );
                return (
                  <tr
                    key={insp.id}
                    data-testid={`qa-row-${insp.id}`}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="py-2.5 px-2.5 font-mono">
                      <div className="font-bold">{insp.id}</div>
                      <div className="text-[11px] text-slate-500">
                        {insp.batchNumber}
                      </div>
                    </td>
                    <td className="py-2.5 px-2.5 font-mono">
                      <div>{insp.workOrderId}</div>
                      <div className="text-[11px] text-slate-500">
                        {insp.machineId}
                      </div>
                    </td>
                    <td className="py-2.5 px-2.5 font-medium">
                      {insp.defectCategory}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono">
                      <span className="text-rose-500 font-semibold">
                        {insp.defectQuantity}
                      </span>{" "}
                      / {insp.sampleSize}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono font-semibold">
                      {rate}%
                    </td>
                    <td className="py-2.5 px-2.5">
                      <InspectionResultBadge result={insp.result} />
                    </td>
                    <td className="py-2.5 px-2.5">{insp.inspector}</td>
                    <td className="py-2.5 px-2.5 text-slate-500 max-w-xs truncate">
                      {insp.notes}
                    </td>
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
