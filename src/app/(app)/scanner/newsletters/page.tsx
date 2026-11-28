import { redirect } from "next/navigation";

/** The Scanner's mail reviews are retired (Tom, 2026-11-28): spam is Donna's
 * Spam step now, so old links land on her jobs. */
export default function RetiredMailReviewPage() {
  redirect("/donna/current");
}
