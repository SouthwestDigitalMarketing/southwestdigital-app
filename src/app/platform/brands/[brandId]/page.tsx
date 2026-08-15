import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addPendingBrandDomainAction,
  inviteBrandMemberAction,
  updateBrandThemeAction,
} from "@/app/platform/actions";
import { getBrandForAdministration } from "@/lib/platform/repository";

const inputClass = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5";

export default async function BrandAdministrationPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const brand = await getBrandForAdministration(brandId);
  if (!brand) notFound();

  const verifiedAppDomain = brand.domains.some((domain) => domain.purpose === "APP" && domain.status === "VERIFIED");
  const brandOwner = brand.memberships.some((membership) => membership.role === "OWNER" && membership.status !== "SUSPENDED");
  const theme = brand.theme ?? {
    logoUrl: null,
    supportEmail: null,
    primaryColor: "#17324d",
    accentColor: "#d79b3b",
    backgroundColor: "#f7f8fa",
    foregroundColor: "#17202a",
  };

  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <Link href="/platform/brands" className="text-sm font-semibold text-slate-600">← All brands</Link>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">{brand.status.toLowerCase()}</p>
          <h1 className="mt-2 text-4xl font-semibold">{brand.name}</h1>
          <p className="mt-2 text-slate-500">{brand.slug} · created {brand.createdAt.toLocaleDateString()}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm shadow-sm">
          <p className="font-semibold text-slate-900">Activation gates</p>
          <p className={verifiedAppDomain ? "text-emerald-700" : "text-amber-700"}>{verifiedAppDomain ? "✓" : "○"} Verified app domain</p>
          <p className={brandOwner ? "text-emerald-700" : "text-amber-700"}>{brandOwner ? "✓" : "○"} Brand owner assigned</p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Domains</h2>
          <p className="mt-1 text-sm text-slate-500">Only verified app domains are trusted as branded entry points.</p>
          <ul className="mt-5 divide-y divide-slate-100">
            {brand.domains.map((domain) => (
              <li key={domain.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <div className="min-w-64 flex-1">
                  <p className="font-semibold text-slate-900">{domain.hostname}</p>
                  <p className="text-slate-500">{domain.purpose.toLowerCase()}{domain.isPrimary ? " · primary" : ""}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">{domain.status.toLowerCase()}</span>
              </li>
            ))}
          </ul>
          <form action={addPendingBrandDomainAction} className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-[1fr_130px_auto] sm:items-end">
            <input type="hidden" name="brandId" value={brand.id} />
            <label className="text-sm font-semibold text-slate-700">Hostname<input name="hostname" required placeholder="app.example.com" className={inputClass} /></label>
            <label className="text-sm font-semibold text-slate-700">Purpose<select name="purpose" className={inputClass}><option value="APP">App</option><option value="WEBSITE">Website</option></select></label>
            <button type="submit" className="cursor-pointer rounded-full bg-slate-950 px-5 py-2.5 font-semibold text-white">Add pending</button>
          </form>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Brand access</h2>
          <p className="mt-1 text-sm text-slate-500">One global login can have memberships in multiple brands.</p>
          <ul className="mt-5 divide-y divide-slate-100">
            {brand.memberships.map((membership) => (
              <li key={membership.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <div className="min-w-52 flex-1">
                  <p className="font-semibold text-slate-900">{membership.user.name ?? membership.user.email}</p>
                  <p className="text-slate-500">{membership.user.email}</p>
                </div>
                <span>{membership.role.toLowerCase()}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{membership.status.toLowerCase()}</span>
              </li>
            ))}
          </ul>
          <form action={inviteBrandMemberAction} className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2">
            <input type="hidden" name="brandId" value={brand.id} />
            <label className="text-sm font-semibold text-slate-700">Name<input name="name" className={inputClass} /></label>
            <label className="text-sm font-semibold text-slate-700">Email<input name="email" type="email" required className={inputClass} /></label>
            <label className="text-sm font-semibold text-slate-700">Brand role<select name="role" defaultValue="MEMBER" className={inputClass}><option value="VIEWER">Viewer</option><option value="MEMBER">Member</option><option value="ADMIN">Admin</option><option value="OWNER">Owner</option></select></label>
            <button type="submit" className="mt-auto cursor-pointer rounded-full bg-slate-950 px-5 py-2.5 font-semibold text-white">Invite or update</button>
          </form>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
            <form action={updateBrandThemeAction} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="brandId" value={brand.id} />
              <div className="sm:col-span-2"><h2 className="text-xl font-semibold">Portal theme</h2><p className="mt-1 text-sm text-slate-500">Used on the branded login and inside the selected brand portal.</p></div>
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Logo URL<input name="logoUrl" type="url" defaultValue={theme.logoUrl ?? ""} className={inputClass} /></label>
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Support email<input name="supportEmail" type="email" defaultValue={theme.supportEmail ?? ""} className={inputClass} /></label>
              {[
                ["primaryColor", "Primary", theme.primaryColor],
                ["accentColor", "Accent", theme.accentColor],
                ["backgroundColor", "Background", theme.backgroundColor],
                ["foregroundColor", "Foreground", theme.foregroundColor],
              ].map(([name, label, value]) => (
                <label key={name} className="text-sm font-semibold text-slate-700">{label} color<input name={name} type="color" defaultValue={value} className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white p-1" /></label>
              ))}
              <button type="submit" className="cursor-pointer rounded-full bg-slate-950 px-5 py-2.5 font-semibold text-white sm:col-span-2">Save theme</button>
            </form>
            <div style={{ backgroundColor: theme.backgroundColor, color: theme.foregroundColor }} className="overflow-hidden rounded-3xl border border-slate-200 shadow-sm">
              <div style={{ backgroundColor: theme.primaryColor }} className="h-3" />
              <div className="p-7">
                <p style={{ color: theme.accentColor }} className="text-xs font-semibold uppercase tracking-[0.2em]">Portal preview</p>
                <h3 className="mt-4 text-2xl font-semibold">{brand.name}</h3>
                <p className="mt-2 text-sm opacity-70">Sign in to continue to your client portal.</p>
                <div style={{ backgroundColor: theme.primaryColor }} className="mt-6 rounded-full px-5 py-3 text-center font-semibold text-white">Continue with Google</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
