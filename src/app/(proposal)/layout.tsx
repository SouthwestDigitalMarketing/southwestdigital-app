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

  const light = brand.theme?.proposalLightColor ?? brand.theme?.lightColor ?? "#17324d";
  const accent = brand.theme?.proposalAccentColor ?? brand.theme?.accentColor ?? "#d79b3b";

  return (
    <BrandProvider value={{ brand, membership: null }}>
      <div
        data-theme="light"
        style={
          {
            "--theme-light": light,
            "--theme-accent": accent,
            minHeight: "100vh",
          } as React.CSSProperties
        }
      >
        {children}
      </div>
    </BrandProvider>
  );
}
