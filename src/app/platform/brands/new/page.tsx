import Link from "next/link";
import { createBrandOnboardingAction } from "@/app/platform/actions";

const inputClass = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5";

export default function NewBrandPage() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/platform/brands" className="text-sm font-semibold text-slate-600">← All brands</Link>
      <div className="mt-5">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">Onboarding</p>
        <h1 className="mt-2 text-4xl font-semibold">Create a brand</h1>
        <p className="mt-2 text-slate-600">
          This creates a draft tenant, a pending app hostname, its theme, and its first brand owner together.
        </p>
      </div>

      <form action={createBrandOnboardingAction} className="mt-8 space-y-8">
        <fieldset className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
          <legend className="px-2 text-lg font-semibold">Brand identity</legend>
          <label className="text-sm font-semibold text-slate-700">
            Display name
            <input name="name" required placeholder="Melbourne CFO" className={inputClass} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Internal slug
            <input name="slug" required placeholder="melbourne-cfo" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" className={inputClass} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Legal name (optional)
            <input name="legalName" className={inputClass} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            App hostname
            <input name="appHostname" required placeholder="app.melbournecfo.com.au" className={inputClass} />
          </label>
        </fieldset>

        <fieldset className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
          <legend className="px-2 text-lg font-semibold">First brand owner</legend>
          <label className="text-sm font-semibold text-slate-700">
            Name (optional)
            <input name="ownerName" placeholder="Dagny" className={inputClass} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Email
            <input name="ownerEmail" type="email" required className={inputClass} />
          </label>
        </fieldset>

        <fieldset className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
          <legend className="px-2 text-lg font-semibold">Portal theme</legend>
          <label className="text-sm font-semibold text-slate-700 md:col-span-2">
            Logo URL (optional)
            <input name="logoUrl" type="url" className={inputClass} />
          </label>
          <label className="text-sm font-semibold text-slate-700 md:col-span-2">
            Support email (optional)
            <input name="supportEmail" type="email" className={inputClass} />
          </label>
          {[
            ["lightColor", "Light", "#17324d"],
            ["accentColor", "Accent", "#d79b3b"],
            ["backgroundColor", "Background", "#f7f8fa"],
            ["foregroundColor", "Foreground", "#17202a"],
          ].map(([name, label, value]) => (
            <label key={name} className="text-sm font-semibold text-slate-700">
              {label} color
              <div className="mt-1 flex gap-2">
                <input name={name} type="color" defaultValue={value} className="h-11 w-14 rounded-lg border border-slate-300 bg-white p-1" />
                <input aria-label={`${label} color value`} value={value} readOnly className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-slate-500" />
              </div>
            </label>
          ))}
        </fieldset>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          The hostname begins in <strong>pending</strong> status. It cannot brand a login or receive traffic until DNS ownership and deployment routing are verified.
        </div>
        <button type="submit" className="cursor-pointer rounded-full bg-slate-950 px-6 py-3 font-semibold text-white">
          Create draft brand
        </button>
      </form>
    </section>
  );
}
