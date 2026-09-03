"use client";

import { useEffect } from "react";

export function DuplicateOfferFocus({ offerId }: { offerId: string }) {
  useEffect(() => {
    document.getElementById(`offer-row-${offerId}`)?.scrollIntoView({
      behavior: "instant",
      block: "center",
    });
  }, [offerId]);

  return null;
}
