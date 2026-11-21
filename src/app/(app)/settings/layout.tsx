import { SectionTabs, type SectionTab } from "@/components/SectionTabs";

const TABS: SectionTab[] = [
  { label: "General", href: "/settings", exact: true },
  { label: "Security", href: "/settings/security" },
  { label: "Tags", href: "/settings/tags" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionTabs tabs={TABS} label="Settings" />
      {children}
    </>
  );
}
