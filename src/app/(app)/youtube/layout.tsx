import { SectionTabs, type SectionTab } from "@/components/SectionTabs";

const TABS: SectionTab[] = [
  { label: "Overview", href: "/youtube", exact: true },
  { label: "Videos", href: "/youtube/videos" },
  { label: "New video", href: "/youtube/new" },
];

export default function YouTubeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionTabs tabs={TABS} label="YouTube" />
      {children}
    </>
  );
}
