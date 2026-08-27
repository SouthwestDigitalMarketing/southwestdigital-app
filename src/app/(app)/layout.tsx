import { BrandProvider } from "@/lib/brands/context";
import { requireAppBrand } from "@/lib/brands/staff";
import { AppShell } from "./AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, brand, membership, accessibleBrands } = await requireAppBrand();

  return (
    <BrandProvider value={{ brand, membership }}>
      <AppShell
        user={{ name: session.user.name, email: session.user.email }}
        accessibleBrands={accessibleBrands.map(({ id, name }) => ({ id, name }))}
        activeBrandId={brand.id}
      >
        {children}
      </AppShell>
    </BrandProvider>
  );
}
