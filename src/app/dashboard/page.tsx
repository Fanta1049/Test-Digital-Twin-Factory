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
  MachineStatusBadge,
  PriorityBadge,
  WorkOrderStatusBadge,
} from "@/components/ui/badges";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Box,
  CheckCircle2,
  Clock,
  Cpu,
  Filter,
  Layers,
  PlusCircle,
  TrendingUp,
  Wrench,
  XCircle,
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

export default function DashboardPage() {
  const {
    hydrated,
    lines,
    selectedLineId,
    setSelectedLineId,
    machines,
    workOrders,
    productionRecords,
    maintenanceRequests,
    notifications,
    products,
  } = useFactoryStore();

  const [dateRange, setDateRange] = useState<"today" | "7d" | "all">("today");

  // Filter canonical datasets by selected production line
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

  const filteredRecords = useMemo(
    () =>
      selectedLineId === "ALL"
        ? productionRecords
        : productionRecords.filter((r) => r.lineId === selectedLineId),
    [productionRecords, selectedLineId]
  );

  const filteredMaintenance = useMemo(
    () =>
      selectedLineId === "ALL"
        ? maintenanceRequests
        : maintenanceRequests.filter((m) => m.lineId === selectedLineId),
    [maintenanceRequests, selectedLineId]
  );

  // Derive top-level KPI metrics from canonical work orders & records
  const kpis = useMemo(() => {
    const activeTodayOrders =
      dateRange === "today"
        ? filteredWorkOrders.filter((w) => w.status !== "Cancelled")
        : filteredWorkOrders;

    const totalProduced = activeTodayOrders.reduce(
      (sum, w) => sum + w.producedQuantity,
      0
    );
    const totalTarget = activeTodayOrders.reduce(
      (sum, w) => sum + w.plannedQuantity,
      0
    );
    const goodUnits = activeTodayOrders.reduce(
      (sum, w) => sum + w.goodQuantity,
      0
    );
    const defectiveUnits = activeTodayOrders.reduce(
      (sum, w) => sum + w.defectiveQuantity,
      0
    );

    const targetAchievementPct =
      totalTarget > 0
        ? Number(((goodUnits / totalTarget) * 100).toFixed(1))
        : 0;
    const defectRatePct = calculateDefectRatePct(defectiveUnits, totalProduced);

    const activeMachines = filteredMachines.filter(
      (m) => m.status === "Running"
    ).length;
    const idleMachines = filteredMachines.filter(
      (m) => m.status === "Idle"
    ).length;
    const warningMachines = filteredMachines.filter(
      (m) => m.status === "Warning"
    ).length;
    const errorMachines = filteredMachines.filter(
      (m) => m.status === "Error"
    ).length;
    const maintenanceMachines = filteredMachines.filter(
      (m) => m.status === "Maintenance"
    ).length;

    const downtimeMinutesToday = filteredMachines.reduce(
      (sum, m) => sum + m.downtimeMinutesToday,
      0
    );
    const openMaintenanceCount = filteredMaintenance.filter(
      (m) => m.status !== "Closed" && m.status !== "Resolved"
    ).length;

    return {
      totalProduced,
      totalTarget,
      targetAchievementPct,
      goodUnits,
      defectiveUnits,
      defectRatePct,
      activeMachines,
      idleMachines,
      warningMachines,
      errorMachines,
      maintenanceMachines,
      downtimeMinutesToday,
      openMaintenanceCount,
    };
  }, [filteredWorkOrders, filteredMachines, filteredMaintenance, dateRange]);

  // Hourly production chart data derived from productionRecords
  const hourlyChartData = useMemo(() => {
    const slotMap = new Map<
      string,
      {
        slot: string;
        good: number;
        defective: number;
        total: number;
        target: number;
        defectRatePct: number;
      }
    >();

    const hourlyTarget =
      selectedLineId === "ALL" ? 420 : selectedLineId === "LINE-PKG-01" ? 400 : 350;

    // Order chronologically by hourSlot
    const sorted = [...filteredRecords].sort((a, b) =>
      a.hourSlot.localeCompare(b.hourSlot)
    );

    for (const rec of sorted) {
      const existing = slotMap.get(rec.hourSlot) || {
        slot: rec.hourSlot,
        good: 0,
        defective: 0,
        total: 0,
        target: hourlyTarget,
        defectRatePct: 0,
      };
      existing.good += rec.goodQuantity;
      existing.defective += rec.defectiveQuantity;
      existing.total += rec.producedQuantity;
      existing.defectRatePct = calculateDefectRatePct(
        existing.defective,
        existing.total
      );
      slotMap.set(rec.hourSlot, existing);
    }

    return Array.from(slotMap.values());
  }, [filteredRecords, selectedLineId]);

  // Output vs Target by Work Order chart
  const woOutputVsTargetData = useMemo(() => {
    return filteredWorkOrders.map((wo) => {
      const prod = products.find((p) => p.id === wo.productId);
      return {
        name: wo.id,
        product: prod?.name || wo.productId,
        Good: wo.goodQuantity,
        Defective: wo.defectiveQuantity,
        Target: wo.plannedQuantity,
      };
    });
  }, [filteredWorkOrders, products]);

  if (!hydrated) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className="h-28 bg-slate-200 dark:bg-slate-800 rounded"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Title & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Shop-Floor Operations Dashboard
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time production KPIs, machine fleet states, and active work
            orders derived from canonical plant records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              aria-label="Dashboard Line Filter"
              value={selectedLineId}
              onChange={(e) => setSelectedLineId(e.target.value)}
              className="bg-transparent font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="ALL">All Packaging Lines</option>
              {lines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div className="inline-flex rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-0.5 text-xs">
            {(
              [
                { id: "today", label: "Shift / Today" },
                { id: "7d", label: "Last 7 Days" },
                { id: "all", label: "All Records" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDateRange(opt.id)}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  dateRange === opt.id
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <Link
            href="/production"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-sm"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Record Output
          </Link>

          <Link
            href="/digital-twin"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white text-xs font-medium border border-slate-700"
          >
            <Box className="w-3.5 h-3.5 text-blue-400" />
            3D Digital Twin
          </Link>
        </div>
      </div>

      {/* Top KPI Grid (5 Cards covering all 10 required metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Total Produced & Target Achievement */}
        <div
          data-testid="kpi-total-produced"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 shadow-sm"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium">Total Units Produced</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
              {kpis.totalProduced.toLocaleString()}
            </span>
            <span className="text-xs font-mono text-slate-500">
              / {kpis.totalTarget.toLocaleString()} target
            </span>
          </div>
          <div className="mt-2.5">
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-500">Target Achievement</span>
              <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                {kpis.targetAchievementPct}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all"
                style={{ width: `${Math.min(100, kpis.targetAchievementPct)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Good Units vs Defective Units */}
        <div
          data-testid="kpi-good-defective"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 shadow-sm"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium">Good vs Defective Units</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {kpis.goodUnits.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">good</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-rose-600 dark:text-rose-400 font-mono font-medium">
              {kpis.defectiveUnits.toLocaleString()} defective
            </span>
            <span
              className={`px-1.5 py-0.5 rounded font-mono text-[11px] ${
                kpis.defectRatePct > 2.5
                  ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                  : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              }`}
            >
              {kpis.defectRatePct}% scrap
            </span>
          </div>
        </div>

        {/* Card 3: Fleet Status (Running / Idle / Error) */}
        <div
          data-testid="kpi-machine-states"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 shadow-sm"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium">Machine Fleet States</span>
            <Cpu className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {kpis.activeMachines}
            </span>
            <span className="text-xs text-slate-500">
              / {filteredMachines.length} Running
            </span>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] pt-2 border-t border-slate-100 dark:border-slate-800 font-mono">
            <span className="text-slate-600 dark:text-slate-400">
              Idle: {kpis.idleMachines}
            </span>
            <span className="text-amber-600 dark:text-amber-400">
              Warn: {kpis.warningMachines}
            </span>
            <span className="text-rose-600 dark:text-rose-400 font-semibold">
              Err: {kpis.errorMachines}
            </span>
            <span className="text-blue-600 dark:text-blue-400">
              Mnt: {kpis.maintenanceMachines}
            </span>
          </div>
        </div>

        {/* Card 4: Downtime Today */}
        <div
          data-testid="kpi-downtime"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 shadow-sm"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium">Cumulative Downtime Today</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
              {kpis.downtimeMinutesToday}
            </span>
            <span className="text-xs text-slate-500">minutes</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] pt-2 border-t border-slate-100 dark:border-slate-800 text-slate-500">
            <span>Non-overlapping log sum</span>
            <Link
              href="/analytics"
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              OEE Impact &rarr;
            </Link>
          </div>
        </div>

        {/* Card 5: Open Maintenance Requests */}
        <div
          data-testid="kpi-open-maintenance"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 shadow-sm"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium">Open Maintenance Tickets</span>
            <Wrench className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold font-mono ${
                kpis.openMaintenanceCount > 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-emerald-600"
              }`}
            >
              {kpis.openMaintenanceCount}
            </span>
            <span className="text-xs text-slate-500">active tickets</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-slate-500">
              Total logged: {filteredMaintenance.length}
            </span>
            <Link
              href="/maintenance"
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Dispatch &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Charts Row: Actual Output vs Target + Hourly Production & Defect Rate Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart 1: Actual Output vs Target by Work Order */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Actual Output vs Target (Work Orders)
              </h2>
              <p className="text-[11px] text-slate-500">
                Good & defective output compared against planned order target
              </p>
            </div>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={woOutputVsTargetData}
                margin={{ top: 8, right: 10, left: -15, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
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
                <Bar dataKey="Good" fill="#10b981" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Defective" fill="#f43f5e" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Target" fill="#3b82f6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Hourly Production Output */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Hourly Production Output
              </h2>
              <p className="text-[11px] text-slate-500">
                Good units vs defective units recorded per shift hour slot
              </p>
            </div>
          </div>
          <div className="h-60">
            {hourlyChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No hourly production records for selected line.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={hourlyChartData}
                  margin={{ top: 8, right: 10, left: -15, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#334155"
                    opacity={0.2}
                  />
                  <XAxis dataKey="slot" tick={{ fontSize: 10 }} />
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
                    dataKey="good"
                    name="Good Units"
                    stackId="a"
                    fill="#2563eb"
                  />
                  <Bar
                    dataKey="defective"
                    name="Defective"
                    stackId="a"
                    fill="#f59e0b"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 3: Hourly Defect Rate Trend */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Hourly Defect Rate Trend (%)
              </h2>
              <p className="text-[11px] text-slate-500">
                Scrap percentage per hour slot across active runs
              </p>
            </div>
          </div>
          <div className="h-60">
            {hourlyChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No defect trend records available.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={hourlyChartData}
                  margin={{ top: 8, right: 12, left: -15, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#334155"
                    opacity={0.2}
                  />
                  <XAxis dataKey="slot" tick={{ fontSize: 10 }} />
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
                    name="Defect Rate (%)"
                    stroke="#f43f5e"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Machine Status Matrix & Active Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Machine Status Overview (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Machine Status Overview (Stations A–E & Secondary Line)
              </h2>
              <p className="text-[11px] text-slate-500">
                Synchronized with Digital Twin & Maintenance state machine
              </p>
            </div>
            <Link
              href="/machines"
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
            >
              Full Registry <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-2 px-2.5 font-medium">Station / ID</th>
                  <th className="py-2 px-2.5 font-medium">Machine</th>
                  <th className="py-2 px-2.5 font-medium">Status</th>
                  <th className="py-2 px-2.5 font-medium">Data Source</th>
                  <th className="py-2 px-2.5 font-medium text-right">
                    Good / Scrap
                  </th>
                  <th className="py-2 px-2.5 font-medium text-right">
                    Downtime
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {filteredMachines.map((m) => (
                  <tr
                    key={m.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="py-2.5 px-2.5 font-mono font-medium">
                      <div>{m.stationCode}</div>
                      <div className="text-[10px] text-slate-400">{m.id}</div>
                    </td>
                    <td className="py-2.5 px-2.5">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {m.name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {m.machineType} • Cap: {m.capacityPerHour}/hr
                      </div>
                    </td>
                    <td className="py-2.5 px-2.5">
                      <MachineStatusBadge status={m.status} />
                    </td>
                    <td className="py-2.5 px-2.5">
                      <DataSourceBadge source={m.dataSource} />
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono">
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        {m.goodQuantity.toLocaleString()}
                      </span>{" "}
                      /{" "}
                      <span className="text-rose-500">{m.defectQuantity}</span>
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono">
                      {m.downtimeMinutesToday} min
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Alerts & Notifications */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Recent Operational Alerts
              </h2>
              <p className="text-[11px] text-slate-500">
                Live breakdown, quality, and stock triggers
              </p>
            </div>
            <Link
              href="/notifications"
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              View All
            </Link>
          </div>

          <div className="space-y-2.5 flex-1 overflow-y-auto max-h-80">
            {notifications.slice(0, 5).map((ntf) => (
              <div
                key={ntf.id}
                className={`p-2.5 rounded border text-xs ${
                  !ntf.read
                    ? "bg-slate-50 dark:bg-slate-800/70 border-slate-300 dark:border-slate-700"
                    : "border-slate-100 dark:border-slate-800 opacity-80"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <PriorityBadge priority={ntf.severity} />
                  <span className="text-[10px] font-mono text-slate-400">
                    {ntf.category}
                  </span>
                </div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {ntf.title}
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">
                  {ntf.message}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row: Active Work Orders & Recent Production Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Active Work Orders */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Active Production Work Orders
              </h2>
              <p className="text-[11px] text-slate-500">
                Progress against planned order quantities
              </p>
            </div>
            <Link
              href="/work-orders"
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
            >
              Manage Orders <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {filteredWorkOrders.map((wo) => {
              const prod = products.find((p) => p.id === wo.productId);
              const pct = calculateWorkOrderCompletion(
                wo.goodQuantity,
                wo.plannedQuantity
              );
              return (
                <div
                  key={wo.id}
                  className="p-3 rounded border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                        {wo.id}
                      </span>
                      <WorkOrderStatusBadge status={wo.status} />
                      <PriorityBadge priority={wo.priority} />
                    </div>
                    <span className="text-xs font-mono text-slate-500">
                      {wo.lineId} • {wo.assignedShift}
                    </span>
                  </div>
                  <div className="text-xs font-medium text-slate-800 dark:text-slate-200 mt-1.5">
                    {prod?.name || wo.productId}
                  </div>
                  <div className="mt-2">
                    <div className="flex justify-between text-[11px] font-mono mb-1">
                      <span>
                        Good: {wo.goodQuantity.toLocaleString()} / Planned:{" "}
                        {wo.plannedQuantity.toLocaleString()} (Scrap:{" "}
                        {wo.defectiveQuantity})
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
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Production Events */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Recent Production Output Events
              </h2>
              <p className="text-[11px] text-slate-500">
                Audited shift output entries with source classification
              </p>
            </div>
            <Link
              href="/production"
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
            >
              Production Log <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2 px-2 font-medium">Record / Slot</th>
                  <th className="py-2 px-2 font-medium">Work Order</th>
                  <th className="py-2 px-2 font-medium">Good / Scrap</th>
                  <th className="py-2 px-2 font-medium">Source</th>
                  <th className="py-2 px-2 font-medium">Operator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {filteredRecords.slice(0, 6).map((rec) => (
                  <tr key={rec.id}>
                    <td className="py-2 px-2 font-mono">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {rec.hourSlot}
                      </div>
                      <div className="text-[10px] text-slate-400">{rec.id}</div>
                    </td>
                    <td className="py-2 px-2 font-mono">{rec.workOrderId}</td>
                    <td className="py-2 px-2 font-mono">
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        +{rec.goodQuantity}
                      </span>{" "}
                      /{" "}
                      <span className="text-rose-500">
                        {rec.defectiveQuantity}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <DataSourceBadge source={rec.dataSource} />
                    </td>
                    <td className="py-2 px-2 text-slate-600 dark:text-slate-300">
                      {rec.recordedBy}
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
