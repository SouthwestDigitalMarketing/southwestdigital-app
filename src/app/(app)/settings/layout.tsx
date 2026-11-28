import { SectionTabs, type SectionTab } from "@/components/SectionTabs";
import { requireAppBrand } from "@/lib/brands/staff";

const TABS: SectionTab[] = [
  { label: "General", href: "/settings", exact: true },
  { label: "Security", href: "/settings/security" },
  { label: "Tags", href: "/settings/tags" },
];
// Platform operators only: the ChatGPT bridge ON/OFF switch (Tom, 2026-11-28).
const OPERATOR_TABS: SectionTab[] = [{ label: "Bridge", href: "/settings/bridge" }];

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { isPlatformOperator } = await requireAppBrand();
  return (
    <>
      <SectionTabs tabs={isPlatformOperator ? [...TABS, ...OPERATOR_TABS] : TABS} label="Settings" />
      {children}
    </>
  );
}
