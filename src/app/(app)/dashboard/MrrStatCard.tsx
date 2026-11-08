"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, DollarSign, LockKeyhole, Sparkles, Thermometer, Trophy } from "lucide-react";
import type { PastDueEntry } from "@/lib/ar/matchArCustomers";

export type MrrClient = {
  id: string;
  name: string;
  company: string | null;
  mrr: number;
};

export type PipelineMrrPipeline = {
  id: string;
  key: string;
  name: string;
  basis?: "monthly" | "one_time";
  stages: Array<{
    id: string;
    number: number;
    name: string;
    items: Array<{ id: string; name: string; company: string | null; value: number }>;
  }>;
};

function fmtMoney(value: number): string {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function RankMarker({ rank, trophy = false }: { rank: number; trophy?: boolean }) {
  const medalColors = ["#d4a017", "#8b95a1", "#b87333"];
  if (trophy && rank <= 3) {
    const color = medalColors[rank - 1];
    return (
      <span className="inline-flex w-6 shrink-0 items-center justify-center" aria-label={`Rank ${rank}`} title={`Rank ${rank}`}>
        <Trophy size={17} strokeWidth={2.4} fill={color} color={color} />
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold tabular-nums text-slate-600"
      aria-label={`Rank ${rank}`}
      title={`Rank ${rank}`}
    >
      {rank}
    </span>
  );
}

function GoalProgressBar({ value, goal, label }: { value: number; goal: number | null; label: string }) {
  if (!goal || goal <= 0) return null;
  const pct = Math.max(0, Math.min(100, (value / goal) * 100));
  return (
    <div
      role="progressbar"
      aria-label={`${label} progress`}
      aria-valuemin={0}
      aria-valuemax={goal}
      aria-valuenow={Math.min(value, goal)}
      title={`${fmtMoney(value)} of ${fmtMoney(goal)} goal`}
      className="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100"
      style={{ background: "linear-gradient(90deg, #ef4444 0%, #f59e0b 52%, #22c55e 100%)" }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0 transition-[width]"
        style={{
          width: `${100 - pct}%`,
          background: "#f1f5f9",
        }}
      />
    </div>
  );
}

export function MrrStatCard({
  label,
  value,
  current,
  clients,
  pastDueById,
  syncedAsOf,
  goal,
}: {
  label: string;
  value: string;
  current: number;
  clients: MrrClient[];
  pastDueById: Record<string, PastDueEntry>;
  syncedAsOf: string | null;
  goal: number | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex flex-col rounded-xl border border-slate-200 bg-white p-3 sm:col-span-2 sm:p-6 lg:col-span-1">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={open ? "Hide client breakdown" : "Show client breakdown"}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="min-w-0">
          <span className="flex min-w-0 items-start gap-1.5 text-slate-400">
            <DollarSign size={14} className="mt-0.5 shrink-0" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
              {label}
            </span>
          </span>
          <span
            className="mt-1 block text-2xl font-semibold tabular-nums sm:mt-2 sm:text-3xl"
            style={{ color: "var(--text-primary)" }}
          >
            {value}
          </span>
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="mt-2 border-t border-slate-100 pt-2">
          {clients.length > 0 ? (
            <ul className="mt-1 divide-y divide-slate-100">
              {clients.map((client, index) => {
                const rank = index + 1;
                const pastDue = pastDueById[client.id];
                return (
                  <li key={client.id}>
                    <Link
                      href={`/contacts/${client.id}`}
                      className="flex items-center justify-between gap-2 px-1 py-2.5"
                    >
                      <RankMarker rank={rank} trophy />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800">
                          {client.name}
                        </span>
                        {client.company ? (
                          <span className="block truncate text-xs text-slate-400">{client.company}</span>
                        ) : null}
                        {pastDue?.pastDue ? (
                          <span className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] font-semibold text-rose-600">
                            {pastDue.aging.days30 > 0 ? <span>1–30d {fmtMoney(pastDue.aging.days30)}</span> : null}
                            {pastDue.aging.days60 > 0 ? <span>31–60d {fmtMoney(pastDue.aging.days60)}</span> : null}
                            {pastDue.aging.days90 > 0 ? <span>61–90d {fmtMoney(pastDue.aging.days90)}</span> : null}
                            {pastDue.aging.over90 > 0 ? <span>90+d {fmtMoney(pastDue.aging.over90)}</span> : null}
                          </span>
                        ) : null}
                      </span>
                      <span
                        className={`shrink-0 text-sm font-semibold tabular-nums ${pastDue?.pastDue ? "text-rose-700" : "text-slate-900"}`}
                      >
                        {fmtMoney(client.mrr)}/mo
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-1 py-2 text-sm text-slate-500">No clients carry monthly revenue yet.</p>
          )}
          {syncedAsOf ? (
            <p className="px-1 pt-1 text-[11px] text-slate-400">
              Collections as of {new Date(syncedAsOf).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </p>
          ) : null}
        </div>
      ) : null}
      <GoalProgressBar value={current} goal={goal} label="Monthly recurring revenue" />
      {open ? (
        <Link
          href="/dashboard/revenue"
          className="mt-2 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
        >
          Detail
          <ChevronRight size={16} className="text-slate-400" />
        </Link>
      ) : null}
    </div>
  );
}

export function PipelineMrrStatCard({
  pipelineKey,
  stages,
  goal,
  basis = "monthly",
}: {
  pipelineKey: string;
  goal: number | null;
  basis?: "monthly" | "one_time";
  stages: Array<{
    id: string;
    number: number;
    name: string;
    items: Array<{ id: string; name: string; company: string | null; value: number }>;
  }>;
}) {
  const [open, setOpen] = useState(false);
  const [expandedStageId, setExpandedStageId] = useState<string | null>(null);
  const allLeads = stages.flatMap((stage) => stage.items);
  const leadsWithMrr = allLeads.filter((lead) => lead.value > 0);
  const totalMrr = leadsWithMrr.reduce((sum, lead) => sum + lead.value, 0);
  const unit = basis === "monthly" ? "/mo" : "";
  const valueLabel = basis === "monthly" ? "MRR" : "value";

  return (
    <div className="relative flex flex-col rounded-xl border border-slate-200 bg-white p-3 sm:col-span-2 sm:p-6 lg:col-span-1">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={open ? `Hide lead ${valueLabel} breakdown` : `Show lead ${valueLabel} breakdown`}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="min-w-0">
          <span className="flex min-w-0 items-start gap-1.5 text-slate-400">
            <DollarSign size={14} className="mt-0.5 shrink-0" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
              {basis === "monthly" ? "Estimated monthly value" : "Estimated one-time value"} · {leadsWithMrr.length.toLocaleString("en-US")} lead{leadsWithMrr.length === 1 ? "" : "s"}
            </span>
          </span>
          <span className="mt-1 block text-2xl font-semibold tabular-nums sm:mt-2 sm:text-3xl" style={{ color: "var(--text-primary)" }}>
            ${totalMrr.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}{unit}
          </span>
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="mt-2 border-t border-slate-100 pt-2">
          <p className="px-1 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Next sales actions
          </p>
          <ul className="divide-y divide-slate-100">
            {stages.map((stage) => {
              const expanded = expandedStageId === stage.id;
              const stageMrr = stage.items.reduce((sum, lead) => sum + Math.max(0, lead.value), 0);
              const rankedLeads = [...stage.items].sort((left, right) =>
                right.value - left.value || left.name.localeCompare(right.name),
              );
              const stageHeat = [
                { label: "Cold", color: "#3b82f6" },
                { label: "Cool", color: "#06b6d4" },
                { label: "Warm", color: "#eab308" },
                { label: "Hot", color: "#ef4444" },
                { label: "Secured", color: "#16a34a" },
              ][stage.number - 1] ?? { label: "Warm", color: "#eab308" };
              const isPaymentStage = stage.number === 4;
              const isSecuredStage = stage.number === 5;
              return (
                <li key={stage.id}>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setExpandedStageId(expanded ? null : stage.id)}
                    className="flex min-h-12 w-full items-center justify-between gap-3 px-1 py-2.5 text-left"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {isSecuredStage ? (
                        <LockKeyhole size={23} strokeWidth={2.2} className="shrink-0" style={{ color: stageHeat.color }} aria-hidden="true" />
                      ) : (
                        <span className={`relative h-7 w-7 shrink-0 ${isPaymentStage ? "lead-thermometer-hot" : ""}`} aria-hidden="true">
                          <Thermometer size={26} strokeWidth={2.2} style={{ color: stageHeat.color }} />
                          <span
                            className="absolute bottom-[5px] left-1/2 w-[7px] -translate-x-1/2 rounded-full"
                            style={{ height: 7, backgroundColor: stageHeat.color }}
                          />
                          {stage.number > 1 ? (
                            <span
                              className="absolute bottom-[9px] left-1/2 w-[3px] -translate-x-1/2 rounded-full"
                              style={{ height: `${stage.number === 4 ? 12 : (stage.number - 1) * 3}px`, backgroundColor: stageHeat.color }}
                            />
                          ) : null}
                          {isPaymentStage ? <Sparkles size={11} className="lead-thermometer-spark absolute -right-0.5 -top-1 text-amber-300" /> : null}
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-800">{stage.name}</span>
                        <span className="block text-xs text-slate-400">
                          {stage.items.length} lead{stage.items.length === 1 ? "" : "s"}
                        </span>
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-semibold tabular-nums text-slate-800">
                        {stage.items.length === 0
                          ? `$0${unit}`
                          : stageMrr > 0
                            ? `$${stageMrr.toLocaleString("en-US", { maximumFractionDigits: 0 })}${unit}`
                            : `${basis === "monthly" ? "MRR" : "Value"} not set`}
                      </span>
                      <ChevronDown size={16} className={`text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
                    </span>
                  </button>
                  {expanded ? (
                    stage.items.length > 0 ? (
                      <ul className="divide-y divide-slate-100 border-t border-slate-100 bg-slate-50/70 px-2">
                        {rankedLeads.map((lead, index) => (
                          <li key={lead.id}>
                            <Link
                              href={`/leads/${encodeURIComponent(lead.id)}`}
                              className="flex min-h-12 w-full items-center justify-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-white"
                            >
                              <RankMarker rank={index + 1} />
                              <span className="min-w-0 flex-1 text-left">
                                <span className="block truncate text-sm font-medium text-slate-800">{lead.name}</span>
                                {lead.company ? <span className="block truncate text-xs text-slate-400">{lead.company}</span> : null}
                              </span>
                              <span className="ml-auto flex shrink-0 items-center gap-1 text-right text-sm font-semibold tabular-nums text-slate-700">
                                {lead.value > 0 ? `$${lead.value.toLocaleString("en-US", { maximumFractionDigits: 0 })}${unit}` : `${basis === "monthly" ? "MRR" : "Value"} not set`}
                                <ChevronRight size={15} className="text-slate-400" />
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="border-t border-slate-100 bg-slate-50/70 px-3 py-3 text-sm text-slate-500">No leads in this stage.</p>
                    )
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {basis === "monthly" ? <GoalProgressBar value={totalMrr} goal={goal} label="Lead MRR" /> : null}
      {open ? (
        <Link
          href={`/pipeline/${encodeURIComponent(pipelineKey)}`}
          className="mt-2 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
        >
          Detail
          <ChevronRight size={16} className="text-slate-400" />
        </Link>
      ) : null}
    </div>
  );
}
