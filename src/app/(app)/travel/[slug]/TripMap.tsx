"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { MapPin, SectionKey } from "@/lib/travel/plan";

/**
 * The trip's options, stays and places on one map (Tom, 2026-11-25). Leaflet with OpenStreetMap
 * tiles: no key, so it works on the production domains and on plain-http previews alike.
 */
export const PIN_COLORS: Partial<Record<SectionKey, string>> = {
  options: "#2563eb",
  stays: "#059669",
  places: "#d97706",
  spots: "#7c3aed",
};
const PIN_LABELS: Partial<Record<SectionKey, string>> = {
  options: "Option",
  stays: "Stay",
  places: "Place to go",
  spots: "Day-to-day spot",
};

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

export function TripMap({
  pins,
  hrefFor,
  className = "h-72 sm:h-96",
  zoom = 12,
}: {
  pins: MapPin[];
  hrefFor?: (pin: MapPin) => string;
  className?: string;
  /** Used when there is a single pin. */
  zoom?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const key = JSON.stringify(pins.map((pin) => [pin.section, pin.id, pin.lat, pin.lng, pin.name]));

  useEffect(() => {
    if (!box.current || pins.length === 0) return;
    let cancelled = false;
    let map: import("leaflet").Map | null = null;
    import("leaflet").then((L) => {
      if (cancelled || !box.current) return;
      map = L.map(box.current, { scrollWheelZoom: false, attributionControl: true });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      const points: Array<[number, number]> = [];
      for (const pin of pins) {
        const color = PIN_COLORS[pin.section] ?? "#475569";
        const href = hrefFor?.(pin);
        const label = `<strong>${escapeHtml(pin.name)}</strong><br><span style="color:#64748b">${PIN_LABELS[pin.section] ?? ""}</span>${
          href ? `<br><a href="${escapeHtml(href)}">Open</a>` : ""
        }`;
        L.circleMarker([pin.lat, pin.lng], { radius: 9, color: "#ffffff", weight: 2, fillColor: color, fillOpacity: 0.95 })
          .bindPopup(label)
          .addTo(map);
        points.push([pin.lat, pin.lng]);
      }
      if (points.length === 1) map.setView(points[0], zoom);
      else map.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom: 13 });
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
    // `key` stands in for pins; hrefFor and zoom are stable for a page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (pins.length === 0) {
    return (
      <div className={`${className} flex items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm text-slate-500`}>
        No pins yet. Options, stays and places show up here once they have a location.
      </div>
    );
  }
  return <div ref={box} className={`${className} relative z-0 overflow-hidden rounded-xl border border-slate-200`} role="region" aria-label="Map" />;
}

export function MapLegend({ sections }: { sections: SectionKey[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
      {sections.map((key) => (
        <span key={key} className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full border border-white" style={{ background: PIN_COLORS[key] }} />
          {PIN_LABELS[key]}
        </span>
      ))}
    </div>
  );
}
