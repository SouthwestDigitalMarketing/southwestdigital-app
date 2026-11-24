import { redirect } from "next/navigation";

/** The channel numbers live on This Month (Tom, 2026-11-24). */
export default function MetricsPage() {
  redirect("/showrunner/month");
}
