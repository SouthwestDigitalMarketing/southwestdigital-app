"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-reads the server page every minute so the live strip stays live.
export function LiveRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => router.refresh(), seconds * 1000);
    return () => window.clearInterval(id);
  }, [router, seconds]);
  return null;
}
