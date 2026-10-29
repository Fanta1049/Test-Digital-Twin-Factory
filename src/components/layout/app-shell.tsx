"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFactoryStore } from "@/lib/store/factory-store";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  Box,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Cpu,
  Database,
  Factory,
  Gauge,
  HandMetal,
  Layers,
  Menu,
  Moon,
  PackageSearch,
  Settings,
  Shield,
  Sun,
  Wrench,
  X,
} from "lucide-react";
import { AiAssistantDrawer } from "../assistant/ai-assistant-drawer";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeKey?: "maintenance" | "notifications" | "handover";
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/production", label: "Production Tracking", icon: Activity },
  { href: "/work-orders", label: "Work Orders", icon: ClipboardList },
  { href: "/machines", label: "Machines", icon: Cpu },
  {
    href: "/maintenance",
    label: "Maintenance",
    icon: Wrench,
    badgeKey: "maintenance",
  },
  { href: "/quality", label: "Quality Control", icon: ClipboardCheck },
  { href: "/inventory", label: "Packaging Inventory", icon: PackageSearch },
  {
    href: "/shift-handover",
    label: "Shift Handover",
    icon: HandMetal,
    badgeKey: "handover",
  },
  { href: "/digital-twin", label: "3D Digital Twin", icon: Box },
  { href: "/analytics", label: "Analytics & OEE", icon: BarChart3 },
  {
    href: "/notifications",
    label: "Notifications",
    icon: Bell,
    badgeKey: "notifications",
  },
  { href: "/settings", label: "Settings & RBAC", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    facilities,
    selectedFacilityId,
    setSelectedFacilityId,
    lines,
    selectedLineId,
    setSelectedLineId,
    users,
    currentUser,
    setCurrentUserId,
    persistenceMode,
    maintenanceRequests,
    notifications,
    shiftHandovers,
    toasts,
    dismissToast,
    setAiDrawerOpen,
  } = useFactoryStore();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("fantafac_theme");
    if (savedTheme === "dark") {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  function toggleTheme() {
    const next = !darkMode;
    setDarkMode(next);
    if (next) {
      document.documentElement.classList.add("dark");
      window.localStorage.setItem("fantafac_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      window.localStorage.setItem("fantafac_theme", "light");
    }
  }

  const openMaintenanceCount = maintenanceRequests.filter(
    (m) => m.status !== "Closed" && m.status !== "Resolved"
  ).length;
  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;
  const unackedHandoverCount = shiftHandovers.filter(
    (h) => !h.acknowledgedBy
  ).length;

  function getBadgeValue(key?: NavItem["badgeKey"]): number {
    if (key === "maintenance") return openMaintenanceCount;
    if (key === "notifications") return unreadNotificationsCount;
    if (key === "handover") return unackedHandoverCount;
    return 0;
  }

  const activeNavItem =
    NAV_ITEMS.find((item) => pathname.startsWith(item.href)) || NAV_ITEMS[0];

  return (
    <div className="min-h-screen flex bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col border-r border-slate-200 dark:border-slate-800 bg-slate-900 text-slate-100 transition-all duration-200 shrink-0 ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        {/* Brand Header */}
        <div className="h-14 px-3.5 flex items-center justify-between border-b border-slate-800">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 overflow-hidden"
          >
            <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-white shrink-0 font-bold">
              <Factory className="w-4 h-4" />
            </div>
            {!collapsed && (
              <div className="leading-tight truncate">
                <div className="text-sm font-bold tracking-tight text-white">
                  FANTAFAC MES
                </div>
                <div className="text-[10px] font-mono text-slate-400">
                  PACKAGING OPS v2.4
                </div>
              </div>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const badgeCount = getBadgeValue(item.badgeKey);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center justify-between px-2.5 py-2 rounded text-xs font-medium transition-colors ${
                  active
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon className="w-4 h-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </div>
                {!collapsed && badgeCount > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-semibold ${
                      active
                        ? "bg-white text-blue-700"
                        : item.badgeKey === "maintenance"
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    }`}
                  >
                    {badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Persistence Mode Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60">
          {!collapsed ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-300">
                <Database className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{persistenceMode}</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-snug">
                Changes persist in local browser storage. Configure Supabase env
                vars for cloud PostgreSQL + RLS.
              </p>
            </div>
          ) : (
            <div
              className="flex justify-center text-amber-400"
              title={persistenceMode}
            >
              <Database className="w-4 h-4" />
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] bg-slate-900 text-slate-100 h-full flex flex-col z-10">
            <div className="h-14 px-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Factory className="w-5 h-5 text-blue-500" />
                <span className="font-bold text-sm">FANTAFAC MES</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
                aria-label="Close mobile menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                const badgeCount = getBadgeValue(item.badgeKey);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded text-xs font-medium ${
                      active
                        ? "bg-blue-600 text-white"
                        : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </span>
                    {badgeCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px]">
                        {badgeCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Operational Bar */}
        <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between gap-3 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              aria-label="Open navigation menu"
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Breadcrumb */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">
              <span className="font-mono text-[11px] text-slate-400">
                MES
              </span>
              <span>/</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                {activeNavItem.label}
              </span>
            </div>

            {/* Facility Selector */}
            <div className="hidden md:flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-800">
              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                aria-label="Select Production Facility"
                value={selectedFacilityId}
                onChange={(e) => setSelectedFacilityId(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {facilities.map((fac) => (
                  <option key={fac.id} value={fac.id}>
                    {fac.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Global Production Line Filter */}
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0 hidden sm:inline" />
              <select
                aria-label="Filter by Production Line"
                value={selectedLineId}
                onChange={(e) => setSelectedLineId(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All Packaging Lines</option>
                {lines.map((line) => (
                  <option key={line.id} value={line.id}>
                    {line.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Right Controls: AI Assistant, Notifications, Role Selector, Theme */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setAiDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors"
            >
              <Bot className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">AI Assistant</span>
            </button>

            <Link
              href="/notifications"
              className="relative p-1.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadNotificationsCount}
                </span>
              )}
            </Link>

            {/* Demo RBAC Role Switcher */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1">
              <Shield className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              <select
                aria-label="Active User & Role (Demo RBAC)"
                value={currentUser.id}
                onChange={(e) => setCurrentUserId(e.target.value)}
                className="text-xs bg-transparent text-slate-800 dark:text-slate-200 font-medium focus:outline-none max-w-[155px] sm:max-w-[210px] truncate"
              >
                {users.map((u) => (
                  <option
                    key={u.id}
                    value={u.id}
                    className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  >
                    {u.fullName} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              aria-label="Toggle color theme"
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* AI Assistant Drawer */}
      <AiAssistantDrawer />

      {/* Toast Notification Stack */}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start justify-between gap-3 p-3 rounded-md shadow-lg border text-xs ${
              t.type === "error"
                ? "bg-rose-950 text-rose-100 border-rose-700"
                : t.type === "warning"
                ? "bg-amber-950 text-amber-100 border-amber-700"
                : t.type === "success"
                ? "bg-emerald-950 text-emerald-100 border-emerald-700"
                : "bg-slate-900 text-slate-100 border-slate-700"
            }`}
          >
            <div className="flex items-start gap-2">
              {t.type === "error" || t.type === "warning" ? (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              )}
              <div>
                <div className="font-semibold">{t.title}</div>
                {t.description && (
                  <div className="text-[11px] opacity-90 mt-0.5">
                    {t.description}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => dismissToast(t.id)}
              className="opacity-70 hover:opacity-100"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
