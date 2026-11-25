import { redirect } from "next/navigation";
export default async function ActivityRedirect({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; kind?: string }>;
}) {
  const p = await searchParams;
  const q = new URLSearchParams();
  if (p.range) q.set("range", p.range);
  if (p.kind) q.set("kind", p.kind);
  redirect(`/scorecard/email${q.size ? `?${q}` : ""}`);
}
