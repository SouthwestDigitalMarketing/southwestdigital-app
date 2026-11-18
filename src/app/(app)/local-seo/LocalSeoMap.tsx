"use client";

import { useEffect, useRef, useState } from "react";
import { OFFICE } from "@/lib/localSeo/grid";

type MapCell = { row: number; column: number; latitude: number; longitude: number; status: string; rank: number | null };

// Google's map script is loaded once per page and shared by every map on it.
let loading: Promise<void> | null = null;

function loadGoogleMaps(key: string): Promise<void> {
  const w = window as unknown as { google?: { maps?: unknown } };
  if (w.google?.maps) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => { loading = null; reject(new Error("Google Maps did not load")); };
      document.head.appendChild(script);
    });
  }
  return loading;
}

/** Same colors as the grid boxes: green top 3, amber 4-10, orange 11-20, red not ranked, grey pending. */
function badgeColors(cell: MapCell) {
  if (cell.status !== "complete") return { fill: "#f1f5f9", stroke: "#cbd5e1", text: "#94a3b8" };
  if (cell.rank === null) return { fill: "#fee2e2", stroke: "#fca5a5", text: "#7f1d1d" };
  if (cell.rank <= 3) return { fill: "#d1fae5", stroke: "#34d399", text: "#064e3b" };
  if (cell.rank <= 10) return { fill: "#fef3c7", stroke: "#fbbf24", text: "#78350f" };
  return { fill: "#ffedd5", stroke: "#fb923c", text: "#7c2d12" };
}

function badgeIcon(cell: MapCell) {
  const { fill, stroke, text } = badgeColors(cell);
  const label = cell.rank === null ? (cell.status === "complete" ? "–" : "…") : `#${cell.rank}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="17" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/><text x="20" y="25" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" font-weight="700" fill="${text}">${label}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

/**
 * The rank grid drawn on a real Google map: each search point as a colored rank badge at its
 * own spot, the office pinned in the middle, so the grid has place and scale.
 */
export function LocalSeoMap({ cells }: { cells: MapCell[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  useEffect(() => {
    if (!key || !box.current || cells.length === 0) return;
    let cancelled = false;
    const markers: Array<{ setMap: (map: unknown) => void }> = [];
    loadGoogleMaps(key)
      .then(() => {
        if (cancelled || !box.current) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- no Google Maps types package in this repo
        const g = (window as any).google;
        const map = new g.maps.Map(box.current, {
          center: { lat: OFFICE.latitude, lng: OFFICE.longitude },
          zoom: 12,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "cooperative",
          clickableIcons: false,
        });
        const bounds = new g.maps.LatLngBounds();
        for (const cell of cells) {
          const position = { lat: cell.latitude, lng: cell.longitude };
          bounds.extend(position);
          markers.push(new g.maps.Marker({
            map, position,
            icon: { url: badgeIcon(cell), scaledSize: new g.maps.Size(34, 34), anchor: new g.maps.Point(17, 17) },
            title: cell.rank === null ? `Point ${cell.row + 1},${cell.column + 1}: not in top 20` : `Point ${cell.row + 1},${cell.column + 1}: #${cell.rank}`,
            zIndex: 1,
          }));
        }
        markers.push(new g.maps.Marker({ map, position: { lat: OFFICE.latitude, lng: OFFICE.longitude }, title: "Bookkeeping Conroe office", zIndex: 2 }));
        map.fitBounds(bounds, 24);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; markers.forEach((marker) => marker.setMap(null)); };
  }, [key, cells]);

  if (!key || failed) return null;
  return <div ref={box} className="mt-6 h-[380px] w-full overflow-hidden rounded-xl border border-slate-200 sm:h-[460px]" aria-label="Map of rank by search point" />;
}
