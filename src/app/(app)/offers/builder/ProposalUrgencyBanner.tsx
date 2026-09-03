"use client";

import { Clock } from "lucide-react";
import type { UrgencyOfferDisplay } from "./urgencyOffer";
import { getProposalUrgencySurfaceColors } from "./proposalThemes";

export function ProposalUrgencyBanner({
  offer,
  accentColor,
  inkColor,
  compact = false,
}: {
  offer: UrgencyOfferDisplay;
  accentColor: string;
  inkColor: string;
  compact?: boolean;
}) {
  if (!offer.active) return null;
  const surface = getProposalUrgencySurfaceColors(accentColor, inkColor);

  return (
    <aside
      data-proposal-surface="light"
      className={`rounded-xl border shadow-sm ${compact ? "px-4 py-3" : "px-5 py-4"}`}
      style={{
        borderColor: surface.border,
        backgroundColor: surface.background,
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full"
          style={{
            color: surface.ink,
            backgroundColor: surface.iconBackground,
            boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accentColor} 35%, transparent)`,
          }}
        >
          <Clock className="h-4 w-4" strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: surface.ink }}>
            Limited-time offer · {offer.remainingLabel}
          </p>
          <p className={`font-semibold ${compact ? "mt-1 text-sm" : "mt-1 text-base"}`} style={{ color: surface.ink }}>
            {offer.headline}
          </p>
          {compact ? null : <p className="mt-1 text-sm leading-6 text-slate-600">{offer.details}</p>}
          <p className="mt-2 text-xs font-medium text-slate-500">
            After {offer.dateLabel}, this offer no longer applies.
          </p>
        </div>
      </div>
    </aside>
  );
}

export function ProposalUrgencyNote({
  offer,
  color,
}: {
  offer: UrgencyOfferDisplay;
  color: string;
}) {
  if (!offer.active) return null;
  return (
    <p className="mt-3 text-sm font-medium" style={{ color }}>
      Limited-time: {offer.headline}
    </p>
  );
}
