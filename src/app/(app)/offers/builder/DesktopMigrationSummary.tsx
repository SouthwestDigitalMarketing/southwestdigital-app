export interface DesktopMigrationSummaryData {
  choice: string;
  lines: Array<{ label: string; amount: number }>;
  total: number;
}

function isPresentableLine(line: unknown): line is { label: string; amount: number } {
  if (!line || typeof line !== "object") return false;
  const candidate = line as Record<string, unknown>;
  return (
    typeof candidate.label === "string" &&
    typeof candidate.amount === "number" &&
    Number.isFinite(candidate.amount) &&
    candidate.amount >= 0
  );
}

function formatMoney(value: number): string {
  return `$${value.toLocaleString("en-US")}`;
}

/**
 * Client-facing sized-migration block. Fed from the whitelisted public
 * payload on the public page and from the live price in the staff
 * preview. Null or an empty line list renders nothing, so legacy
 * proposals read exactly as before.
 */
export default function DesktopMigrationSummary({
  migration,
}: {
  migration: DesktopMigrationSummaryData | null | undefined;
}) {
  const lines = Array.isArray(migration?.lines) ? migration.lines.filter(isPresentableLine) : [];
  if (!migration || typeof migration.choice !== "string" || lines.length === 0) return null;
  return (
    <section
      aria-label="QuickBooks Desktop to Online migration"
      className="my-6 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 sm:p-6"
    >
      <h2 className="text-lg font-bold">QuickBooks Desktop to Online Migration — {migration.choice}</h2>
      <ul className="mt-3 space-y-1.5 text-sm">
        {lines.map((line, index) => (
          <li key={index} className="flex justify-between gap-3">
            <span className="text-slate-600">{line.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">
              {line.amount === 0 ? "Included" : formatMoney(line.amount)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 flex justify-between gap-3 border-t border-slate-200 pt-3 text-sm font-bold">
        <span>Migration total (due today)</span>
        <span className="tabular-nums">{formatMoney(migration.total)}</span>
      </p>
      <p className="mt-2 text-sm text-slate-600">
        Included: balance check — trial balance tie-out to your Desktop file.
      </p>
    </section>
  );
}
