export type AudioOption = {
  id: string;
  label: string;
  blurb: string;
  src: string;
};

const TREB_261127 = "mwzglzlj-5643aa";

const TREB_261127_OPTIONS: AudioOption[] = [
  {
    id: "sm7b-stern",
    label: "7 · SM7B + Stern punch (your pick)",
    blurb: "Best of the last round. The extra bass was still too small, especially on a phone.",
    src: "/showrunner/audio-ab/7-sm7b-stern.mp3",
  },
  {
    id: "sm7b-phone",
    label: "8 · Phone punch",
    blurb: "Big boost around 180–250 Hz (the bass a phone speaker can actually play) plus harmonic sub. About +3.5 dB of chest vs 7.",
    src: "/showrunner/audio-ab/8-phone-body.mp3",
  },
  {
    id: "sm7b-graft",
    label: "9 · Pixel chest under SM7B",
    blurb: "Your phone's real low end mixed under the SM7B mids. Different shape, not just louder EQ.",
    src: "/showrunner/audio-ab/9-bass-graft.mp3",
  },
  {
    id: "sm7b-wall",
    label: "10 · Radio wall (too much on purpose)",
    blurb: "Huge 170–240 Hz, heavy smash. If this is too much, say so — then we sit between 8 and 10.",
    src: "/showrunner/audio-ab/10-radio-wall.mp3",
  },
  {
    id: "sm7b",
    label: "5 · Studio SM7B (no extra EQ)",
    blurb: "The take you liked. Speech-to-speech through the SM7B clone, Isolator off.",
    src: "/showrunner/audio-ab/5-studio-sm7b.mp3",
  },
  {
    id: "sm7b-chest",
    label: "6 · SM7B + chest bass",
    blurb: "+5 dB at 110 Hz, +2.5 dB at 200 Hz, a little 400 Hz cut. More body, still your voice.",
    src: "/showrunner/audio-ab/6-sm7b-chest.mp3",
  },
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
];

/** Twenty-second A/B clips for an episode. Empty when none are ready. */
export function audioOptionsFor(batch: string): AudioOption[] {
  return batch === TREB_261127 ? TREB_261127_OPTIONS : [];
}
