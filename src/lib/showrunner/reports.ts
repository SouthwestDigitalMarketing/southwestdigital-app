import type { ReactNode } from "react";
import { BusinessSection } from "@/app/(app)/showrunner/reports/sections/BusinessSection";
import { LinksSection } from "@/app/(app)/showrunner/reports/sections/LinksSection";
import { YouTubeSection } from "@/app/(app)/showrunner/reports/sections/YouTubeSection";

/**
 * Monthly Showrunner reports (Tom, 2026-11-24). Each month's page renders every section here, in order; to add
 * a report, write a server component that takes the month ("YYYY-MM") and append it.
 */
export type ReportSection = {
  key: string;
  title: string;
  Section: (props: { month: string }) => Promise<ReactNode> | ReactNode;
};

export const REPORT_SECTIONS: ReportSection[] = [
  { key: "youtube", title: "YouTube", Section: YouTubeSection },
  { key: "links", title: "Video links", Section: LinksSection },
  { key: "business", title: "Business", Section: BusinessSection },
];
