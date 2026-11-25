import { redirect } from "next/navigation";

/** This Month is the Month setting on Overview (Tom, 2026-11-25). */
export default function ThisMonthPage() {
  redirect("/showrunner?period=month");
}
