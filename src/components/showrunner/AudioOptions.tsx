"use client";

import { useRef } from "react";
import { audioOptionsFor } from "@/lib/showrunner/audio-options";

/** Same 20 seconds, each treatment, playable on the episode page. */
export function AudioOptions({ batch }: { batch: string }) {
  const options = audioOptionsFor(batch);
  const players = useRef<HTMLAudioElement[]>([]);
  if (options.length === 0) return null;

  function playOnly(index: number) {
    players.current.forEach((player, i) => {
      if (i !== index) player?.pause();
    });
  }

  return (
    <details
      className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3"
      onToggle={(event) => {
        if (!(event.currentTarget as HTMLDetailsElement).open) {
          players.current.forEach((player) => player?.pause());
        }
      }}
    >
      <summary className="cursor-pointer text-sm font-semibold text-slate-900">
        Hear the voice · {options.length} tests
      </summary>
      <p className="mt-2 text-sm text-slate-700">
        7 was the best of the last round, but the bass move was too small. 8–10 are big on purpose — especially on a phone. Play 7 then 8 then 10.
      </p>
      <ul className="mt-3 space-y-3">
        {options.map((option, index) => (
          <li key={option.id} className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-sm font-semibold text-slate-900">{option.label}</p>
            <p className="mt-0.5 text-sm text-slate-600">{option.blurb}</p>
            <audio
              className="mt-2 w-full"
              controls
              preload="metadata"
              src={option.src}
              ref={(node) => {
                if (node) players.current[index] = node;
              }}
              onPlay={() => playOnly(index)}
            />
          </li>
        ))}
      </ul>
    </details>
  );
}
