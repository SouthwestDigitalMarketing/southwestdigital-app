import { headers } from "next/headers";
import { BrandShell } from "@/components/brand-shell";
import { effectiveRequestHostname } from "@/lib/brands/request";
import { resolveAppBrandByHostname } from "@/lib/brands/repository";

export default async function CheckEmailPage() {
  const headerStore = await headers();
  const hostname = effectiveRequestHostname({
    requestHostname: headerStore.get("host"),
    developmentOverride: process.env.DEV_BRAND_HOST,
    nodeEnv: process.env.NODE_ENV,
  });
  const brand = await resolveAppBrandByHostname(hostname);

  return (
    <BrandShell brand={brand}>
      <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight">Check your email</h1>
        <p className="mt-3 leading-6 text-slate-600">
          If that address has access, a secure sign-in link is on its way.
        </p>
      </section>
    </BrandShell>
  );
}

