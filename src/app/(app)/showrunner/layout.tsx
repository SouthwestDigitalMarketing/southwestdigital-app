import { SectionTabs, SwipeBetweenTabs, type SectionTab } from "@/components/SectionTabs";

// Showrunner and YouTube are one process (Tom, 2026-11-21); /youtube/* redirects here (next.config.ts).
// Tabs (Tom, 2026-11-24): This Week (the landing page) and This Month (calendar strip + the period's channel numbers), Series, Leads, Reports.
const TABS: SectionTab[] = [
  // Overview (Tom, 2026-11-25): This Week and This Month became one tab with a Week / Month / Year toggle.
  { label: "Overview", href: "/showrunner", exact: true, also: ["/showrunner/new", "/showrunner/videos", "/showrunner/week", "/showrunner/month", "/showrunner/metrics", "/showrunner/production"] },
  { label: "Series", href: "/showrunner/series", also: ["/showrunner/new-series", "/showrunner/studio"] },
  { label: "Leads", href: "/showrunner/leads" },
  { label: "Reports", href: "/showrunner/reports" },
  // Editor (Tom, 2026-11-25): pick an episode to change; the editing tools come later.
  { label: "Editor", href: "/showrunner/editor" },
];

export default function ShowrunnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionTabs tabs={TABS} label="Showrunner" />
      <SwipeBetweenTabs tabs={TABS}>{children}</SwipeBetweenTabs>
    </>
  );
}
