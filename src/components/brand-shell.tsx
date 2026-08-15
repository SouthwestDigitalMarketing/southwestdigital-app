import type { CSSProperties, ReactNode } from "react";
import type { BrandSummary } from "@/lib/brands/repository";

type BrandCssProperties = CSSProperties & {
  "--brand-primary": string;
  "--brand-accent": string;
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
    "--brand-primary": brand?.theme?.primaryColor ?? "#17324d",
    "--brand-accent": brand?.theme?.accentColor ?? "#d79b3b",
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
            <img
              src={brand.theme.logoUrl}
              alt={brand.theme.logoAlt ?? `${brand.name} logo`}
              className="mx-auto max-h-16 max-w-64 object-contain"
            />
          ) : (
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[var(--brand-primary)]">
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

