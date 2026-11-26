"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export function RefreshDonna({ every = 15000 }: { every?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, every);
    return () => clearInterval(timer);
  }, [router, every]);
  return null;
}
