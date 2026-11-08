"use client";

import { useRouter } from "next/navigation";

export function HistoryBackLink({
  fallbackHref,
  className,
}: {
  fallbackHref: string;
  className?: string;
}) {
  const router = useRouter();

  return (
    <a
      href={fallbackHref}
      onClick={(event) => {
        if (window.history.length > 1) {
          event.preventDefault();
          router.back();
        }
      }}
      className={className}
    >
      ← Back
    </a>
  );
}
