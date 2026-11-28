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
    <div className="mt-4">
      <p className="text-sm font-semibold text-slate-900">Hear the voice</p>
      <p className="mt-1 text-sm text-slate-700">
        Same 20 seconds. 5 is the SM7B take you liked. 6 adds chest bass. 7 is the punchier Stern-desk EQ. Earlier options 1–4 are still below.
      </p>
      <ul className="mt-3 space-y-3">
        {options.map((option, index) => (
          <li key={option.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
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
    </div>
  );
}
