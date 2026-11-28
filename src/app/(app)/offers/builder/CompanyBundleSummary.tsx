import type { BundlePricing, PublicCompanyBundle } from "@/lib/quotes/companyBundle";

export type CompanyBundleSummaryProps =
  | { priced: BundlePricing; caption?: string; migrationSized?: boolean }
  | { publicBundle: PublicCompanyBundle; caption?: string; migrationSized?: boolean };

type SummaryRow = {
  name: string;
  ownQboFile: boolean;
  monthly: number;
  setupOneTime: number;
  discountNote: string | null;
  migrationNote: string | null;
};

function fmt(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function summarize(priced: BundlePricing, migrationSized: boolean): {
  rows: SummaryRow[];
  locationsCount: number;
  locationsMonthly: number;
  bundleMonthly: number;
} {
  return {
    rows: priced.perCompany.map((entry) => ({
      name: entry.company.name,
      ownQboFile: entry.company.ownQboFile,
      monthly: entry.discountedMonthly,
      setupOneTime: entry.setupOneTime,
      discountNote:
        !entry.isMain && entry.company.ownQboFile && entry.discountPct > 0
          ? `${entry.discountPct}% bundle discount`
          : null,
      migrationNote:
        entry.company.fileStatus === "desktop_to_online"
          ? migrationNoteText(migrationSized)
          : null,
    })),
    locationsCount: priced.perCompany[0]?.company.locationsCount ?? 0,
    locationsMonthly: priced.locationsMonthly,
    bundleMonthly: priced.bundleMonthly,
  };
}

/**
 * Spec 05: once a sized migration is chosen the per-file $0 marker reads
 * as included; legacy (no choice) keeps "priced separately".
 */
function migrationNoteText(migrationSized: boolean): string {
  return migrationSized
    ? "Desktop → Online migration (included in Desktop → Online migration)"
    : "Desktop → Online migration (priced separately)";
}

function summarizePublic(bundle: PublicCompanyBundle, migrationSized: boolean): {
  rows: SummaryRow[];
  locationsCount: number;
  locationsMonthly: number;
  bundleMonthly: number;
} {
  return {
    rows: bundle.companies.map((company, index) => ({
      name: company.name,
      ownQboFile: company.ownQboFile,
      monthly: company.monthly,
      setupOneTime: company.setupOneTime,
      // The public payload carries no pricing options, so the exact discount
      // percent is unknown here; staff preview shows the percent from options.
      discountNote: index > 0 && company.ownQboFile ? "bundle discount applied" : null,
      migrationNote: company.migrationFlagged ? migrationNoteText(migrationSized) : null,
    })),
    locationsCount: bundle.locationsCount,
    locationsMonthly: bundle.locationsMonthly,
    bundleMonthly: bundle.bundleMonthly,
  };
}

/**
 * "Companies in this proposal" block, shown only when the payload has a
 * bundle. Staff preview builds it from the full assessment via
 * priceCompanyBundle; the public page renders the whitelisted
 * `companyBundle` field (PublicCompanyBundle) that P3 adds to
 * toPublicBookkeepingProposal output.
 */
export default function CompanyBundleSummary(props: CompanyBundleSummaryProps) {
  const caption = "caption" in props ? props.caption : undefined;
  const migrationSized = "migrationSized" in props && props.migrationSized === true;
  const summary =
    "priced" in props ? summarize(props.priced, migrationSized) : summarizePublic(props.publicBundle, migrationSized);
  const setupRows = summary.rows.filter((row) => row.setupOneTime > 0);
  return (
    <section className="my-6 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 sm:p-6" aria-label="Companies in this proposal">
      <h2 className="text-lg font-bold">Companies in this proposal</h2>
      {caption ? <p className="mt-1 text-sm text-slate-600">{caption}</p> : null}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Monthly bookkeeping per company</caption>
          <thead className="border-b border-slate-200 text-slate-600">
            <tr><th scope="col" className="py-2 pr-3">Company</th><th scope="col" className="py-2 pr-3">Own QuickBooks file</th><th scope="col" className="py-2 text-right">Monthly</th></tr>
          </thead>
          <tbody>
            {summary.rows.map((row, index) => (
              <tr key={index} className="border-b border-slate-100">
                <td className="py-2 pr-3">{row.name}</td>
                <td className="py-2 pr-3">{row.ownQboFile ? "Yes" : "No"}</td>
                <td className="py-2 text-right tabular-nums">
                  {fmt(row.monthly)}
                  <span className="text-slate-500">/mo</span>
                  {row.discountNote ? <span className="block text-xs font-semibold text-emerald-700">{row.discountNote}</span> : null}
                  {row.migrationNote ? <span className="block text-xs font-medium text-slate-500">{row.migrationNote}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="font-bold"><th scope="row" colSpan={2} className="py-2 pr-3">Bundle monthly total</th><td className="py-2 text-right tabular-nums">{fmt(summary.bundleMonthly)}<span className="text-slate-500">/mo</span></td></tr></tfoot>
        </table>
      </div>
      {summary.locationsCount > 0 || summary.locationsMonthly > 0 ? (
        <p className="mt-3 text-sm text-slate-600">
          {summary.locationsCount} {summary.locationsCount === 1 ? "location" : "locations"} — location reporting: {fmt(summary.locationsMonthly)}/mo
        </p>
      ) : null}
      {setupRows.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          {setupRows.map((row, index) => (
            <li key={index}>{row.name} — new QuickBooks file setup: {fmt(row.setupOneTime)} one-time</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
