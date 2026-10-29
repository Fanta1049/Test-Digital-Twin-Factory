"use client";

import React, { useMemo, useState } from "react";
import { useFactoryStore } from "@/lib/store/factory-store";
import {
  calculateDefectRatePct,
  calculateNonOverlappingDowntimeMinutes,
  calculateOEE,
} from "@/lib/domain/logic";
import {
  BarChart3,
  CheckCircle2,
  Clock,
  Filter,
  Gauge,
  Info,
  Wrench,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function AnalyticsPage() {
  const {
    lines,
    selectedLineId,
    setSelectedLineId,
    machines,
    workOrders,
    productionRecords,
    maintenanceRequests,
    inventoryTransactions,
    materials,
  } = useFactoryStore();

  const [shiftFilter, setShiftFilter] = useState("ALL");

  const filteredMachines = useMemo(
    () =>
      selectedLineId === "ALL"
        ? machines
        : machines.filter((m) => m.lineId === selectedLineId),
    [machines, selectedLineId]
  );

  const filteredWorkOrders = useMemo(
    () =>
      selectedLineId === "ALL"
        ? workOrders
        : workOrders.filter((w) => w.lineId === selectedLineId),
    [workOrders, selectedLineId]
  );

  const filteredRecords = useMemo(() => {
    return productionRecords.filter((r) => {
      if (selectedLineId !== "ALL" && r.lineId !== selectedLineId) {
        return false;
      }
      if (shiftFilter !== "ALL" && r.shift !== shiftFilter) {
        return false;
      }
      return true;
    });
  }, [productionRecords, selectedLineId, shiftFilter]);

  const filteredMaintenance = useMemo(
    () =>
      selectedLineId === "ALL"
        ? maintenanceRequests
        : maintenanceRequests.filter((m) => m.lineId === selectedLineId),
    [maintenanceRequests, selectedLineId]
  );

  // OEE Calculation with explicit documented denominator assumptions
  const oeeMetrics = useMemo(() => {
    // Standard 8-hour shift = 480 planned minutes per active line
    const activeLineCount =
      selectedLineId === "ALL" ? Math.max(1, lines.length) : 1;
    const plannedProductionMinutes = 480 * activeLineCount;

    const downtimeMinutes = calculateNonOverlappingDowntimeMinutes(
      filteredMaintenance.map((r) => ({
        start: r.reportedAt,
        end:
          r.repairCompletedAt ||
          new Date(
            new Date(r.reportedAt).getTime() + r.downtimeMinutes * 60000
          ).toISOString(),
      }))
    );

    const totalProducedUnits = filteredWorkOrders.reduce(
      (s, w) => s + w.producedQuantity,
      0
    );
    const goodUnits = filteredWorkOrders.reduce(
      (s, w) => s + w.goodQuantity,
      0
    );

    // Ideal cycle time = 6.0 seconds per carton case across packaging line
    return calculateOEE({
      plannedProductionMinutes,
      downtimeMinutes,
      totalProducedUnits,
      goodUnits,
      idealCycleTimeSeconds: 6.0,
    });
  }, [selectedLineId, lines.length, filteredMaintenance, filteredWorkOrders]);

  // Maintenance response & repair duration (MTTR)
  const maintenanceSummary = useMemo(() => {
    let responseSumMin = 0;
    let responseCount = 0;
    let repairSumMin = 0;
    let repairCount = 0;

    for (const req of filteredMaintenance) {
      if (req.repairStartedAt) {
        const respMin = Math.max(
          1,
          Math.round(
            (new Date(req.repairStartedAt).getTime() -
              new Date(req.reportedAt).getTime()) /
              60000
          )
        );
        responseSumMin += respMin;
        responseCount += 1;
      }
      if (req.repairStartedAt && req.repairCompletedAt) {
        const repMin = Math.max(
          1,
          Math.round(
            (new Date(req.repairCompletedAt).getTime() -
              new Date(req.repairStartedAt).getTime()) /
              60000
          )
        );
        repairSumMin += repMin;
        repairCount += 1;
      }
    }

    const avgResponseMin =
      responseCount > 0 ? Math.round(responseSumMin / responseCount) : 0;
    const avgRepairMin =
      repairCount > 0 ? Math.round(repairSumMin / repairCount) : 0;

    const completedWoCount = filteredWorkOrders.filter(
      (w) => w.status === "Completed"
    ).length;
    const woCompletionRatePct =
      filteredWorkOrders.length > 0
        ? Number(
            ((completedWoCount / filteredWorkOrders.length) * 100).toFixed(1)
          )
        : 0;

    return {
      avgResponseMin,
      avgRepairMin,
      woCompletionRatePct,
      completedWoCount,
      totalWoCount: filteredWorkOrders.length,
    };
  }, [filteredMaintenance, filteredWorkOrders]);

  // Downtime by machine chart data
  const downtimeByMachineData = useMemo(() => {
    return filteredMachines.map((m) => ({
      station: m.stationCode,
      name: m.name,
      downtimeMin: m.downtimeMinutesToday,
      defectRatePct: calculateDefectRatePct(m.defectQuantity, m.currentOutput),
    }));
  }, [filteredMachines]);

  // Material consumption data (from Issue transactions)
  const materialConsumptionData = useMemo(() => {
    return materials.map((mat) => {
      const issued = inventoryTransactions
        .filter(
          (tx) => tx.materialId === mat.id && tx.transactionType === "Issue"
        )
        .reduce((sum, tx) => sum + Math.abs(tx.quantityDelta), 0);
      return {
        code: mat.code,
        name: mat.name,
        consumed: issued,
        available: mat.quantityAvailable,
        unit: mat.unit,
      };
    });
  }, [materials, inventoryTransactions]);

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Manufacturing Analytics & OEE Breakdown
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Supervisor & plant manager performance summary with transparent OEE
            denominators, MTTR metrics, and material consumption.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              aria-label="Analytics Line Filter"
              value={selectedLineId}
              onChange={(e) => setSelectedLineId(e.target.value)}
              className="bg-transparent font-medium focus:outline-none"
            >
              <option value="ALL">All Packaging Lines</option>
              {lines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <select
            aria-label="Analytics Shift Filter"
            value={shiftFilter}
            onChange={(e) => setShiftFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
          >
            <option value="ALL">All Shifts</option>
            <option value="Shift A (06:00-14:00)">Shift A (06:00-14:00)</option>
            <option value="Shift B (14:00-22:00)">Shift B (14:00-22:00)</option>
            <option value="Shift C (22:00-06:00)">Shift C (22:00-06:00)</option>
          </select>
        </div>
      </div>

      {/* OEE Component Breakdown Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          data-testid="oee-overall-card"
          className="bg-slate-900 text-white border border-slate-800 rounded-md p-4 shadow-sm"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Overall Equipment Effectiveness (OEE)</span>
            <Gauge className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-3xl font-bold font-mono text-blue-400 mt-2">
            {oeeMetrics.oeePct}%
          </div>
          <div className="text-[11px] font-mono text-slate-400 mt-2">
            Availability × Performance × Quality
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 shadow-sm">
          <div className="text-xs text-slate-500">1. Availability</div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1.5">
            {oeeMetrics.availabilityPct}%
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-2">
            Run Time: {oeeMetrics.runTimeMinutes}m / Planned Time
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 shadow-sm">
          <div className="text-xs text-slate-500">2. Performance</div>
          <div className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1.5">
            {oeeMetrics.performancePct}%
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-2">
            (Total Units × 6.0s Ideal Cycle) / Run Time
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 shadow-sm">
          <div className="text-xs text-slate-500">3. Quality</div>
          <div className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1.5">
            {oeeMetrics.qualityPct}%
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-2">
            Good Units / Total Produced Units
          </div>
        </div>
      </div>

      {/* Documented Formula & Denominator Assumptions Notice */}
      <div className="p-3.5 rounded-md bg-blue-500/10 border border-blue-500/25 flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
        <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div>
          <strong>OEE Formula & Denominator Assumptions:</strong> Planned Shift
          Time is defined as 480 minutes per active line. Run Time subtracts
          merged non-overlapping unplanned downtime intervals. Ideal Cycle Time
          is standardized at 6.0 seconds/case. All values reflect the current
          Demo/Simulated dataset and are separated from physical PLC telemetry.
        </div>
      </div>

      {/* Secondary KPIs: MTTR, Response Time, Work Order Completion */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">
              Mean Maintenance Response Time
            </div>
            <div className="text-xl font-bold font-mono mt-1">
              {maintenanceSummary.avgResponseMin} min
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Breakdown reported &rarr; LOTO & repair start
            </div>
          </div>
          <Clock className="w-6 h-6 text-amber-500" />
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">
              Mean Time To Repair (MTTR)
            </div>
            <div className="text-xl font-bold font-mono mt-1">
              {maintenanceSummary.avgRepairMin} min
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Active repair start &rarr; verified resolution
            </div>
          </div>
          <Wrench className="w-6 h-6 text-rose-500" />
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">
              Work Order Schedule Completion
            </div>
            <div className="text-xl font-bold font-mono mt-1">
              {maintenanceSummary.woCompletionRatePct}% (
              {maintenanceSummary.completedWoCount}/
              {maintenanceSummary.totalWoCount})
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Completed orders vs total scheduled
            </div>
          </div>
          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
        </div>
      </div>

      {/* Charts Row: Downtime by Machine + Material Consumption */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Downtime (Minutes) & Defect Rate (%) by Machine
          </h2>
          <p className="text-[11px] text-slate-500 mb-3">
            Identifies bottleneck stations requiring preventive maintenance
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={downtimeByMachineData}
                margin={{ top: 8, right: 10, left: -15, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#334155"
                  opacity={0.2}
                />
                <XAxis dataKey="station" tick={{ fontSize: 11 }} />
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
                  dataKey="downtimeMin"
                  name="Downtime (min)"
                  fill="#f59e0b"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Packaging Material Consumption vs Available Stock
          </h2>
          <p className="text-[11px] text-slate-500 mb-3">
            Derived from audited material issue transactions
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2 px-2 font-medium">Material Code</th>
                  <th className="py-2 px-2 font-medium">Description</th>
                  <th className="py-2 px-2 font-medium text-right">
                    Issued Today
                  </th>
                  <th className="py-2 px-2 font-medium text-right">
                    Current Balance
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {materialConsumptionData.map((m) => (
                  <tr key={m.code}>
                    <td className="py-2.5 px-2 font-mono font-bold">
                      {m.code}
                    </td>
                    <td className="py-2.5 px-2">{m.name}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-blue-600 dark:text-blue-400 font-semibold">
                      {m.consumed.toLocaleString()} {m.unit}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono">
                      {m.available.toLocaleString()} {m.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
