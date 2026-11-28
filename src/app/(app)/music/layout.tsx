import { SectionTabs, type SectionTab } from "@/components/SectionTabs";

const TABS: SectionTab[] = [
  { label: "Overview", href: "/music", exact: true },
  // Who to ask about wedding songs (Tom, 2026-11-28).
  { label: "Set list", href: "/music/set-list" },
];

export default function MusicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionTabs tabs={TABS} label="Music" />
      {children}
    </>
  );
}
