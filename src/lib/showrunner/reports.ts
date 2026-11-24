/**
 * Monthly Showrunner reports (Tom, 2026-11-24): the list and the month pages exist; the reports themselves come
 * later. To add one, append a ReportSection here; each month's page renders every section in order.
 */
export type ReportSection = {
  key: string;
  title: string;
  /** A server component that draws the section for one month ("YYYY-MM"). */
  Section: (props: { month: string }) => Promise<React.ReactNode> | React.ReactNode;
};

export const REPORT_SECTIONS: ReportSection[] = [];
