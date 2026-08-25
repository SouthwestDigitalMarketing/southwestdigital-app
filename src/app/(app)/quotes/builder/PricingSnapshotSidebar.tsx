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
      <div className="overflow-hidden rounded-[1.25rem] border border-slate-300 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
        <div className="bg-[linear-gradient(180deg,rgba(2,6,23,1)_0%,rgba(3,7,18,1)_100%)] px-5 py-4 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
            Step 4
          </p>
          <p className="mt-2 text-lg font-semibold tracking-tight">Pricing calculator</p>
        </div>

        <div className="space-y-3 p-4">
          {cleanupCard ? (
            <div className="rounded-[1.15rem] border border-slate-200 bg-white px-4 py-3 text-left shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-900">Historical cleanup</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    One-Time
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {cleanupCard.amountLabel}
                  </p>
                </div>
              </div>
              <div className="mt-2 space-y-1 text-xs text-slate-500">
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
                  ? "border-brandnavy bg-white shadow-sm"
                  : "border-slate-200 bg-white";
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
