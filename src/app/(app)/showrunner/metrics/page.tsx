import { redirect } from "next/navigation";

/** The channel numbers live on Overview again (Tom, 2026-11-24). */
export default function MetricsPage() {
  redirect("/showrunner");
}
