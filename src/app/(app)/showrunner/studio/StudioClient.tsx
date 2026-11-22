"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp, Film, RotateCcw, Sparkles } from "lucide-react";
import { SERIES, lastHook, mountainPosition, type Answers, type Episode } from "@/lib/showrunner/studio";
import { changeStudio } from "./actions";

type Props = { episodes: Episode[]; mountainCurrent: number | null; showDollars: boolean; interviewStorageKey: string };
type Screen = "home" | "interview" | "draft" | "shoot";
const QUESTIONS: { key: keyof Answers; title: string; help: string; placeholder: string }[] = [
  { key: "happened", title: "What came up this week?", help: "Tell me one real client situation. Your answer stays in private planning notes.", placeholder: "A client had three sets of books to bring together…" },
  { key: "handled", title: "How did we help?", help: "What did you or the team actually do?", placeholder: "We made a clear list, got access, and…" },
  { key: "outcome", title: "What happened?", help: "A win, a snag, or something still open is fine.", placeholder: "The client signed. We are still waiting for…" },
  { key: "service", title: "What can we show on the scoreboard?", help: "Choose one firm-wide service number, or say what you still need to measure. No client figures.", placeholder: "Our average reply time this week was…" },
  { key: "next", title: "What should next week tease?", help: "Give people a reason to come back.", placeholder: "Can we onboard three sets of books at once?" },
];
const EMPTY: Answers = { happened: "", handled: "", outcome: "", service: "", next: "" };
const field = "w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";
const primary = "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto";
const secondary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400";

function MountainCard({ current, dollars }: { current: number | null; dollars: boolean }) {
  const position = mountainPosition(current);
  const label = current === null ? "Position not set" : dollars ? `$${current.toLocaleString("en-US")} this month` : `${position.percent}% of the climb`;
  return (
    <div className="relative overflow-hidden rounded-3xl bg-[#101933] p-6 text-white shadow-xl sm:p-8">
      <div className="relative z-10">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-indigo-200">The climb to $10K</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{position.name}</h2>
        <p className="mt-1 text-sm text-slate-300">{label}</p>
      </div>
      <svg className="mt-7 h-28 w-full" viewBox="0 0 600 140" role="img" aria-label={`Mountain progress: ${position.name}, ${position.percent} percent`}>
        <path d="M0 132 L72 113 L160 100 L266 76 L380 58 L476 31 L550 9 L600 45 L600 140 L0 140Z" fill="#27345c" />
        <path d="M28 125 L145 106 L265 82 L380 63 L550 14" fill="none" stroke="#8b99be" strokeWidth="4" strokeDasharray="2 12" strokeLinecap="round" />
        {SERIES.waypoints.map((point, index) => {
          const coords = [[28, 125], [145, 106], [265, 82], [380, 63], [550, 14]][index];
          return <circle key={point.name} cx={coords[0]} cy={coords[1]} r={current !== null && current >= point.at ? 8 : 6} fill={current !== null && current >= point.at ? "#f97373" : "#9ca9c9"} stroke="#101933" strokeWidth="3" />;
        })}
        {(() => {
          const points = [[28, 125], [145, 106], [265, 82], [380, 63], [550, 14]];
          const segment = Math.min(3, Math.floor(Math.min(position.percent, 99) / 25));
          const fraction = (position.percent - segment * 25) / 25;
          const x = points[segment][0] + (points[segment + 1][0] - points[segment][0]) * fraction;
          const y = points[segment][1] + (points[segment + 1][1] - points[segment][1]) * fraction;
          return <circle cx={x} cy={y} r="12" fill="#ef4444" stroke="white" strokeWidth="3" />;
        })()}
      </svg>
      <div className="relative z-10 mt-2 flex justify-between gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-300 sm:text-xs">
        <span>Base Camp</span><span>Camp One</span><span>Halfway</span><span>High Camp</span><span>Summit</span>
      </div>
    </div>
  );
}

export function StudioClient({ episodes, mountainCurrent, showDollars, interviewStorageKey }: Props) {
  const router = useRouter();
  const active = [...episodes].reverse().find((episode) => episode.status === "draft" || episode.status === "locked");
  const previousHook = lastHook(episodes);
  const [screen, setScreen] = useState<Screen>(active?.status === "draft" ? "draft" : active?.status === "locked" ? "shoot" : "home");
  const [answers, setAnswers] = useState<Answers>(() => {
    if (typeof window === "undefined") return EMPTY;
    try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(interviewStorageKey) ?? "{}") }; } catch { return EMPTY; }
  });
  const [question, setQuestion] = useState(0);
  const [edited, setEdited] = useState<Episode | null>(active?.status === "draft" ? active : null);
  const [beatIndex, setBeatIndex] = useState(0);
  const [clipIndex, setClipIndex] = useState(0);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [editingIdea, setEditingIdea] = useState(false);
  const [positionOpen, setPositionOpen] = useState(false);
  const [positionInput, setPositionInput] = useState(mountainCurrent === null ? "" : String(mountainCurrent));
  const [dollarsInput, setDollarsInput] = useState(showDollars);
  const [publishedUrl, setPublishedUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();

  useEffect(() => {
    document.getElementById("main-content")?.scrollTo({ top: 0, behavior: "auto" });
  }, [screen]);

  function updateAnswer(key: keyof Answers, value: string) {
    setAnswers((old) => {
      const next = { ...old, [key]: value };
      try { localStorage.setItem(interviewStorageKey, JSON.stringify(next)); } catch { /* private browsing */ }
      return next;
    });
  }
  function run(change: Parameters<typeof changeStudio>[0], onDone?: () => void) {
    setError("");
    startTransition(async () => {
      try { await changeStudio(change); onDone?.(); router.refresh(); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "That did not save. Please try again."); }
    });
  }
  function patchEpisode(patch: Partial<Episode>) { setEdited((old) => old ? { ...old, ...patch } : old); }
  function patchBeat(index: number, patch: Partial<Episode["beats"][number]>) {
    setEdited((old) => old ? { ...old, beats: old.beats.map((beat, at) => at === index ? { ...beat, ...patch } : beat) } : old);
  }
  function moveBeat(direction: -1 | 1) {
    if (!edited) return;
    const nextIndex = beatIndex + direction;
    if (nextIndex < 0 || nextIndex >= edited.beats.length) return;
    const beats = [...edited.beats];
    [beats[beatIndex], beats[nextIndex]] = [beats[nextIndex], beats[beatIndex]];
    patchEpisode({ beats }); setBeatIndex(nextIndex);
  }
  function regenerateBeat() {
    if (!edited) return;
    setError("");
    startTransition(async () => {
      try {
        const result = await changeStudio({ kind: "regenerate", episode: edited, index: beatIndex });
        if (result) setEdited(result);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "That beat did not change. Please try again.");
      }
    });
  }
  const latestPublished = [...episodes].reverse().find((episode) => episode.status === "published");

  return (
    <main className="min-h-[70vh] bg-[#f7f8fc] px-4 py-6 text-slate-900 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white"><Film size={21} /></div>
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">Showrunner Studio</p><h1 className="text-xl font-bold tracking-tight">The $10K Month</h1></div>
        </div>

        {screen === "home" && (
          <div className="grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
            <section className="space-y-6">
              <MountainCard current={mountainCurrent} dollars={showDollars} />
              <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
                <button type="button" onClick={() => setPositionOpen(!positionOpen)} className="flex w-full items-center justify-between text-left text-sm font-semibold text-slate-700">
                  Set mountain position {positionOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                {positionOpen && <div className="mt-4 space-y-3"><p className="text-sm text-slate-500">Monthly free cash flow, after expenses, owner draw, and tax set-aside. Leave it blank for Base Camp.</p>
                  <input className={field} type="number" min="0" max="1000000" inputMode="numeric" value={positionInput} onChange={(event) => setPositionInput(event.target.value)} placeholder="Amount in dollars" aria-label="Current monthly free cash flow" />
                  <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={dollarsInput} onChange={(event) => setDollarsInput(event.target.checked)} className="h-5 w-5 accent-indigo-600" />Show dollars on the graphic</label>
                  <button type="button" className={secondary} disabled={busy} onClick={() => run({ kind: "mountain", current: positionInput.trim() === "" ? null : Number(positionInput), showDollars: dollarsInput }, () => setPositionOpen(false))}>Save position</button>
                </div>}
              </div>
            </section>
            <section className="flex flex-col justify-center rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">This week&apos;s episode</p>
              <h2 className="mt-4 max-w-md text-3xl font-bold leading-tight tracking-tight sm:text-4xl">Let&apos;s find the story worth telling.</h2>
              <p className="mt-4 max-w-md text-slate-600">Five short questions. Then we shape one clip at a time.</p>
              {previousHook ? <div className="mt-6 rounded-2xl bg-indigo-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-indigo-700">Last week&apos;s hook</p><p className="mt-1 text-slate-800">{previousHook}</p></div> : <p className="mt-6 text-sm text-slate-500">First episode? Start with the real story that mattered most this week.</p>}
              <button type="button" className={`${primary} mt-8`} onClick={() => { setQuestion(0); setScreen("interview"); }}>Plan this week&apos;s episode <ArrowRight size={19} /></button>
              {episodes.length === 0 && <button type="button" className="mt-3 text-left text-sm font-semibold text-indigo-700 underline underline-offset-4 disabled:opacity-50" disabled={busy} onClick={() => run({ kind: "pilot" })}>Use the contract pilot instead</button>}
              {latestPublished && <a className="mt-6 text-sm font-semibold text-indigo-700 underline underline-offset-4" href={latestPublished.publishedUrl ?? "#"} target="_blank" rel="noopener noreferrer">Watch the last episode</a>}
              {latestPublished && <p className="mt-3 text-sm text-slate-500">Last episode: {latestPublished.title}</p>}
            </section>
          </div>
        )}

        {screen === "interview" && <div className="mx-auto max-w-2xl">
          <div className="mb-6 flex items-center justify-between"><button type="button" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900" onClick={() => question === 0 ? setScreen("home") : setQuestion(question - 1)}><ArrowLeft size={18} /> Back</button><span className="text-sm font-semibold text-slate-500">{question + 1} of {QUESTIONS.length}</span></div>
          <div className="mb-8 flex gap-2" aria-hidden="true">{QUESTIONS.map((item, index) => <div key={item.key} className={`h-1.5 flex-1 rounded-full ${index <= question ? "bg-indigo-600" : "bg-slate-200"}`} />)}</div>
          <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">Your story, your words</p>
            <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{QUESTIONS[question].title}</h2>
            <p className="mt-3 text-slate-600">{QUESTIONS[question].help}</p>
            <textarea autoFocus className={`${field} mt-8 min-h-48 resize-y text-lg leading-relaxed`} maxLength={QUESTIONS[question].key === "next" || QUESTIONS[question].key === "service" ? 500 : 1500} value={answers[QUESTIONS[question].key]} onChange={(event) => updateAnswer(QUESTIONS[question].key, event.target.value)} placeholder={QUESTIONS[question].placeholder} aria-label={QUESTIONS[question].title} />
            <p className="mt-2 text-xs text-slate-400">You can dictate here. These notes are private; review all on-screen text before filming.</p>
            <button type="button" disabled={busy || !answers[QUESTIONS[question].key].trim()} className={`${primary} mt-7`} onClick={() => { if (question < QUESTIONS.length - 1) setQuestion(question + 1); else run({ kind: "draft", answers }, () => { try { localStorage.removeItem(interviewStorageKey); } catch {} setAnswers(EMPTY); }); }}>
              {question === QUESTIONS.length - 1 ? <><Sparkles size={19} /> Draft episode</> : <>Next question <ArrowRight size={19} /></>}
            </button>
          </section>
        </div>}

        {screen === "draft" && edited && <div className="mx-auto max-w-3xl space-y-5">
          <div className="rounded-3xl bg-[#101933] p-6 text-white sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-200">Episode draft · {edited.draftSource === "openai" ? "AI draft" : "Guided draft"}</p><h2 className="mt-3 text-3xl font-bold tracking-tight">{edited.title}</h2><p className="mt-3 text-slate-300">One clip per beat. These are talking points, not a script.</p></div>
          {edited.draftWarning && <p role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{edited.draftWarning}</p>}
          <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
            <button type="button" className="flex w-full items-center justify-between text-left font-semibold" onClick={() => setEditingIdea(!editingIdea)}>Episode idea {editingIdea ? <ChevronUp size={19} /> : <ChevronDown size={19} />}</button>
            {editingIdea && <div className="mt-5 space-y-4">{(["title", "question", "payoff", "hook"] as const).map((key) => <label key={key} className="block"><span className="mb-1 block text-sm font-semibold capitalize">{key === "hook" ? "Next week's hook" : key}</span><input className={field} value={edited[key]} maxLength={key === "title" ? 90 : key === "payoff" ? 300 : 220} onChange={(event) => patchEpisode({ [key]: event.target.value })} /></label>)}</div>}
            {edited.carriedHook && <p className="mt-4 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-900">Picking up last week: {edited.carriedHook}</p>}
          </section>
          <div className="flex items-center justify-between px-1"><p className="text-sm font-semibold text-slate-500">Beat {beatIndex + 1} of {edited.beats.length}</p><div className="flex gap-2"><button type="button" className={secondary} disabled={beatIndex === 0} onClick={() => moveBeat(-1)} aria-label="Move beat earlier"><ChevronUp size={17} /> Earlier</button><button type="button" className={secondary} disabled={beatIndex === edited.beats.length - 1} onClick={() => moveBeat(1)} aria-label="Move beat later"><ChevronDown size={17} /> Later</button></div></div>
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">Clip {beatIndex + 1}</p>
            <input className={`${field} mt-4 text-xl font-bold`} maxLength={80} value={edited.beats[beatIndex].name} onChange={(event) => patchBeat(beatIndex, { name: event.target.value })} aria-label="Beat name" />
            <p className="mt-6 text-xs font-bold uppercase tracking-wide text-slate-500">Talking points</p>
            <div className="mt-2 space-y-2">{edited.beats[beatIndex].talk.map((point, at) => <input key={at} className={field} maxLength={180} value={point} onChange={(event) => patchBeat(beatIndex, { talk: edited.beats[beatIndex].talk.map((value, index) => index === at ? event.target.value : value) })} aria-label={`Talking point ${at + 1}`} />)}</div>
            <p className="mt-6 text-xs font-bold uppercase tracking-wide text-slate-500">What to show</p>
            <div className="mt-2 space-y-2">{edited.beats[beatIndex].show.map((shot, at) => <input key={at} className={field} maxLength={180} value={shot} onChange={(event) => patchBeat(beatIndex, { show: edited.beats[beatIndex].show.map((value, index) => index === at ? event.target.value : value) })} aria-label={`Shot ${at + 1}`} />)}</div>
            <button type="button" disabled={busy} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 hover:text-indigo-900 disabled:opacity-50" onClick={regenerateBeat}><RotateCcw size={16} /> Try another beat</button>
          </section>
          <div className="flex items-center justify-between gap-3"><button type="button" className={secondary} disabled={beatIndex === 0} onClick={() => setBeatIndex(beatIndex - 1)}><ArrowLeft size={17} /> Previous</button><button type="button" className={secondary} disabled={beatIndex === edited.beats.length - 1} onClick={() => setBeatIndex(beatIndex + 1)}>Next beat <ArrowRight size={17} /></button></div>
          <label className="block rounded-3xl border border-slate-200 bg-white p-5 sm:p-6"><span className="block text-sm font-semibold">Firm-wide service number</span><span className="mt-1 block text-sm text-slate-500">This appears in shoot mode. Add a real number before locking.</span><input className={`${field} mt-3`} maxLength={180} value={edited.serviceNumber} onChange={(event) => patchEpisode({ serviceNumber: event.target.value })} placeholder="Our firm-wide average reply time was 2 hours" /></label>
          <div className="rounded-3xl border border-indigo-200 bg-indigo-50 p-5 sm:p-6"><label className="flex items-start gap-3 text-sm text-indigo-950"><input type="checkbox" checked={privacyChecked} onChange={(event) => setPrivacyChecked(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-indigo-600" /><span>I checked every beat: no client names or people, no amount a client pays, and no private screens. The number on the mountain is firm-wide.</span></label>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row"><button type="button" className={secondary} disabled={busy} onClick={() => run({ kind: "edit", episode: edited })}>Save draft</button><button type="button" className={primary} disabled={busy || !privacyChecked} onClick={() => run({ kind: "lock", episode: edited, privacyChecked })}>Lock episode <ArrowRight size={18} /></button></div>
          </div>
        </div>}

        {screen === "shoot" && active?.status === "locked" && <div className="mx-auto max-w-3xl space-y-5"><div className="rounded-3xl bg-[#101933] p-6 text-white sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-200">Shoot mode</p><h2 className="mt-3 text-3xl font-bold tracking-tight">{active.title}</h2><p className="mt-3 text-slate-300">Shoot one clip per beat, in order. Retake a slip right away.</p></div>
          <div className="flex gap-2" aria-label={`${active.done.filter(Boolean).length} of ${active.beats.length} clips done`}>{active.beats.map((beat, index) => <button key={`${index}-${beat.name}`} type="button" onClick={() => setClipIndex(index)} className={`flex h-10 flex-1 items-center justify-center rounded-xl text-sm font-bold ${index === clipIndex ? "bg-indigo-600 text-white" : active.done[index] ? "bg-emerald-100 text-emerald-800" : "bg-white text-slate-500"}`} aria-label={`Clip ${index + 1}${active.done[index] ? " done" : ""}`}>{active.done[index] ? <Check size={18} /> : index + 1}</button>)}</div>
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9"><p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">Clip {clipIndex + 1} of {active.beats.length}</p><h3 className="mt-3 text-3xl font-bold tracking-tight">{active.beats[clipIndex].name}</h3>
            <p className="mt-7 text-xs font-bold uppercase tracking-wide text-slate-500">Talk about</p><ul className="mt-3 space-y-3">{active.beats[clipIndex].talk.map((point) => <li key={point} className="flex gap-3 text-lg leading-snug"><span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />{point}</li>)}</ul>
            <p className="mt-8 text-xs font-bold uppercase tracking-wide text-slate-500">Show</p><ul className="mt-3 space-y-2">{active.beats[clipIndex].show.map((shot) => <li key={shot} className="text-base text-slate-700">{shot}</li>)}</ul>
            {clipIndex === active.beats.length - 1 && <p className="mt-6 rounded-xl bg-indigo-50 p-4 text-base font-semibold text-indigo-950">Service number: {active.serviceNumber}</p>}
            <button type="button" className={`${primary} mt-9`} disabled={busy} onClick={() => run({ kind: "clip", id: active.id, index: clipIndex, done: !active.done[clipIndex] }, () => { if (!active.done[clipIndex] && clipIndex < active.beats.length - 1) setClipIndex(clipIndex + 1); })}>{active.done[clipIndex] ? "Mark not done" : <><Check size={19} /> Clip done</>}</button>
          </section>
          <div className="flex justify-between gap-3"><button type="button" className={secondary} disabled={clipIndex === 0} onClick={() => setClipIndex(clipIndex - 1)}><ArrowLeft size={17} /> Previous</button><button type="button" className={secondary} disabled={clipIndex === active.beats.length - 1} onClick={() => setClipIndex(clipIndex + 1)}>Next clip <ArrowRight size={17} /></button></div>
          <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6"><p className="font-semibold">After it goes live</p><p className="mt-1 text-sm text-slate-500">Paste the YouTube link to log the episode and carry its hook into next week.</p><div className="mt-4 flex flex-col gap-3 sm:flex-row"><input className={field} type="url" value={publishedUrl} onChange={(event) => setPublishedUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=…" aria-label="Published YouTube link" /><button type="button" className={secondary} disabled={busy || !publishedUrl.trim()} onClick={() => run({ kind: "publish", id: active.id, url: publishedUrl })}>Mark published</button></div></section>
        </div>}
        {error && <p role="alert" className="mx-auto mt-5 max-w-3xl rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">{error}</p>}
      </div>
    </main>
  );
}
