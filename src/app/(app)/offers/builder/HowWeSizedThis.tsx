import {
  ESTIMATE_NOTICE_TEXT,
  volumeClauseText,
  type PublicAccountInventory,
} from "@/lib/quotes/accountInventory";

/** Shared by the draft preview and the snapshot-only public proposal. */
export default function HowWeSizedThis({
  inventory,
  brandName,
}: {
  inventory?: PublicAccountInventory | null;
  brandName: string;
}) {
  if (!inventory?.accounts.length) return null;
  return (
    <section className="my-6 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 sm:p-6" aria-label="How we sized this">
      <h2 className="text-lg font-bold">How we sized this</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Open accounts and monthly transaction counts</caption>
          <thead className="border-b border-slate-200 text-slate-600">
            <tr><th scope="col" className="py-2 pr-3">Kind</th><th scope="col" className="py-2 pr-3">Account</th><th scope="col" className="py-2 pr-3 text-right">Monthly transactions</th><th scope="col" className="py-2">Basis</th></tr>
          </thead>
          <tbody>
            {inventory.accounts.map((account, index) => (
              <tr key={index} className="border-b border-slate-100">
                <td className="py-2 pr-3">{account.kindLabel}</td>
                <td className="py-2 pr-3">{account.label}{account.last4 ? ` ••${account.last4}` : ""}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{account.monthlyTransactions.toLocaleString("en-US")}</td>
                <td className="py-2">{account.basis === "measured" ? "Measured" : "Estimated"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="font-bold"><th scope="row" colSpan={2} className="py-2 pr-3">Total per month</th><td className="py-2 pr-3 text-right tabular-nums">{inventory.monthlyTotal.toLocaleString("en-US")}</td><td /></tr></tfoot>
        </table>
      </div>
      {inventory.hasEstimated ? <p className="mt-3 text-sm text-amber-800">{ESTIMATE_NOTICE_TEXT}</p> : null}
      <h3 className="mt-5 text-sm font-bold">Proposal terms</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{volumeClauseText({ monthlyTotal: inventory.monthlyTotal, basis: inventory.basis, brandName })}</p>
    </section>
  );
}
