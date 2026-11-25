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
};

/**
 * A video still being made, reduced to one bar (Tom, 2026-11-25): done steps plus the current step's render share,
 * over all steps. Published videos are not in production.
 */
export function productionItem(video: VideoCard): ProductionItem | null {
  if (video.url) return null;
  const name = video.title ?? video.project ?? "New video";
  const steps = video.steps ?? [];
  if (steps.length === 0) {
    return { batch: video.batch, name, label: video.stage ?? "On its way to ripley", step: null, steps: null, progress: 0, stopped: false };
  }
  const stopped = steps.find((step) => step.state === "stopped");
  const current = stopped ?? steps.find((step) => step.state === "now") ?? steps.find((step) => step.state === "todo") ?? steps[steps.length - 1];
  const done = steps.filter((step) => step.state === "done").length;
  const share = current.state === "now" ? Math.min(1, Math.max(0, video.render?.total ?? 0)) : 0;
  return {
    batch: video.batch,
    name,
    label: current.label,
    step: steps.indexOf(current) + 1,
    steps: steps.length,
    progress: Math.min(1, (done + share) / steps.length),
    stopped: Boolean(stopped),
  };
}
