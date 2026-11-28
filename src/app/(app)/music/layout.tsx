import { SectionTabs, type SectionTab } from "@/components/SectionTabs";

const TABS: SectionTab[] = [
  { label: "Overview", href: "/music", exact: true },
  // The songs, and the people we ask about them (Tom, 2026-11-28).
  { label: "Set list", href: "/music/set-list" },
  { label: "People", href: "/music/people" },
];

export default function MusicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionTabs tabs={TABS} label="Music" />
      {children}
    </>
  );
}
