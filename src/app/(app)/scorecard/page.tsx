import { redirect } from "next/navigation";
import { parseRange } from "../dashboard/_scorecard/format";

/** The Scorecard now lives on the Dashboard (Tom, 2026-11-20); old links land on its section. */
export default async function ScorecardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  const range = parseRange((await searchParams).range);
  redirect(`/dashboard?rt=${range}#response-times`);
}
