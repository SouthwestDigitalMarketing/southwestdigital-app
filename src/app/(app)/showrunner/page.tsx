import { ChannelPeriod } from "./ChannelPeriod";

export const dynamic = "force-dynamic";

export default function ThisMonthPage() {
  return <ChannelPeriod period="month" />;
}
