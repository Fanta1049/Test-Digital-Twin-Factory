"use client";

import React from "react";
import { useFactoryStore } from "@/lib/store/factory-store";
import { getRolePermissions } from "@/lib/domain/logic";
import { DataSourceBadge } from "@/components/ui/badges";
import {
  Database,
  History,
  RotateCcw,
  Settings,
  Shield,
} from "lucide-react";

export default function SettingsPage() {
  const {
    persistenceMode,
    users,
    currentUser,
    setCurrentUserId,
    qualityThresholdPct,
    setQualityThresholdPct,
    resetDemoData,
    auditLogs,
  } = useFactoryStore();

  const currentPermissions = getRolePermissions(currentUser.role);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            System Settings, RBAC Matrix & Audit Log
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure quality thresholds, inspect role-based access permissions,
            manage demo persistence state, and review the immutable audit trail.
          </p>
        </div>

        <button
          type="button"
          data-testid="reset-demo-data-btn"
          onClick={resetDemoData}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset All Demo Data to Seed State
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Persistence & Operational Parameters */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Database className="w-4 h-4 text-blue-600" />
            Data Persistence & Telemetry Architecture
          </div>

          <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Active Storage Mode:</span>
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                {persistenceMode}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              When <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
              <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> are omitted, FantaFac
              runs in deterministic Local Demo Persistence mode backed by{" "}
              <code>localStorage</code>. It never claims remote database writes
              when running in local demo mode.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Default AQL Quality Defect Rate Warning Threshold (%)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="20"
                value={qualityThresholdPct}
                onChange={(e) =>
                  setQualityThresholdPct(Number(e.target.value))
                }
                className="w-28 px-3 py-1.5 text-xs font-mono rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
              <span className="text-xs text-slate-500">
                Inspections exceeding {qualityThresholdPct}% automatically
                trigger high-priority quality alerts.
              </span>
            </div>
          </div>
        </div>

        {/* RBAC Role Switcher & Permission Inspector */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Shield className="w-4 h-4 text-blue-600" />
            Role-Based Access Control (Demo Context Switcher)
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Select Active Personnel Profile
            </label>
            <select
              value={currentUser.id}
              onChange={(e) => setCurrentUserId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} — {u.role} ({u.employeeCode})
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-xs font-semibold mb-1.5">
              Authorized Actions for Role{" "}
              <span className="text-blue-600 dark:text-blue-400">
                {currentUser.role}
              </span>
              :
            </div>
            <div className="flex flex-wrap gap-1.5">
              {currentPermissions.map((perm) => (
                <span
                  key={perm}
                  className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25"
                >
                  {perm}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* System Audit Log Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-1.5">
          <History className="w-4 h-4 text-blue-500" />
          System-Wide Security & Operational Audit Trail ({auditLogs.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-2 px-2.5 font-medium">Audit ID</th>
                <th className="py-2 px-2.5 font-medium">Timestamp</th>
                <th className="py-2 px-2.5 font-medium">Actor & Role</th>
                <th className="py-2 px-2.5 font-medium">Action</th>
                <th className="py-2 px-2.5 font-medium">Entity</th>
                <th className="py-2 px-2.5 font-medium">Source</th>
                <th className="py-2 px-2.5 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td className="py-2 px-2.5 font-mono font-semibold">
                    {log.id}
                  </td>
                  <td className="py-2 px-2.5 font-mono text-[11px] text-slate-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="py-2 px-2.5">
                    <span className="font-medium">{log.actor}</span>{" "}
                    <span className="text-[11px] text-slate-400">
                      ({log.actorRole})
                    </span>
                  </td>
                  <td className="py-2 px-2.5 font-mono text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                    {log.action}
                  </td>
                  <td className="py-2 px-2.5 font-mono text-[11px]">
                    {log.entityType}: {log.entityId}
                  </td>
                  <td className="py-2 px-2.5">
                    <DataSourceBadge source={log.dataSource} />
                  </td>
                  <td className="py-2 px-2.5 text-slate-600 dark:text-slate-300">
                    {log.details}
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
