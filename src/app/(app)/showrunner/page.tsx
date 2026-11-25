import { ChannelPeriod, parsePeriod } from "./ChannelPeriod";

export const dynamic = "force-dynamic";

/** Showrunner opens on Overview, with a Week / Month / Year toggle (Tom, 2026-11-25). */
export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ period?: string | string[] }> }) {
  const { period } = await searchParams;
  return <ChannelPeriod period={parsePeriod(period)} />;
}
