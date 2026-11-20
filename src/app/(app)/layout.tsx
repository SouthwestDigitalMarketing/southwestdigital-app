import { cookies } from "next/headers";
import { BrandProvider } from "@/lib/brands/context";
import { PRIVACY_COOKIE, privacyOn } from "@/lib/privacy";
import { requireAppBrand } from "@/lib/brands/staff";
import { AppShell } from "./AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, brand, membership, accessibleBrands } = await requireAppBrand();
  const privacy = privacyOn((await cookies()).get(PRIVACY_COOKIE)?.value);

  return (
    <BrandProvider value={{ brand, membership }}>
      <AppShell
        user={{ name: session.user.name, email: session.user.email }}
        accessibleBrands={accessibleBrands.map(({ id, name }) => ({ id, name }))}
        activeBrandId={brand.id}
        privacy={privacy}
      >
        {children}
      </AppShell>
    </BrandProvider>
  );
}
