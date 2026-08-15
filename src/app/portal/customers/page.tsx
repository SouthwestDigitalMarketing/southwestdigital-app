import { listCustomerAccounts } from "@/lib/crm/repository";
import { requireActiveBrandContext } from "@/lib/tenancy/current";
import { createCustomerAccountAction } from "./actions";

type CustomerSearchParams = Promise<{ q?: string }>;

const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5";

export default async function CustomersPage({ searchParams }: { searchParams: CustomerSearchParams }) {
  const { dataContext, canWrite } = await requireActiveBrandContext();
  const query = (await searchParams).q;
  const customers = await listCustomerAccounts(dataContext, query);

  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-accent)]">CRM</p>
          <h1 className="mt-2 text-4xl font-semibold">Customers</h1>
          <p className="mt-2 text-slate-600">Businesses and customer accounts belonging to the active brand.</p>
        </div>
        <form className="flex gap-2">
          <input name="q" defaultValue={query} placeholder="Search customers" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm" />
          <button className="cursor-pointer rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">Search</button>
        </form>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          {customers.length ? (
            <ul className="divide-y divide-slate-100">
              {customers.map((customer) => {
                const primaryContact = customer.contacts[0]?.contact;
                return (
                  <li key={customer.id} className="grid gap-3 px-6 py-5 sm:grid-cols-[minmax(200px,1fr)_minmax(180px,1fr)_auto] sm:items-center">
                    <div>
                      <p className="font-semibold text-slate-900">{customer.name}</p>
                      <p className="mt-1 text-sm text-slate-500">{customer.legalName ?? customer.code ?? "No account code"}</p>
                    </div>
                    <div className="text-sm text-slate-600">
                      <p>{customer.communicationEmail ?? primaryContact?.email ?? "No communication email"}</p>
                      <p>{customer.primaryPhone ?? primaryContact?.phoneNumber ?? "No phone"}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{customer.status.toLowerCase()}</span>
                  </li>
                );
              })}
            </ul>
          ) : <p className="px-6 py-12 text-center text-slate-500">No customers found for this brand.</p>}
        </div>

        {canWrite ? (
          <form data-harness="create-customer-form" action={createCustomerAccountAction} className="h-fit space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div><h2 className="text-xl font-semibold">Add customer</h2><p className="mt-1 text-sm text-slate-500">Saved to the active brand.</p></div>
          <input name="name" required placeholder="Customer or business name" className={inputClass} />
          <div className="grid grid-cols-2 gap-3"><input name="code" placeholder="Account code" className={inputClass} /><select name="status" defaultValue="ACTIVE" className={inputClass}><option value="PROSPECT">Prospect</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="ARCHIVED">Archived</option></select></div>
          <input name="legalName" placeholder="Legal name" className={inputClass} />
          <input name="entityType" placeholder="Entity type" className={inputClass} />
          <input name="websiteUrl" type="url" placeholder="https://example.com" className={inputClass} />
          <input name="communicationEmail" type="email" placeholder="Communication email" className={inputClass} />
          <div className="grid grid-cols-2 gap-3"><input name="primaryPhone" placeholder="Phone" className={inputClass} /><input name="principalAddressCountryCode" maxLength={2} placeholder="Country (US/AU)" className={inputClass} /></div>
          <input name="principalAddressLine1" placeholder="Address line 1" className={inputClass} />
          <input name="principalAddressLine2" placeholder="Address line 2" className={inputClass} />
          <div className="grid grid-cols-2 gap-3"><input name="principalAddressCity" placeholder="City" className={inputClass} /><input name="principalAddressRegion" placeholder="State / region" className={inputClass} /></div>
          <input name="principalAddressPostalCode" placeholder="Postal code" className={inputClass} />
          <input name="noticesEmail" type="email" placeholder="Legal notices email" className={inputClass} />
          <input name="invoicingEmail" type="email" placeholder="Invoicing email" className={inputClass} />
          <button type="submit" className="w-full cursor-pointer rounded-full bg-[var(--brand-primary)] px-5 py-3 font-semibold text-white">Save customer</button>
          </form>
        ) : (
          <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            Your viewer access is read-only. Ask a brand administrator for member access to add customers.
          </aside>
        )}
      </div>
    </section>
  );
}
