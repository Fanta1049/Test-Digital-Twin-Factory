"use client";

import React, { useState } from "react";
import { useFactoryStore } from "@/lib/store/factory-store";
import {
  Bot,
  CheckCircle2,
  FileText,
  Loader2,
  Send,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";

interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: string[];
  providerMode?: string;
  timestamp: string;
}

const SUGGESTED_PROMPTS = [
  "What caused the production drop this shift?",
  "Which machines had the most downtime this week?",
  "Summarize the unresolved issues for the next shift.",
  "Show the most common packaging defects.",
  "Find the approved troubleshooting procedure for Station C.",
];

export function AiAssistantDrawer() {
  const {
    aiDrawerOpen,
    setAiDrawerOpen,
    machines,
    workOrders,
    productionRecords,
    maintenanceRequests,
    qualityInspections,
    materials,
    shiftHandovers,
  } = useFactoryStore();

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatTurn[]>([
    {
      id: "WELCOME-1",
      role: "assistant",
      content:
        "Hello! I am the **FantaFac AI Production Assistant**. Every response I generate is strictly grounded in your live shop-floor work orders, machine telemetry/status events, maintenance tickets, and quality inspection logs.\n\nSelect a prompt below or ask a question about current operations.",
      citations: ["System: Grounded Read-Only Mode"],
      providerMode: "Grounded Deterministic Engine (Demo Mode)",
      timestamp: new Date().toISOString(),
    },
  ]);

  if (!aiDrawerOpen) return null;

  async function handleSend(queryText?: string) {
    const q = (queryText ?? input).trim();
    if (!q || loading) return;

    const userTurn: ChatTurn = {
      id: `USR-${Date.now()}`,
      role: "user",
      content: q,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userTurn]);
    if (!queryText) setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          snapshot: {
            machines,
            workOrders,
            productionRecords,
            maintenanceRequests,
            qualityInspections,
            materials,
            shiftHandovers,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Assistant request failed");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `AST-${Date.now()}`,
          role: "assistant",
          content: data.answer,
          citations: data.citations || [],
          providerMode: data.providerMode,
          timestamp: data.timestamp || new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `ERR-${Date.now()}`,
          role: "assistant",
          content: `Unable to process query: ${
            err instanceof Error ? err.message : "Unknown error"
          }`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-[1px]"
      role="dialog"
      aria-label="AI Production Assistant"
    >
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-white">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                AI Production Assistant
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                Grounded in Live Factory Store • Read-Only Safety Guard
              </p>
            </div>
          </div>
          <button
            onClick={() => setAiDrawerOpen(false)}
            className="p-1.5 rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800"
            aria-label="Close AI Assistant"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Safety Policy Banner */}
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-start gap-2 text-[11px] text-amber-800 dark:text-amber-300">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <span>
            Advisory mode only: The assistant never fabricates telemetry and
            cannot bypass LOTO or machine safety interlocks.
          </span>
        </div>

        {/* Suggested Prompts */}
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-blue-500" />
            Quick Shop-Floor Prompts
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handleSend(prompt)}
                disabled={loading}
                className="text-left text-[11px] px-2.5 py-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${
                m.role === "user" ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`max-w-[92%] rounded-lg px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                }`}
              >
                {m.content}
              </div>

              {m.citations && m.citations.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {m.citations.map((cit) => (
                    <span
                      key={cit}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                    >
                      <FileText className="w-2.5 h-2.5" />
                      {cit}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
              Analyzing live factory records...
            </div>
          )}
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about shift output, downtime, defects, or SOPs..."
            className="flex-1 text-xs px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium inline-flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            Ask
          </button>
        </form>
      </div>
    </div>
  );
}
