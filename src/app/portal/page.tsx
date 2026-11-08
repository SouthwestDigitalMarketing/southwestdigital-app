import { requireActiveBrandContext } from "@/lib/tenancy/current";

export default async function PortalPage() {
  const { activeBrand } = await requireActiveBrandContext();

  return (
    <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-12">
      <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--theme-accent)]">
          Platform foundation
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Welcome to {activeBrand.name}</h1>
        <p className="mt-4 max-w-2xl leading-6 text-slate-600 sm:leading-7">
          Customers, contacts, and leads are isolated to this active brand. Additional application modules
          will appear here as they are migrated.
        </p>
      </div>
    </section>
  );
}
