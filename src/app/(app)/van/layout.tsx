import { SectionTabs, SwipeBetweenTabs, type SectionTab } from "@/components/SectionTabs";

// Tabs (Tom, 2026-11-28): Overview opens with the savings bar and the one top van; swipe between tabs as in Showrunner.
const TABS: SectionTab[] = [
  { label: "Overview", href: "/van", exact: true },
  { label: "Vans", href: "/van/vans" },
  { label: "Checklist", href: "/van/checklist" },
  { label: "Costs", href: "/van/costs" },
  { label: "Must-haves", href: "/van/needs" },
];

export default function VanLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionTabs tabs={TABS} label="Van" />
      <SwipeBetweenTabs tabs={TABS}>{children}</SwipeBetweenTabs>
    </>
  );
}
