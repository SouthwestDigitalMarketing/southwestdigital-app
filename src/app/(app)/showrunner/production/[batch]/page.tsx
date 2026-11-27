import { redirect } from "next/navigation";
import { episodeHref } from "@/lib/showrunner/production";

export const dynamic = "force-dynamic";

/** Old production URL: same episode screen as the Videos card (Tom, 2026-11-27). */
export default async function ProductionPage({ params }: { params: Promise<{ batch: string }> }) {
  const { batch } = await params;
  redirect(episodeHref(batch));
}
