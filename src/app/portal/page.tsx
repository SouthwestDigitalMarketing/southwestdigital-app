import { requireActiveBrandContext } from "@/lib/tenancy/current";

export default async function PortalPage() {
  const { activeBrand } = await requireActiveBrandContext();

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <div className="rounded-3xl border border-black/10 bg-white p-10 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand-accent)]">
          Platform foundation
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Welcome to {activeBrand.name}</h1>
        <p className="mt-4 max-w-2xl leading-7 text-slate-600">
          Contacts and leads are now isolated to this active brand. Additional application modules
          will appear here as they are migrated.
        </p>
      </div>
    </section>
  );
}

