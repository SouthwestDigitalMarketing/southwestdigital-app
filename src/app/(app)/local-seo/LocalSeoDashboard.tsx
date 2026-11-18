"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DEFAULT_KEYWORDS, estimateScanCost, parseGridSettings, type GridSettings } from "@/lib/localSeo/grid";
import { LocalSeoMap } from "./LocalSeoMap";

type Competitor = { name: string; rank: number; address?: string | null };
type Cell = { keyword: string; row: number; column: number; latitude: number; longitude: number; status: string; rank: number | null; competitors: Competitor[] };
type Scan = { id: string; source: string; status: string; gridSize: number; spacingMiles: number; keywords: string[]; estimatedCostUsd: number; actualCostUsd: number; startedAt: string; cells: Cell[] };
type Props = { initialSettings: GridSettings; initialScans: Scan[]; storageMissing: boolean };

const money = (value: number) => `$${value.toFixed(2)}`;
const dateTime = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export function LocalSeoDashboard({ initialSettings, initialScans, storageMissing }: Props) {
  const [settings, setSettings] = useState<GridSettings>(initialSettings);
  const [scans, setScans] = useState(initialScans);
  const [selectedKeyword, setSelectedKeyword] = useState(initialSettings.keywords[0] ?? DEFAULT_KEYWORDS[0]);
  const [keywordText, setKeywordText] = useState(initialSettings.keywords.join("\n"));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmedCost, setConfirmedCost] = useState(false);
  const settingsAreValid = Boolean(parseGridSettings(settings));
  const liveCost = settingsAreValid ? estimateScanCost(settings, "live") : null;
  const standardCost = settingsAreValid ? estimateScanCost(settings, "standard") : null;
  const latest = scans[0];
  const visibleCells = (latest?.cells ?? []).filter((cell) => cell.keyword === selectedKeyword);
  const completeCells = visibleCells.filter((cell) => cell.status === "complete");
  const topThree = completeCells.filter((cell) => cell.rank !== null && cell.rank <= 3).length;
  const averageRank = completeCells.filter((cell) => cell.rank !== null).length
    ? completeCells.filter((cell) => cell.rank !== null).reduce((sum, cell) => sum + (cell.rank ?? 0), 0) / completeCells.filter((cell) => cell.rank !== null).length
    : null;
  const competitors = useMemo(() => {
    const counts = new Map<string, { name: string; appearances: number; bestRank: number }>();
    for (const cell of visibleCells) for (const competitor of cell.competitors ?? []) {
      const prior = counts.get(competitor.name) ?? { name: competitor.name, appearances: 0, bestRank: competitor.rank };
      counts.set(competitor.name, { ...prior, appearances: prior.appearances + 1, bestRank: Math.min(prior.bestRank, competitor.rank) });
    }
    return [...counts.values()].sort((a, b) => b.appearances - a.appearances || a.bestRank - b.bestRank).slice(0, 5);
  }, [visibleCells]);
  const history = scans.filter((scan) => scan.status !== "queued").slice().reverse().map((scan) => {
    const cells = scan.cells.filter((cell) => cell.keyword === selectedKeyword && cell.status === "complete");
    const ranked = cells.filter((cell) => cell.rank !== null);
    return {
      date: new Date(scan.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      average: ranked.length ? Number((ranked.reduce((sum, cell) => sum + (cell.rank ?? 0), 0) / ranked.length).toFixed(1)) : null,
      top3: cells.length ? Number(((cells.filter((cell) => cell.rank !== null && cell.rank <= 3).length / cells.length) * 100).toFixed(1)) : 0,
    };
  });

  async function saveSettings() {
    const parsed = parseGridSettings({ ...settings, keywords: keywordText.split("\n") });
    if (!parsed) { setMessage("Use 1–12 keywords, an odd grid from 3 to 9, and spacing of 0.5, 1, or 2 miles."); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/local-seo/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not save settings.");
      setSettings(parsed); setKeywordText(parsed.keywords.join("\n")); setSelectedKeyword(parsed.keywords[0]);
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
    setBusy(true); setMessage(`Starting live scan. Estimated cost: ${money(liveCost?.totalUsd ?? 0)}.`);
    try {
      const response = await fetch("/api/local-seo/scans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "The scan failed.");
      const latestResponse = await fetch("/api/local-seo/scans", { cache: "no-store" });
      const latestBody = await latestResponse.json();
      if (latestBody.scans) setScans(latestBody.scans);
      setMessage(`Scan finished. Estimated cost ${money(body.estimatedCostUsd)}; actual billed cost is shown when DataForSEO returns it.`);
      setConfirmedCost(false);
    } catch (error) { setMessage(error instanceof Error ? error.message : "The scan failed."); }
    finally { setBusy(false); }
  }

  if (storageMissing) return <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">The Local SEO tables are not in the database yet. The migration is ready; apply it after review.</section>;

  return (
    // Same page padding as the other SWapp pages (p-4 on phones, p-8 wider).
    <div className="space-y-6 p-4 sm:p-8">
      <header>
        <p className="text-sm font-medium text-slate-500">Bookkeeping Conroe · Google Maps</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">Local SEO geo grid</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">See where Bookkeeping Conroe appears around 96 Beach Walk Blvd. Each square is one search point. A scan saves its results so you can track changes over time.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Metric label="Share in top 3" value={completeCells.length ? `${((topThree / completeCells.length) * 100).toFixed(0)}%` : "—"} detail={`${topThree} of ${completeCells.length} points`} />
        <Metric label="Average rank" value={averageRank === null ? "—" : averageRank.toFixed(1)} detail="Among points where we appeared" />
        <Metric label="Latest scan" value={latest ? latest.status : "No scans"} detail={latest ? dateTime(latest.startedAt) : "Run a scan to start history"} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(310px,0.7fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-lg font-semibold text-slate-900">Rank by search point</h2><p className="mt-1 text-xs text-slate-500">Center: 30.354404, -95.58152 · points roughly {latest?.spacingMiles ?? settings.spacingMiles} mi apart</p></div>
            <select value={selectedKeyword} onChange={(event) => setSelectedKeyword(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800" aria-label="Search phrase">
              {(latest?.keywords ?? settings.keywords).map((keyword) => <option key={keyword} value={keyword}>{keyword}</option>)}
            </select>
          </div>
          {latest && visibleCells.length > 0 ? <LocalSeoMap cells={visibleCells} /> : null}
          {!latest || visibleCells.length === 0 ? <p className="mt-8 rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">No results for this phrase yet.</p> : (
            <div className="mx-auto mt-6 grid max-w-[420px] gap-2" style={{ gridTemplateColumns: `repeat(${latest.gridSize}, minmax(0, 1fr))` }} aria-label={`Map rank grid for ${selectedKeyword}`}>
              {visibleCells.sort((a, b) => a.row - b.row || a.column - b.column).map((cell) => <div key={`${cell.row}-${cell.column}`} title={`${cell.latitude}, ${cell.longitude}`} className={`flex aspect-square flex-col items-center justify-center rounded-lg border text-xs font-semibold ${cell.status !== "complete" ? "border-slate-200 bg-slate-100 text-slate-400" : cell.rank === null ? "border-red-200 bg-red-100 text-red-900" : cell.rank <= 3 ? "border-emerald-300 bg-emerald-100 text-emerald-950" : cell.rank <= 10 ? "border-amber-300 bg-amber-100 text-amber-950" : "border-orange-300 bg-orange-100 text-orange-950"}`}><span>{cell.rank === null ? (cell.status === "complete" ? "—" : "…") : `#${cell.rank}`}</span><span className="mt-1 text-[9px] font-normal">{cell.row + 1},{cell.column + 1}</span></div>)}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-600"><Legend color="bg-emerald-200" label="Top 3" /><Legend color="bg-amber-200" label="4–10" /><Legend color="bg-orange-200" label="11–20" /><Legend color="bg-red-200" label="Not in top 20" /></div>
          <p className="mt-3 text-xs text-slate-500">Cells are shown north at the top and west at the left. Ranks use the Google Maps listing order.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Settings and scan</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-slate-600">Grid size<select value={settings.gridSize} onChange={(event) => { setSettings({ ...settings, gridSize: Number(event.target.value) }); setConfirmedCost(false); }} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value={3}>3 × 3</option><option value={5}>5 × 5</option><option value={7}>7 × 7</option><option value={9}>9 × 9</option></select></label>
            <label className="text-xs font-medium text-slate-600">Point spacing<select value={settings.spacingMiles} onChange={(event) => { setSettings({ ...settings, spacingMiles: Number(event.target.value) }); setConfirmedCost(false); }} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value={0.5}>0.5 mi</option><option value={1}>1 mi</option><option value={2}>2 mi</option></select></label>
          </div>
          <label className="mt-4 block text-xs font-medium text-slate-600">Search phrases <span className="font-normal">(one per line, up to 12)</span><textarea rows={7} value={keywordText} onChange={(event) => { setKeywordText(event.target.value); setConfirmedCost(false); }} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" /></label>
          <button onClick={saveSettings} disabled={busy || !settingsAreValid} className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 disabled:opacity-50">Save settings</button>
          <div className="mt-5 rounded-xl bg-slate-50 p-3 text-xs text-slate-700"><p><b>Weekly Standard estimate:</b> {money(standardCost?.totalUsd ?? 0)} per scan. About {money((standardCost?.totalUsd ?? 0) * 4.33)} per month.</p><p className="mt-1"><b>Manual Live estimate:</b> {money(liveCost?.totalUsd ?? 0)} per scan.</p><p className="mt-1">Hard cap: $2.00 per scan. No scan starts above this limit.</p></div>
          <label className="mt-4 flex items-start gap-2 text-xs text-slate-600"><input type="checkbox" checked={confirmedCost} onChange={(event) => setConfirmedCost(event.target.checked)} className="mt-0.5" />I reviewed the Live estimate of {money(liveCost?.totalUsd ?? 0)}.</label>
          <button onClick={runScan} disabled={busy || !confirmedCost || !settingsAreValid} className="mt-2 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{busy ? "Working…" : `Run live scan · ${money(liveCost?.totalUsd ?? 0)}`}</button>
          <div className="mt-3 flex justify-between"><button onClick={refresh} disabled={busy} className="text-xs font-medium text-slate-700 underline disabled:opacity-50">Refresh queued results</button><span role="status" className="text-xs text-slate-500">{message}</span></div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold text-slate-900">Rank history</h2><p className="mt-1 text-xs text-slate-500">Average rank and top 3 share for this phrase.</p>{history.length < 2 ? <p className="mt-6 text-sm text-slate-500">History appears after more scans.</p> : <div className="mt-4 h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={history} margin={{ top: 8, right: 18, left: 0, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis yAxisId="rank" reversed domain={[1, 20]} /><YAxis yAxisId="share" orientation="right" domain={[0, 100]} tickFormatter={(value) => `${value}%`} /><Tooltip /><Line yAxisId="rank" type="monotone" dataKey="average" name="Average rank" stroke="#2563eb" connectNulls /><Line yAxisId="share" type="monotone" dataKey="top3" name="Top 3 share" stroke="#16a34a" connectNulls /></LineChart></ResponsiveContainer></div>}</div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold text-slate-900">Frequent competitors</h2><p className="mt-1 text-xs text-slate-500">Other businesses seen in this phrase’s latest grid.</p>{competitors.length === 0 ? <p className="mt-6 text-sm text-slate-500">No competitor results yet.</p> : <div className="mt-4 divide-y divide-slate-100">{competitors.map((competitor) => <div key={competitor.name} className="flex items-center justify-between gap-4 py-3"><div><p className="text-sm font-medium text-slate-900">{competitor.name}</p><p className="text-xs text-slate-500">{competitor.appearances} points · best rank #{competitor.bestRank}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{competitor.appearances}/{visibleCells.length}</span></div>)}</div>}</div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-slate-900">Recent scans</h2><span className="text-xs text-slate-500">Standard weekly · Live manual</span></div>{scans.length === 0 ? <p className="mt-4 text-sm text-slate-500">No scan history yet.</p> : <div className="mt-3 divide-y divide-slate-100">{scans.map((scan) => <div key={scan.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><span className="text-slate-800">{dateTime(scan.startedAt)} · {scan.source === "weekly" ? "Weekly Standard" : "Manual Live"}</span><span className="text-slate-600">{scan.status} · {scan.cells.filter((cell) => cell.status === "complete").length}/{scan.cells.length} points</span><span className="text-slate-600">Estimated {money(scan.estimatedCostUsd)} · billed {money(scan.actualCostUsd)}</span></div>)}</div>}</section>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>;
}

function Legend({ color, label }: { color: string; label: string }) { return <span className="inline-flex items-center gap-1.5"><span className={`h-3 w-3 rounded ${color}`} />{label}</span>; }
