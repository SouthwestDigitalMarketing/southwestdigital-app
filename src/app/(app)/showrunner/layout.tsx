import { SectionTabs, type SectionTab } from "@/components/SectionTabs";

// Showrunner and YouTube are one process (Tom, 2026-11-21); /youtube/* redirects here (next.config.ts).
const TABS: SectionTab[] = [
  { label: "Overview", href: "/showrunner", exact: true },
  { label: "Studio", href: "/showrunner/studio" },
  { label: "Videos", href: "/showrunner/videos" },
  { label: "New video", href: "/showrunner/new" },
  { label: "Series", href: "/showrunner/series", also: ["/showrunner/new-series"] },
];

export default function ShowrunnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionTabs tabs={TABS} label="Showrunner" />
      {children}
    </>
  );
}
