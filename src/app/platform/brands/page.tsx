import Link from "next/link";
import { listBrandsForAdministration } from "@/lib/platform/repository";

function statusClasses(status: string) {
  if (status === "ACTIVE") return "bg-emerald-100 text-emerald-800";
  if (status === "DRAFT") return "bg-amber-100 text-amber-800";
  return "bg-slate-200 text-slate-700";
}

export default async function PlatformBrandsPage() {
  const brands = await listBrandsForAdministration();

  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">Tenancy</p>
          <h1 className="mt-2 text-4xl font-semibold">Brands</h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            Each row is one independent brand with its own domains, theme, users, CRM data, and integrations.
          </p>
        </div>
        <Link href="/platform/brands/new" className="rounded-full bg-slate-950 px-5 py-3 font-semibold text-white">
          Onboard a brand
        </Link>
      </div>

      <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {brands.length ? (
          <ul className="divide-y divide-slate-100">
            {brands.map((brand) => (
              <li key={brand.id}>
                <Link href={`/platform/brands/${brand.id}`} className="grid gap-4 px-6 py-5 hover:bg-slate-50 md:grid-cols-[minmax(220px,1fr)_minmax(240px,1fr)_auto] md:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="font-semibold text-slate-950">{brand.name}</p>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses(brand.status)}`}>
                        {brand.status.toLowerCase()}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{brand.slug}</p>
                  </div>
                  <div className="text-sm text-slate-600">
                    {brand.domains.length ? brand.domains.map((domain) => (
                      <p key={`${domain.purpose}-${domain.hostname}`}>
                        {domain.hostname} · {domain.status.toLowerCase()}
                      </p>
                    )) : <p>No primary domain</p>}
                  </div>
                  <div className="flex gap-4 text-sm text-slate-600">
                    <span>{brand._count.memberships} users</span>
                    <span>{brand._count.contacts} contacts</span>
                    <span>{brand._count.leads} leads</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-6 py-16 text-center">
            <p className="text-lg font-semibold">No brands yet</p>
            <p className="mt-2 text-slate-500">Create the first brand to begin platform setup.</p>
          </div>
        )}
      </div>
    </section>
  );
}
