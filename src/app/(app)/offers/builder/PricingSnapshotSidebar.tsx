"use client";

type PricingSnapshotItem = {
  id: string;
  name: string;
  monthlyLabel: string;
  isRecommended?: boolean;
};

type CleanupSnapshotCard = {
  amountLabel: string;
  baseRow?: string;
  addOnsRow?: string;
};

export default function PricingSnapshotSidebar({
  items,
  cleanupCard,
}: {
  items: PricingSnapshotItem[];
  cleanupCard?: CleanupSnapshotCard;
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
    <aside className="xl:sticky xl:top-8 xl:self-start">
      <p className="px-1 text-sm font-semibold text-slate-500">
        Pricing calculator
      </p>
      <div className="proposal-builder-card mt-3 overflow-hidden rounded-[1.25rem] border border-slate-300 shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
        <div className="space-y-3 p-4">
          {cleanupCard ? (
            <div className="text-left">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold tracking-tight text-slate-900">Historical cleanup</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-medium uppercase tracking-[0.12em] text-slate-500">
                    One-Time
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                    {cleanupCard.amountLabel}
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-base leading-6 text-slate-500">
                {cleanupCard.baseRow ? <p>{cleanupCard.baseRow}</p> : null}
                {cleanupCard.addOnsRow ? <p>{cleanupCard.addOnsRow}</p> : null}
              </div>
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

            return (
              <div
                key={item.id}
                className={`w-full rounded-[1.15rem] border px-4 py-2.5 text-left ${cardClassName}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className={`text-base font-semibold ${titleClassName}`}>{item.name}</p>
                  <p className={`text-base font-semibold ${titleClassName}`}>{item.monthlyLabel}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
