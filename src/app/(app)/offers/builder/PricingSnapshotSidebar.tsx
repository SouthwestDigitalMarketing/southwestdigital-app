"use client";

import type { PackageId, ProposalPackageNames } from "./proposalPackageNames";

type PricingSnapshotItem = {
  id: PackageId;
  name: string;
  monthlyLabel: string;
  isRecommended?: boolean;
};

type OneTimeSnapshotCard = {
  amountLabel: string;
  detailRows?: string[];
};

export default function PricingSnapshotSidebar({
  items,
  cleanupCard,
  hideLabel,
  editablePackageNames,
  onPackageNameChange,
}: {
  items: PricingSnapshotItem[];
  cleanupCard?: OneTimeSnapshotCard;
  hideLabel?: boolean;
  editablePackageNames?: ProposalPackageNames;
  onPackageNameChange?: (id: PackageId, name: string) => void;
}) {
  const orderedItems = [...items].sort((a, b) => {
    const order: Record<string, number> = {
      maintain: 0,
      improve: 1,
      grow: 2,
    };

    return (order[a.id] ?? 99) - (order[b.id] ?? 99);
  });

  return (
    <aside className="w-full xl:sticky xl:top-8 xl:w-[280px] xl:self-start 2xl:w-[300px]">
      {hideLabel ? null : (<p className="px-1 text-base font-semibold text-slate-500">
        Pricing calculator
      </p>)}
      <div className={`proposal-builder-card overflow-hidden rounded-[1.25rem] border border-slate-300 shadow-[0_18px_40px_rgba(15,23,42,0.12)] ${hideLabel ? "" : "mt-3"}`}>
        {hideLabel ? (
          <div className="border-b border-slate-200 bg-white px-5 py-5">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Pricing</h2>
            {onPackageNameChange ? (
              <p className="mt-1 text-sm text-slate-500">Edit package names below.</p>
            ) : null}
          </div>
        ) : null}
        <div className="space-y-3 p-4">
          {cleanupCard ? (
            <div className="text-left">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">
                  One-Time
                </p>
                <p className="shrink-0 whitespace-nowrap text-xl font-semibold tabular-nums text-slate-900">
                  {cleanupCard.amountLabel}
                </p>
              </div>
              {cleanupCard.detailRows?.length ? (
                <div className="mt-3 space-y-1 text-base leading-6 text-slate-500">
                  {cleanupCard.detailRows.map((row) => <p key={row}>{row}</p>)}
                </div>
              ) : null}
            </div>
          ) : null}

          {orderedItems.map((item) => {
            const isGrow = item.id === "grow";
            const isImprove = item.id === "improve";
            const cardClassName = isGrow
              ? "border-slate-950 bg-slate-950"
              : isImprove
                ? "border-slate-200 bg-slate-100"
                : item.isRecommended
                  ? "border-brandnavy theme-white shadow-sm"
                  : "border-slate-200 theme-white";
            const titleClassName = isGrow ? "text-white" : "text-slate-900";
            const nameInputClassName = isGrow
              ? "border-white/30 bg-white/10 text-white hover:border-white/50 focus:border-white/70"
              : "border-slate-300 bg-white text-slate-900 hover:border-slate-400 focus:border-slate-500";

            return (
              <div
                key={item.id}
                className={`w-full rounded-[1.15rem] border px-4 py-2.5 text-left ${cardClassName}`}
              >
                <div className="flex items-center justify-between gap-3">
                  {onPackageNameChange ? (
                    <input
                      aria-label={`Name for the ${item.name} pricing package`}
                      maxLength={40}
                      value={editablePackageNames?.[item.id] ?? item.name}
                      onChange={(event) => onPackageNameChange(item.id, event.target.value)}
                      onBlur={(event) => {
                        if (!event.currentTarget.value.trim()) onPackageNameChange(item.id, item.name);
                      }}
                      title="Edit package name"
                      className={`ui-focus-ring min-w-0 flex-1 rounded-md border px-2 py-0.5 text-base font-semibold outline-none transition ${nameInputClassName}`}
                    />
                  ) : (
                    <p className={`min-w-0 break-words text-base font-semibold ${titleClassName}`}>{item.name}</p>
                  )}
                  <p className={`shrink-0 whitespace-nowrap text-base font-semibold ${titleClassName}`}>{item.monthlyLabel}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
