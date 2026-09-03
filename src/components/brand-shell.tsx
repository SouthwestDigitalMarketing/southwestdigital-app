import type { CSSProperties, ReactNode } from "react";
import type { BrandSummary } from "@/lib/brands/repository";

type BrandCssProperties = CSSProperties & {
  "--theme-light": string;
  "--theme-accent": string;
  "--brand-background": string;
  "--brand-foreground": string;
};

export function BrandShell({
  brand,
  children,
}: {
  brand: BrandSummary | null;
  children: ReactNode;
}) {
  const style: BrandCssProperties = {
    "--theme-light": brand?.theme?.lightColor ?? "#17324d",
    "--theme-accent": brand?.theme?.accentColor ?? "#d79b3b",
    "--brand-background": brand?.theme?.backgroundColor ?? "#f7f8fa",
    "--brand-foreground": brand?.theme?.foregroundColor ?? "#17202a",
  };

  return (
    <main
      style={style}
      className="flex min-h-screen items-center justify-center bg-[var(--brand-background)] px-5 py-12 text-[var(--brand-foreground)]"
    >
      <div className="w-full max-w-md">
        <div className="mb-7 text-center">
          {brand?.theme?.logoUrl ? (
            // Brand administrators control this URL; alt text remains explicit.
            // eslint-disable-next-line @next/next/no-img-element
            <div className="mx-auto h-16 w-full max-w-64">
              <img
                src={brand.theme.logoUrl}
                alt={brand.theme.logoAlt ?? `${brand.name} logo`}
                className="brand-asset-fit"
              />
            </div>
          ) : (
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[var(--theme-light)]">
              {brand?.name ?? "Southwest Digital App"}
            </p>
          )}
        </div>
        {children}
        <p className="mt-6 text-center text-xs text-slate-500">
          Powered by Southwest Digital Marketing
        </p>
      </div>
    </main>
  );
}

