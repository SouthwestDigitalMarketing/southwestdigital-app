import { headers } from "next/headers";
import { resolvePublicBrand } from "@/lib/brands/resolve";
import { BrandProvider } from "@/lib/brands/context";

export default async function ProposalLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const hostname = headersList.get("x-hostname");

  const brand = await resolvePublicBrand(hostname);

  if (!brand) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Proposal not available.
      </div>
    );
  }

  const primary = brand.theme?.primaryColor ?? "#17324d";
  const accent = brand.theme?.accentColor ?? "#d79b3b";

  return (
    <BrandProvider value={{ brand, membership: null }}>
      <div
        data-theme="light"
        style={
          {
            "--brand-primary": primary,
            "--brand-accent": accent,
            minHeight: "100vh",
          } as React.CSSProperties
        }
      >
        {children}
      </div>
    </BrandProvider>
  );
}
