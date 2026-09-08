import { BrandProvider } from "@/lib/brands/context";
import { requireQuoteStaff } from "@/lib/quotes/access";

/**
 * Chrome-free staff surface for full-page proposal previews.
 *
 * Deliberately NOT part of the public `(proposal)` group: that group resolves
 * its brand from the request hostname, while the builder resolves the active
 * brand from the staff session. Sharing it would render one brand's proposal
 * under another brand's theme whenever a member has switched brands, and would
 * fail outright on any host without a verified APP domain. Resolving through
 * `requireQuoteStaff()` keeps this preview on exactly the brand the builder is
 * editing, and keeps the surface staff-only.
 */
export default async function PreviewLayout({ children }: { children: React.ReactNode }) {
  const { brand, membership } = await requireQuoteStaff();

  const light = brand.theme?.proposalLightColor ?? brand.theme?.lightColor ?? "#17324d";
  const accent = brand.theme?.proposalAccentColor ?? brand.theme?.accentColor ?? "#d79b3b";

  return (
    <BrandProvider value={{ brand, membership }}>
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
