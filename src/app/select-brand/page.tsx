import { UserStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BrandShell } from "@/components/brand-shell";
import { getAccessibleBrands } from "@/lib/brands/repository";
import { requireTrustedPortalHost } from "@/lib/tenancy/request-host";
import { selectBrand } from "./actions";

export default async function SelectBrandPage() {
  const session = await auth();
  if (!session?.user || session.user.status !== UserStatus.ACTIVE) redirect("/login");

  const [, brands] = await Promise.all([
    requireTrustedPortalHost(session.user.platformRole),
    getAccessibleBrands(session.user.id, session.user.platformRole),
  ]);
  if (brands.length === 0) redirect("/login?error=AccessDenied");

  return (
    <BrandShell brand={null}>
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight">Choose a brand</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          This account can access more than one brand.
        </p>
        <div className="mt-6 space-y-3">
          {brands.map((brand) => (
            <form key={brand.id} action={selectBrand}>
              <input type="hidden" name="brandId" value={brand.id} />
              <button
                type="submit"
                className="w-full cursor-pointer rounded-2xl border border-slate-200 px-5 py-4 text-left font-semibold transition hover:border-slate-400 hover:bg-slate-50"
              >
                {brand.name}
              </button>
            </form>
          ))}
        </div>
      </section>
    </BrandShell>
  );
}
