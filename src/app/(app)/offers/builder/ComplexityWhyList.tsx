import type { ComplexityPublicWhy } from "@/lib/quotes/complexityDrivers";

function isPresentable(line: unknown): line is ComplexityPublicWhy {
  if (!line || typeof line !== "object") return false;
  const candidate = line as Record<string, unknown>;
  if (typeof candidate.label !== "string" || typeof candidate.why !== "string") return false;
  return (
    candidate.monthly === null ||
    (typeof candidate.monthly === "number" && Number.isFinite(candidate.monthly) && candidate.monthly >= 0)
  );
}

function formatMonthly(monthly: number): string {
  return `$${monthly.toLocaleString("en-US")}/mo`;
}

/**
 * Client-facing "Why this price" list. Staff preview feeds it from
 * `priceComplexityDrivers` via `toPublicComplexityWhy`; the public page
 * feeds it the whitelisted top-level `complexityWhy` field. Null, undefined
 * or an empty list renders nothing, so legacy proposals read exactly as
 * before.
 */
export default function ComplexityWhyList({
  lines,
  tierName,
}: {
  lines: ComplexityPublicWhy[] | null | undefined;
  tierName?: string;
}) {
  const presentable = Array.isArray(lines) ? lines.filter(isPresentable) : [];
  if (presentable.length === 0) return null;
  return (
    <section
      aria-label="Why this price"
      className="my-6 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 sm:p-6"
    >
      <h2 className="text-lg font-bold">
        Why this price{tierName ? ` — ${tierName}` : ""}
      </h2>
      <ul className="mt-3 space-y-3">
        {presentable.map((line) => (
          <li key={line.id} className="text-sm">
            <p className="font-semibold">
              {line.label} ·{" "}
              {line.monthly === null ? <span className="font-normal text-slate-600">included</span> : formatMonthly(line.monthly)}
            </p>
            <p className="mt-0.5 text-slate-600">{line.why}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
