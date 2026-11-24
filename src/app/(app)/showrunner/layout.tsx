import { SectionTabs, type SectionTab } from "@/components/SectionTabs";

// Showrunner and YouTube are one process (Tom, 2026-11-21); /youtube/* redirects here (next.config.ts).
// Four tabs from Tom's phone mock-ups (2026-11-24): Today, Series, Metrics, Leads.
const TABS: SectionTab[] = [
  { label: "Today", href: "/showrunner", exact: true, also: ["/showrunner/new", "/showrunner/videos"] },
  { label: "Series", href: "/showrunner/series", also: ["/showrunner/new-series", "/showrunner/studio"] },
  { label: "Metrics", href: "/showrunner/metrics" },
  { label: "Leads", href: "/showrunner/leads" },
];

export default function ShowrunnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionTabs tabs={TABS} label="Showrunner" />
      {children}
    </>
  );
}
