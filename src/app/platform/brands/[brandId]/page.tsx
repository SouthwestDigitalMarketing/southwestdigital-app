import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addPendingBrandDomainAction,
  beginBrandOffboardingAction,
  cancelBrandOffboardingAction,
  inviteBrandMemberAction,
  requestBrandDataExportAction,
  saveBrandIntegrationAction,
  scheduleBrandOffboardingAction,
  updateBrandThemeAction,
} from "@/app/platform/actions";
import { getBrandForAdministration } from "@/lib/platform/repository";

const inputClass = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5";
const integrationProviders = [
  ["GA4", "Google Analytics 4"],
  ["GTM", "Google Tag Manager"],
  ["META_ADS", "Meta Ads / Pixel"],
  ["GOOGLE_ADS", "Google Ads"],
  ["GOOGLE_SEARCH_CONSOLE", "Google Search Console"],
] as const;

function formatBytes(byteSize: bigint | null): string {
  if (byteSize === null) return "Size pending";
  const megabytes = Number(byteSize) / 1024 / 1024;
  return `${megabytes.toFixed(megabytes >= 10 ? 0 : 1)} MB`;
}

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
  const liveOffboardingPlan = brand.offboardingPlans.find((plan) => plan.status === "PLANNED" || plan.status === "IN_PROGRESS");
  const canBeginOffboarding = Boolean(
    liveOffboardingPlan?.status === "PLANNED" && liveOffboardingPlan.accessEndsAt <= new Date(),
  );
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
          <form data-harness="domain-form" action={addPendingBrandDomainAction} className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-[1fr_130px_auto] sm:items-end">
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

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
          <div>
            <h2 className="text-xl font-semibold">Analytics and advertising assets</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Public asset identifiers and ownership are recorded here. Credentials and API tokens are never entered in this form.
            </p>
          </div>

          {brand.integrations.length ? (
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
              <ul className="divide-y divide-slate-100">
                {brand.integrations.map((integration) => (
                  <li key={integration.id} className="grid gap-3 bg-white px-5 py-4 text-sm md:grid-cols-[minmax(200px,1fr)_minmax(190px,1fr)_minmax(180px,1fr)_auto] md:items-center">
                    <div>
                      <p className="font-semibold text-slate-950">{integration.displayName ?? integration.key}</p>
                      <p className="text-slate-500">{integration.provider.replaceAll("_", " ").toLowerCase()}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700">{integration.publicIdentifier ?? "No public identifier"}</p>
                      <p className="text-slate-500">Property {integration.externalPropertyId ?? "not recorded"}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700">{integration.assetOwner.replaceAll("_", " ").toLowerCase()} owned</p>
                      <p className="text-slate-500">Account {integration.externalAccountId ?? "not recorded"}</p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-center font-semibold text-amber-800">
                      {integration.status.toLowerCase()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-5 rounded-2xl bg-slate-50 px-5 py-6 text-sm text-slate-500">No analytics or advertising assets recorded.</p>
          )}

          <form
            action={saveBrandIntegrationAction}
            data-harness="integration-form"
            className="mt-6 grid gap-4 border-t border-slate-100 pt-6 md:grid-cols-2 xl:grid-cols-4"
          >
            <input type="hidden" name="brandId" value={brand.id} />
            <label className="text-sm font-semibold text-slate-700">
              Internal key
              <input name="key" required placeholder="website-ga4" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" className={inputClass} />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Provider
              <select name="provider" className={inputClass}>
                {integrationProviders.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Asset owner
              <select name="assetOwner" defaultValue="BRAND" className={inputClass}>
                <option value="BRAND">Brand / client</option>
                <option value="SOUTHWEST_DIGITAL">Southwest Digital</option>
                <option value="THIRD_PARTY">Third party</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Display name
              <input name="displayName" placeholder="Website GA4" className={inputClass} />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Public identifier
              <input name="publicIdentifier" placeholder="G-…, GTM-…, or Pixel ID" className={inputClass} />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              External account ID
              <input name="externalAccountId" className={inputClass} />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              External property ID
              <input name="externalPropertyId" className={inputClass} />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Ownership/access note
              <input name="notes" placeholder="Client owns; Southwest has delegated access" className={inputClass} />
            </label>
            <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 md:col-span-2 xl:col-span-3">
              Saving places the integration in <strong>pending</strong> status. A later provider-specific verification step is required before it becomes active.
            </div>
            <button type="submit" className="cursor-pointer rounded-full bg-slate-950 px-5 py-3 font-semibold text-white">
              Save asset record
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
          <div className="grid gap-8 xl:grid-cols-2">
            <div>
              <h2 className="text-xl font-semibold">Portable data exports</h2>
              <p className="mt-1 text-sm text-slate-500">
                Large exports run as background jobs and will be written to private object storage with a checksum and expiring download window.
              </p>

              {brand.dataExports.length ? (
                <ul className="mt-5 divide-y divide-slate-100 rounded-2xl border border-slate-200">
                  {brand.dataExports.map((dataExport) => (
                    <li key={dataExport.id} className="px-5 py-4 text-sm">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="font-semibold text-slate-950">{dataExport.format.replaceAll("_", " ").toLowerCase()}</p>
                        <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">{dataExport.status.toLowerCase()}</span>
                        <span className="ml-auto text-slate-500">{formatBytes(dataExport.byteSize)}</span>
                      </div>
                      <p className="mt-2 text-slate-500">Requested {dataExport.requestedAt.toISOString()}</p>
                      <p className="mt-1 text-slate-500">{dataExport.requestedScopes.map((scope) => scope.replaceAll("_", " ").toLowerCase()).join(" · ")}</p>
                      {dataExport.failureCode ? <p className="mt-2 text-rose-700">Failure: {dataExport.failureCode}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-5 rounded-2xl bg-slate-50 px-5 py-6 text-sm text-slate-500">No exports requested.</p>
              )}

              <form action={requestBrandDataExportAction} data-harness="data-export-form" className="mt-5 rounded-2xl border border-slate-200 p-5">
                <input type="hidden" name="brandId" value={brand.id} />
                <p className="text-sm font-semibold text-slate-800">Include in export</p>
                <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                  {[
                    ["BRAND_CONFIGURATION", "Brand configuration"],
                    ["CRM", "Contacts, leads, and customers"],
                    ["INTEGRATION_METADATA", "Public integration metadata"],
                    ["AUDIT_HISTORY", "Brand audit history"],
                  ].map(([value, label]) => (
                    <label key={value} className="flex items-center gap-2">
                      <input type="checkbox" name="scopes" value={value} defaultChecked /> {label}
                    </label>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  Secrets, Southwest-owned source code, and the rented website deployment are excluded. GA4 and advertising history remain in the brand-owned external accounts.
                </p>
                <button type="submit" className="mt-4 cursor-pointer rounded-full bg-slate-950 px-5 py-2.5 font-semibold text-white">
                  Request export
                </button>
              </form>
            </div>

            <div>
              <h2 className="text-xl font-semibold">Offboarding plan</h2>
              <p className="mt-1 text-sm text-slate-500">
                Scheduling records contractual dates. It does not revoke access early.
              </p>

              {liveOffboardingPlan ? (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{liveOffboardingPlan.status.replaceAll("_", " ").toLowerCase()}</p>
                    <span>Plan {liveOffboardingPlan.id}</span>
                  </div>
                  <dl className="mt-4 grid gap-2 sm:grid-cols-[150px_1fr]">
                    <dt className="font-semibold">Service ends</dt><dd>{liveOffboardingPlan.serviceEndsAt.toISOString()}</dd>
                    <dt className="font-semibold">Access ends</dt><dd>{liveOffboardingPlan.accessEndsAt.toISOString()}</dd>
                    <dt className="font-semibold">Retention ends</dt><dd>{liveOffboardingPlan.retentionEndsAt.toISOString()}</dd>
                  </dl>
                  {liveOffboardingPlan.status === "PLANNED" ? (
                    <div className="mt-5 grid gap-4 border-t border-amber-200 pt-5 lg:grid-cols-2">
                      <form action={beginBrandOffboardingAction} data-harness="begin-offboarding-form">
                        <input type="hidden" name="brandId" value={brand.id} />
                        <input type="hidden" name="planId" value={liveOffboardingPlan.id} />
                        <label className="block font-semibold">
                          Re-enter <span className="font-mono">{brand.slug}</span> when the access-end instant arrives
                          <input name="confirmSlug" required className={inputClass} />
                        </label>
                        <button
                          type="submit"
                          disabled={!canBeginOffboarding}
                          className="mt-3 rounded-full bg-rose-800 px-5 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Begin and revoke access
                        </button>
                      </form>
                      <form action={cancelBrandOffboardingAction}>
                        <input type="hidden" name="brandId" value={brand.id} />
                        <input type="hidden" name="planId" value={liveOffboardingPlan.id} />
                        <label className="block font-semibold">
                          Re-enter <span className="font-mono">{brand.slug}</span> to cancel this plan
                          <input name="confirmSlug" required className={inputClass} />
                        </label>
                        <button type="submit" className="mt-3 cursor-pointer rounded-full border border-amber-400 bg-white px-5 py-2.5 font-semibold text-amber-950">
                          Cancel plan
                        </button>
                      </form>
                    </div>
                  ) : null}
                </div>
              ) : (
                <form action={scheduleBrandOffboardingAction} data-harness="offboarding-plan-form" className="mt-5 grid gap-4 rounded-2xl border border-slate-200 p-5">
                  <input type="hidden" name="brandId" value={brand.id} />
                  <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
                    Enter complete ISO 8601 instants with an explicit offset, such as <span className="font-mono">2026-09-01T17:00:00+10:00</span>. This avoids ambiguity between Texas and Australian time zones.
                  </p>
                  <label className="text-sm font-semibold text-slate-700">Service ends<input name="serviceEndsAt" required placeholder="2026-09-01T17:00:00+10:00" className={inputClass} /></label>
                  <label className="text-sm font-semibold text-slate-700">Interactive access ends<input name="accessEndsAt" required placeholder="2026-09-02T17:00:00+10:00" className={inputClass} /></label>
                  <label className="text-sm font-semibold text-slate-700">Live-data retention ends<input name="retentionEndsAt" required placeholder="2026-12-01T17:00:00+11:00" className={inputClass} /></label>
                  <label className="text-sm font-semibold text-slate-700">Internal reason<textarea name="reason" rows={3} className={inputClass} /></label>
                  <label className="text-sm font-semibold text-slate-700">
                    Type <span className="font-mono">{brand.slug}</span> to confirm the plan
                    <input name="confirmSlug" required className={inputClass} />
                  </label>
                  <button type="submit" className="cursor-pointer rounded-full bg-slate-950 px-5 py-3 font-semibold text-white">Schedule offboarding</button>
                </form>
              )}
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
