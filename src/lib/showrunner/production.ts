import type { VideoCard } from "@/components/showrunner/VideosInProgress";

/** One row of the production bar: the video, the step it is on, and how far along the whole job is. */
export type ProductionItem = {
  batch: string;
  name: string;
  label: string;
  step: number | null;
  steps: number | null;
  progress: number;
  stopped: boolean;
  /** Full auto off and the prep done: ripley waits for more clips or Finish (Tom, 2026-11-25). */
  waiting: boolean;
  /** Tom already tapped Finish; ripley has not started the build yet. */
  finishing: boolean;
};

/** True while the autopilot is at the gate waiting for more clips or Finish. */
export function isWaitingForYou(steps: { state: string; label: string }[] | null | undefined): boolean {
  return Boolean(steps?.some((step) => step.state === "now" && step.label.startsWith("Waiting for you")));
}

/** Percent from a phone-send stage line ("Sending 1 of 9 — 54%"), else 0. */
export function stageProgress(stage: string | null | undefined): number {
  if (!stage) return 0;
  const match = /(\d{1,3})\s*%\s*$/.exec(stage);
  if (!match) return 0;
  return Math.min(1, Math.max(0, Number(match[1]) / 100));
}

/**
 * A video still being made, reduced to one bar (Tom, 2026-11-25): done steps plus the current step's render share,
 * over all steps. Published videos are not in production.
 */
export function productionItem(video: VideoCard): ProductionItem | null {
  if (video.url) return null;
  const name = video.title ?? video.project ?? "New video";
  const steps = video.steps ?? [];
  if (steps.length === 0) {
    const label = video.stage ?? "On its way to ripley";
    return {
      batch: video.batch,
      name,
      label,
      step: null,
      steps: null,
      progress: stageProgress(label),
      stopped: false,
      waiting: false,
      finishing: Boolean(video.finishRequestedAt),
    };
  }
  const stopped = steps.find((step) => step.state === "stopped");
  const current = stopped ?? steps.find((step) => step.state === "now") ?? steps.find((step) => step.state === "todo") ?? steps[steps.length - 1];
  const done = steps.filter((step) => step.state === "done").length;
  const share = current.state === "now" ? Math.min(1, Math.max(0, video.render?.total ?? 0)) : 0;
  const finishing = Boolean(video.finishRequestedAt);
  const waiting = !stopped && !finishing && current.state === "now" && current.label.startsWith("Waiting for you");
  return {
    batch: video.batch,
    name,
    label: finishing ? "Starting the build" : current.label,
    step: steps.indexOf(current) + 1,
    steps: steps.length,
    progress: Math.min(1, (done + share) / steps.length),
    stopped: Boolean(stopped),
    waiting,
    finishing,
  };
}
