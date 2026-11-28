export type AudioOption = {
  id: string;
  label: string;
  blurb: string;
  src: string;
};

const TREB_261127 = "mwzglzlj-5643aa";

const TREB_261127_OPTIONS: AudioOption[] = [
  {
    id: "original",
    label: "1 · Your Pixel, untouched",
    blurb: "The WAV off the phone. Quiet on purpose. Almost no noise.",
    src: "/showrunner/audio-ab/1-original.mp3",
  },
  {
    id: "loudnorm",
    label: "2 · Original, YouTube loudness",
    blurb: "Same take, only turned up to −14 LUFS. No Isolator. No EQ.",
    src: "/showrunner/audio-ab/2-original-at-youtube-level.mp3",
  },
  {
    id: "isolator",
    label: "3 · What shipped (Isolator)",
    blurb: "ElevenLabs Voice Isolator. Wrong tool on a clean take — this is the thin metallic one on YouTube now.",
    src: "/showrunner/audio-ab/3-what-shipped.mp3",
  },
  {
    id: "light",
    label: "4 · Light studio chain",
    blurb: "High-pass 80 Hz, gentle compressor, −14 LUFS. Your voice, slightly tighter. No ElevenLabs.",
    src: "/showrunner/audio-ab/4-light-studio-chain.mp3",
  },
  {
    id: "sm7b",
    label: "5 · Studio SM7B (ElevenLabs the right way)",
    blurb: "Speech-to-speech through your SM7B clone. Keeps the take, recasts it on the studio mic. Isolator off.",
    src: "/showrunner/audio-ab/5-studio-sm7b.mp3",
  },
];

/** Twenty-second A/B clips for an episode. Empty when none are ready. */
export function audioOptionsFor(batch: string): AudioOption[] {
  return batch === TREB_261127 ? TREB_261127_OPTIONS : [];
}
