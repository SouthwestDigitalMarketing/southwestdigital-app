import { DomainPurpose } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAppBrand } from "@/lib/brands/staff";
import { showChannelBrand, showLinksBrand } from "@/lib/showrunner/channel-brand";
import { getYouTubeRefreshToken } from "@/lib/youtube/credentials";

/** The channel a report reads (TREB from either Lochside brand), its goals and YouTube sign-in; the brand whose short links count clicks. */
export async function reportChannel() {
  const ctx = await requireAppBrand();
  const brand = await showChannelBrand(ctx.brand);
  const links = await showLinksBrand(ctx.brand);
  const [theme, domain] = await Promise.all([
    prisma.brandTheme.findUnique({
      where: { brandId: brand.id },
      select: { youtubeChannelId: true, monthlyViewsGoal: true, monthlyClicksGoal: true, youtubeWatchPercentageGoal: true },
    }),
    prisma.brandDomain.findFirst({
      where: { brandId: links.id, purpose: DomainPurpose.WEBSITE, isPrimary: true },
      select: { hostname: true },
    }),
  ]);
  const channelId = theme?.youtubeChannelId ?? null;
  const refreshToken = channelId ? await getYouTubeRefreshToken(brand.id, brand.slug) : null;
  return { ctx, brand, links, theme, channelId, refreshToken, redirectDomain: domain?.hostname ?? null };
}

export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-xl font-semibold tabular-nums text-slate-900">{value}</p>
      {note ? <p className="text-xs text-slate-500">{note}</p> : null}
    </div>
  );
}

export function Missing({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-500">{children}</p>;
}

export const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
