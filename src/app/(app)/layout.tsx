import { BrandProvider } from "@/lib/brands/context";
import { requireAppBrand } from "@/lib/brands/staff";
import Link from "next/link";
import { AppShell } from "./AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, brand, membership, accessibleBrands, appLock } = await requireAppBrand();

  return (
    <BrandProvider value={{ brand, membership }}>
      <AppShell
        user={{ name: session.user.name, email: session.user.email }}
        accessibleBrands={accessibleBrands.map(({ id, name }) => ({ id, name }))}
        activeBrandId={brand.id}
      >
        {appLock.changeDue ? (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 sm:px-8">
            Monthly PIN change is due.{" "}
            <Link href="/settings/security" className="font-semibold underline">
              Change your PIN
            </Link>
          </div>
        ) : null}
        {children}
      </AppShell>
    </BrandProvider>
  );
}
