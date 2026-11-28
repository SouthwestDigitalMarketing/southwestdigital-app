"use client";

import { useState, useTransition, type FormEvent } from "react";
import { MOMENTS, SONG_STATUSES, parsePastedSongs, type Moment, type Song } from "@/lib/music/setList";
import { changeSongAction, startSetListAction } from "./actions";

const input = "rounded-md border border-slate-300 px-2 py-1.5 text-sm";

export function SetListClient({ songs }: { songs: Song[] | null }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      const result = await fn();
      setError(result.error ?? null);
    });

  if (!songs) {
    return (
      <div className="p-4 sm:p-8">
        <h1 className="text-2xl font-semibold text-slate-900">Set list</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">Start from the 26 songs drafted for easyweddingband.com/music, all marked Suggested.</p>
        <button type="button" disabled={pending} onClick={() => run(startSetListAction)} className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {pending ? "Starting…" : "Start the set list"}
        </button>
        {error ? <p className="mt-2 text-sm text-red-700" role="alert">{error}</p> : null}
      </div>
    );
  }

  const counts = SONG_STATUSES.map((status) => `${songs.filter((s) => s.status === status).length} ${status.toLowerCase()}`).join(" · ");

  return (
    <div className="p-4 sm:p-8">
      <h1 className="text-2xl font-semibold text-slate-900">Set list</h1>
      <p className="mt-1 text-sm text-slate-600">{counts}</p>
      {error ? <p className="mt-2 text-sm text-red-700" role="alert">{error}</p> : null}
      <PasteList pending={pending} run={run} />
      {MOMENTS.map((moment) => (
        <MomentSection key={moment} moment={moment} songs={songs.filter((s) => s.moment === moment)} pending={pending} run={run} />
      ))}
    </div>
  );
}

function MomentSection({ moment, songs, pending, run }: { moment: Moment; songs: Song[]; pending: boolean; run: (fn: () => Promise<{ error?: string }>) => void }) {
  const add = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    run(async () => {
      const result = await changeSongAction({
        op: "add",
        song: { moment, title: String(data.get("title") ?? ""), artist: String(data.get("artist") ?? ""), suggestedBy: String(data.get("suggestedBy") ?? "") },
      });
      if (!result.error) form.reset();
      return result;
    });
  };
  return (
    <section className="mt-8 max-w-4xl">
      <h2 className="text-lg font-semibold text-slate-900">
        {moment} <span className="text-sm font-normal text-slate-500">({songs.length})</span>
      </h2>
      <ul className="mt-2 divide-y divide-slate-200">
        {songs.map((song) => (
          <li key={song.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
            <span className="min-w-0 flex-1 text-sm">
              <span className="font-medium text-slate-900">{song.title}</span>
              {song.artist ? <span className="text-slate-600"> · {song.artist}</span> : null}
              {song.suggestedBy ? <span className="block text-xs text-slate-500">Suggested by {song.suggestedBy}</span> : null}
            </span>
            <select
              aria-label={`Status for ${song.title}`}
              value={song.status}
              disabled={pending}
              onChange={(e) => run(() => changeSongAction({ op: "update", id: song.id, song: { status: e.target.value } }))}
              className={input}
            >
              {SONG_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <button type="button" disabled={pending} onClick={() => run(() => changeSongAction({ op: "remove", id: song.id }))} className="text-sm text-slate-500 hover:text-red-700">
              Remove
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="mt-2 flex flex-wrap gap-2">
        <input name="title" required placeholder="Song" aria-label={`New song for ${moment}`} className={`${input} w-48`} />
        <input name="artist" placeholder="Artist" aria-label="Artist" className={`${input} w-40`} />
        <input name="suggestedBy" placeholder="Suggested by" aria-label="Suggested by" className={`${input} w-44`} />
        <button type="submit" disabled={pending} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:border-slate-500 disabled:opacity-60">
          Add
        </button>
      </form>
    </section>
  );
}

/** Paste a numbered list (e.g. from ChatGPT); each "Title" – Artist line becomes a Suggested song. */
function PasteList({ pending, run }: { pending: boolean; run: (fn: () => Promise<{ error?: string }>) => void }) {
  const [text, setText] = useState("");
  const [from, setFrom] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const found = parsePastedSongs(text);
  const add = () =>
    run(async () => {
      const result = await changeSongAction({ op: "addMany", songs: found.map((s) => ({ ...s, suggestedBy: from })) });
      if (!result.error) {
        setDone(`Added up to ${found.length} songs (songs already on the list were skipped).`);
        setText("");
      }
      return result;
    });
  return (
    <details className="mt-6 max-w-4xl rounded-lg border border-slate-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-medium text-slate-900">Paste a list</summary>
      <p className="mt-2 text-sm text-slate-600">
        One song per line, like <code>81. &quot;Levels&quot; – Avicii</code>. Start a line with &quot;Ceremony:&quot;, &quot;Dinner:&quot;, &quot;First dance:&quot; or &quot;Last dance:&quot; to file it there; the rest go to Dance floor.
      </p>
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setDone(null); }}
        rows={8}
        aria-label="Pasted song list"
        className="mt-2 w-full rounded-md border border-slate-300 p-2 font-mono text-sm"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Suggested by (e.g. ChatGPT)" aria-label="Suggested by" className={`${input} w-56`} />
        <button type="button" disabled={pending || found.length === 0} onClick={add} className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
          {found.length ? `Add ${found.length} songs` : "Add songs"}
        </button>
        {done ? <span className="text-sm text-slate-600" role="status">{done}</span> : null}
      </div>
    </details>
  );
}
