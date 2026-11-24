import { ChannelPeriod } from "../ChannelPeriod";

export const dynamic = "force-dynamic";

export default function ThisWeekPage() {
  return <ChannelPeriod period="week" />;
}
