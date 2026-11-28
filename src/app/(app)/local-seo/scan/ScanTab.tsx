"use client";

import { useState } from "react";
import { estimateScanCost, parseGridSettings, SPACING_OPTIONS, type GridSettings } from "@/lib/localSeo/grid";
import type { Scan } from "../stats";

const money = (value: number) => `$${value.toFixed(2)}`;
const dateTime = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export function ScanTab({ initialSettings, initialScans }: { initialSettings: GridSettings; initialScans: Scan[] }) {
  const [settings, setSettings] = useState<GridSettings>(initialSettings);
  const [scans, setScans] = useState(initialScans);
  const [keywordText, setKeywordText] = useState(initialSettings.keywords.join("\n"));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmedCost, setConfirmedCost] = useState(false);
  const settingsAreValid = Boolean(parseGridSettings(settings));
  const standardCost = settingsAreValid ? estimateScanCost(settings, "standard") : null;

  async function saveSettings() {
    const parsed = parseGridSettings({ ...settings, keywords: keywordText.split("\n") });
    if (!parsed) { setMessage(`Use 1–12 keywords, an odd grid from 3 to 9, and spacing of ${SPACING_OPTIONS.join(", ")} miles.`); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/local-seo/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not save settings.");
      setSettings(parsed); setKeywordText(parsed.keywords.join("\n"));
      setConfirmedCost(false); setMessage("Settings saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save settings."); }
    finally { setBusy(false); }
  }

  async function refresh() {
    setBusy(true); setMessage("");
    try {
      await fetch("/api/local-seo/scans/refresh", { method: "POST" });
      const response = await fetch("/api/local-seo/scans", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not refresh results.");
      if (body.scans) setScans(body.scans);
      setMessage("Results refreshed.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not refresh results."); }
    finally { setBusy(false); }
  }

  async function runScan() {
    const parsed = parseGridSettings({ ...settings, keywords: keywordText.split("\n") });
    if (!parsed) { setMessage("Save valid settings before scanning."); return; }
    setBusy(true); setMessage(`Queuing the scan. Estimated cost: ${money(standardCost?.totalUsd ?? 0)}.`);
    try {
      const response = await fetch("/api/local-seo/scans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "The scan failed.");
      const latestResponse = await fetch("/api/local-seo/scans", { cache: "no-store" });
      const latestBody = await latestResponse.json();
      if (latestBody.scans) setScans(latestBody.scans);
      setMessage(`Scan queued (estimated ${money(body.estimatedCostUsd)}). Results arrive within a few minutes: press Refresh queued results.`);
      setConfirmedCost(false);
    } catch (error) { setMessage(error instanceof Error ? error.message : "The scan failed."); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
      <h1 className="sr-only">Local SEO scan</h1>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-sm font-semibold text-slate-900">Settings and scan</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-xs font-medium text-slate-600">Grid size<select value={settings.gridSize} onChange={(event) => { setSettings({ ...settings, gridSize: Number(event.target.value) }); setConfirmedCost(false); }} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value={3}>3 × 3</option><option value={5}>5 × 5</option><option value={7}>7 × 7</option><option value={9}>9 × 9</option></select></label>
          <label className="text-xs font-medium text-slate-600">Point spacing<select value={settings.spacingMiles} onChange={(event) => { setSettings({ ...settings, spacingMiles: Number(event.target.value) }); setConfirmedCost(false); }} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">{SPACING_OPTIONS.map((miles) => <option key={miles} value={miles}>{miles} mi</option>)}</select></label>
        </div>
        <label className="mt-3 block text-xs font-medium text-slate-600">Search phrases <span className="font-normal">(one per line, up to 12)</span><textarea rows={6} value={keywordText} onChange={(event) => { setKeywordText(event.target.value); setConfirmedCost(false); }} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" /></label>
        <button onClick={saveSettings} disabled={busy || !settingsAreValid} className="mt-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 disabled:opacity-50">Save settings</button>
        <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-700"><b>Weekly Standard estimate:</b> {money(standardCost?.totalUsd ?? 0)} per scan, about {money((standardCost?.totalUsd ?? 0) * 4.33)} a month. Manual scans use the same queue; results in a few minutes. Hard cap $2.00 per scan.</p>
        <label className="mt-3 flex items-start gap-2 text-xs text-slate-600"><input type="checkbox" checked={confirmedCost} onChange={(event) => setConfirmedCost(event.target.checked)} className="mt-0.5" />I reviewed the estimate of {money(standardCost?.totalUsd ?? 0)}.</label>
        <button onClick={runScan} disabled={busy || !confirmedCost || !settingsAreValid} className="mt-2 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{busy ? "Working…" : `Run scan · ${money(standardCost?.totalUsd ?? 0)}`}</button>
        <div className="mt-2 flex justify-between gap-3"><button onClick={refresh} disabled={busy} className="text-xs font-medium text-slate-700 underline disabled:opacity-50">Refresh queued results</button><span role="status" className="text-xs text-slate-500">{message}</span></div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-900">Recent scans</h2><span className="text-xs text-slate-500">Standard queue</span></div>
        {scans.length === 0 ? <p className="mt-4 text-sm text-slate-500">No scan history yet.</p> : (
          <div className="mt-2 divide-y divide-slate-100">
            {scans.map((scan) => (
              <div key={scan.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 py-2 text-sm">
                <span className="text-slate-800">{dateTime(scan.startedAt)} · {scan.source === "weekly" ? "Weekly" : "Manual"}</span>
                <span className="text-xs text-slate-600">{scan.status} · {scan.cells.filter((cell) => cell.status === "complete").length}/{scan.cells.length} points · billed {money(scan.actualCostUsd)}</span>
                {scan.error ? <span className="w-full text-xs text-red-700">{scan.error}</span> : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
