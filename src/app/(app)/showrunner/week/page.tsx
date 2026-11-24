import { redirect } from "next/navigation";

/** This Week moved to the Showrunner landing page (Tom, 2026-11-24). */
export default function ThisWeekPage() {
  redirect("/showrunner");
}
