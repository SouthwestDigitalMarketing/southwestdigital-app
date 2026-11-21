import { SectionTabs, type SectionTab } from "@/components/SectionTabs";

const TABS: SectionTab[] = [
  { label: "Agreements", href: "/agreements", exact: true },
  { label: "Templates", href: "/agreements/templates" },
  // Opens ripley's PDF viewer (needs Tailscale).
  { label: "Client PDFs", href: "/agreements/pdfs" },
];

export default function AgreementsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionTabs tabs={TABS} label="Agreements" />
      {children}
    </>
  );
}
