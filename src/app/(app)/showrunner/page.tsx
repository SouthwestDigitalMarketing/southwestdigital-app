import { ChannelPeriod } from "./ChannelPeriod";

export const dynamic = "force-dynamic";

/** Showrunner opens on This Week (Tom, 2026-11-24). */
export default function ThisWeekPage() {
  return <ChannelPeriod period="week" />;
}
