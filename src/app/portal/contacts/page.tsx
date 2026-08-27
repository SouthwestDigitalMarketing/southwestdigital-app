import { listContacts } from "@/lib/crm/repository";
import { requireActiveBrandContext } from "@/lib/tenancy/current";
import { createContactAction } from "./actions";

type ContactSearchParams = Promise<{ q?: string }>;

export default async function ContactsPage({ searchParams }: { searchParams: ContactSearchParams }) {
  const { dataContext, canWrite } = await requireActiveBrandContext();
  const query = (await searchParams).q;
  const contacts = await listContacts(dataContext, query);

  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-accent)]">CRM</p>
          <h1 className="mt-2 text-4xl font-semibold">Contacts</h1>
          <p className="mt-2 text-slate-600">People associated with the active brand only.</p>
        </div>
        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={query}
            placeholder="Search contacts"
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm"
          />
          <button className="cursor-pointer rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">
            Search
          </button>
        </form>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          {contacts.length ? (
            <ul className="divide-y divide-slate-100">
              {contacts.map((contact) => (
                <li key={contact.id} className="flex flex-wrap items-center gap-4 px-6 py-5">
                  <div className="min-w-52 flex-1">
                    <p className="font-semibold text-slate-900">{contact.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{contact.roleTitle ?? "No role recorded"}</p>
                  </div>
                  <div className="text-sm text-slate-600">
                    <p>{contact.email ?? "No email"}</p>
                    <p>{contact.phoneNumber ?? contact.phoneE164 ?? "No phone"}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {contact.isActive ? "active" : "archived"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-6 py-12 text-center text-slate-500">No contacts found for this brand.</p>
          )}
        </div>

        {canWrite ? (
          <form data-harness="create-contact-form" action={createContactAction} className="h-fit space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-xl font-semibold">Add contact</h2>
            <p className="mt-1 text-sm text-slate-500">Saved to the active brand.</p>
          </div>
          <input name="displayName" required placeholder="Display name" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
          <div className="grid grid-cols-2 gap-3">
            <input name="firstName" placeholder="First name" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
            <input name="lastName" placeholder="Last name" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
          </div>
          <input name="email" type="email" placeholder="Email" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
          <input name="phoneNumber" placeholder="Phone" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
          <input name="roleTitle" placeholder="Role or title" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
          <label className="block text-sm font-semibold text-slate-700">
            Marketing consent
            <select name="marketingConsent" defaultValue="UNKNOWN" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal">
              <option value="UNKNOWN">Unknown</option>
              <option value="GRANTED">Granted</option>
              <option value="DENIED">Denied</option>
            </select>
          </label>
          <button type="submit" className="w-full cursor-pointer rounded-full bg-[var(--brand-primary)] px-5 py-3 font-semibold text-white">
            Save contact
          </button>
          </form>
        ) : (
          <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            Your viewer access is read-only. Ask a brand administrator for member access to add contacts.
          </aside>
        )}
      </div>
    </section>
  );
}
