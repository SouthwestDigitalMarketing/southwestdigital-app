import { SectionTabs, type SectionTab } from "@/components/SectionTabs";

// Showrunner and YouTube are one process (Tom, 2026-11-21); /youtube/* redirects here (next.config.ts).
// Tabs (Tom, 2026-11-24): This Month and This Week (calendar strip + the period's channel numbers), Series, Leads, Reports.
const TABS: SectionTab[] = [
  { label: "This Month", href: "/showrunner", exact: true, also: ["/showrunner/new", "/showrunner/videos", "/showrunner/metrics"] },
  { label: "This Week", href: "/showrunner/week" },
  { label: "Series", href: "/showrunner/series", also: ["/showrunner/new-series", "/showrunner/studio"] },
  { label: "Leads", href: "/showrunner/leads" },
  { label: "Reports", href: "/showrunner/reports" },
];

export default function ShowrunnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionTabs tabs={TABS} label="Showrunner" />
      {children}
    </>
  );
}
