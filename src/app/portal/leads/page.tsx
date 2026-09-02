import { listLeads } from "@/lib/crm/repository";
import { requireActiveBrandContext } from "@/lib/tenancy/current";
import { createLeadAction } from "./actions";

export default async function LeadsPage() {
  const { dataContext, canWrite } = await requireActiveBrandContext();
  const leads = await listLeads(dataContext);

  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-accent)]">CRM</p>
        <h1 className="mt-2 text-4xl font-semibold">Leads</h1>
        <p className="mt-2 text-slate-600">Brand-owned prospects with acquisition attribution.</p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-3">
          {leads.length ? (
            leads.map((lead) => {
              const firstTouch = lead.attributionTouches[0];
              return (
                <article key={lead.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-start gap-4">
                    <div className="min-w-52 flex-1">
                      <h2 className="text-lg font-semibold text-slate-900">{lead.name}</h2>
                      <p className="mt-1 text-sm text-slate-500">{lead.company ?? lead.email ?? "No company or email"}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                      {lead.status}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
                    <span>Source: {lead.source ?? firstTouch?.source ?? "Unknown"}</span>
                    <span>Campaign: {firstTouch?.campaign ?? "None"}</span>
                    {lead.estimatedValue ? (
                      <span>
                        Value: {lead.valueCurrency ?? "USD"} {Number(lead.estimatedValue).toLocaleString()}
                      </span>
                    ) : null}
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded-3xl border border-slate-200 bg-white px-6 py-12 text-center text-slate-500">
              No leads found for this brand.
            </div>
          )}
        </div>

        {canWrite ? (
          <form data-harness="create-lead-form" action={createLeadAction} className="h-fit space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-xl font-semibold">Add lead</h2>
            <p className="mt-1 text-sm text-slate-500">Attribution is optional and stays with this brand.</p>
          </div>
          <input name="name" required placeholder="Lead name" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
          <input name="company" placeholder="Company" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
          <input name="email" type="email" placeholder="Email" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
          <input name="phoneE164" placeholder="Phone" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
          <div className="grid grid-cols-2 gap-3">
            <input name="source" placeholder="Source" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
            <input name="sourceDetail" placeholder="Source detail" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
          </div>
          <textarea name="expectedServices" placeholder="Expected services" rows={2} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
          <div className="grid grid-cols-[1fr_90px] gap-3">
            <input name="estimatedValue" type="number" min="0" step="0.01" placeholder="Estimated value" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
            <input name="valueCurrency" maxLength={3} defaultValue="USD" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 uppercase" />
          </div>
          <details className="rounded-2xl border border-slate-200 p-4">
            <summary className="cursor-pointer text-sm font-semibold">Attribution details</summary>
            <div className="mt-4 space-y-3">
              <input name="utmSource" placeholder="UTM source" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
              <input name="utmMedium" placeholder="UTM medium" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
              <input name="utmCampaign" placeholder="UTM campaign" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
              <input name="landingPageUrl" type="url" placeholder="Landing page URL" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
              <input name="fbclid" placeholder="Meta fbclid" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
              <input name="gclid" placeholder="Google gclid" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
            </div>
          </details>
          <textarea name="notes" placeholder="Notes" rows={3} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
          <button type="submit" className="w-full cursor-pointer rounded-full bg-[var(--brand-light)] px-5 py-3 font-semibold text-white">
            Save lead
          </button>
          </form>
        ) : (
          <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            Your viewer access is read-only. Ask a brand administrator for member access to add leads.
          </aside>
        )}
      </div>
    </section>
  );
}
