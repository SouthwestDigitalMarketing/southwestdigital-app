"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ProposalViewEventInput } from "@/lib/quotes/viewEvents";

const ENDPOINT = "/api/proposal/track";
const FLUSH_MS = 4000;
const SCROLL_MILESTONES = [25, 50, 75, 100];
const SESSION_KEY = "proposal-view-session";

function getSessionId(): string {
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

/**
 * Records what a client does on the live proposal: steps reached, scroll depth,
 * which package cards came into view, package choice, and video play.
 * Pass enabled=false for staff preview and simulations so nothing is recorded.
 */
export function useProposalTracking({
  enabled,
  token,
  step,
}: {
  enabled: boolean;
  token: string | null;
  step: number;
}) {
  const queue = useRef<ProposalViewEventInput[]>([]);
  const sessionId = useRef<string | null>(null);
  const startedAt = useRef<number>(0);
  const active = enabled && Boolean(token);

  const flush = useCallback(
    (useBeacon = false) => {
      if (!active || queue.current.length === 0) return;
      sessionId.current ??= getSessionId();
      const body = JSON.stringify({ token, sessionId: sessionId.current, events: queue.current.splice(0) });
      if (useBeacon && navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "application/json" }))) return;
      void fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(
        () => undefined,
      );
    },
    [active, token],
  );

  const track = useCallback(
    (event: ProposalViewEventInput) => {
      if (!active) return;
      queue.current.push(event);
      if (queue.current.length >= 20) flush();
    },
    [active, flush],
  );

  // Visit lifecycle: open, periodic flush, and leave.
  useEffect(() => {
    if (!active) return;
    startedAt.current = Date.now();
    track({ type: "view", step });
    const timer = window.setInterval(() => flush(), FLUSH_MS);
    const onHide = () => {
      if (document.visibilityState === "hidden") {
        track({ type: "leave", step, value: Date.now() - startedAt.current });
        flush(true);
      }
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      flush(true);
    };
    // step is read only for the first event; later steps are tracked below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, flush, track]);

  // Each step: log it, then watch scroll depth and package cards for that step.
  const firstStep = useRef(true);
  useEffect(() => {
    if (!active) return;
    if (!firstStep.current) track({ type: "step", step });
    firstStep.current = false;

    const reached = new Set<number>();
    const onScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      const percent = scrollable <= 0 ? 100 : ((window.scrollY / scrollable) * 100);
      for (const milestone of SCROLL_MILESTONES) {
        if (percent >= milestone - 1 && !reached.has(milestone)) {
          reached.add(milestone);
          track({ type: "scroll_depth", step, value: milestone });
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const seen = new Set<string>();
    let observer: IntersectionObserver | null = null;
    const frame = window.requestAnimationFrame(() => {
      const cards = document.querySelectorAll<HTMLElement>("[data-track-package]");
      if (cards.length === 0 || typeof IntersectionObserver === "undefined") return;
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const el = entry.target as HTMLElement;
            const packageId = el.dataset.trackPackage;
            if (!entry.isIntersecting || !packageId || seen.has(packageId)) continue;
            seen.add(packageId);
            track({ type: "package_seen", step, packageId, position: Number(el.dataset.trackPosition ?? 0) });
          }
        },
        { threshold: 0.5 },
      );
      cards.forEach((card) => observer?.observe(card));
    });

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      observer?.disconnect();
    };
  }, [active, step, track]);

  return track;
}
