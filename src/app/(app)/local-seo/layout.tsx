import { SectionTabs, SwipeBetweenTabs, type SectionTab } from "@/components/SectionTabs";

// Tabs (Tom, 2026-11-28): one page per job, each meant to fit above the fold.
const TABS: SectionTab[] = [
  { label: "Overview", href: "/local-seo", exact: true },
  { label: "Map", href: "/local-seo/map" },
  { label: "Plan", href: "/local-seo/plan" },
  { label: "Trends", href: "/local-seo/trends" },
  { label: "Scan", href: "/local-seo/scan" },
];

export default function LocalSeoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionTabs tabs={TABS} label="Local SEO" />
      <SwipeBetweenTabs tabs={TABS}>{children}</SwipeBetweenTabs>
    </>
  );
}
