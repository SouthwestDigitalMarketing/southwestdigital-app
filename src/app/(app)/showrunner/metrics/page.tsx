import { redirect } from "next/navigation";

/** The channel numbers live on Overview, Month (Tom, 2026-11-25). */
export default function MetricsPage() {
  redirect("/showrunner?period=month");
}
