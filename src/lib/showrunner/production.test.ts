import { describe, expect, it } from "vitest";
import type { VideoCard } from "@/components/showrunner/VideosInProgress";
import { productionItem, stageProgress } from "./production";

const base: VideoCard = { batch: "b1", project: "TREB 261125 New Video", state: "episode", stage: null, steps: null, render: null, url: null, title: null, thumbnail: null, details: null };

describe("productionItem", () => {
  it("leaves published videos out", () => {
    expect(productionItem({ ...base, url: "https://youtu.be/x" })).toBeNull();
  });

  it("counts done steps plus the current step's render share", () => {
    const item = productionItem({
      ...base,
      steps: [
        { label: "Cut", state: "done" },
        { label: "Rendering", state: "now" },
        { label: "Uploading", state: "todo" },
        { label: "Checking", state: "todo" },
      ],
      render: { total: 0.5 },
    });
    expect(item).toMatchObject({ label: "Rendering", step: 2, steps: 4, progress: 0.375, stopped: false, name: "TREB 261125 New Video" });
  });

  it("shows a stopped step first", () => {
    const item = productionItem({ ...base, steps: [{ label: "Cut", state: "done" }, { label: "Upload", state: "stopped", message: "quota" }] });
    expect(item).toMatchObject({ label: "Upload", step: 2, stopped: true, progress: 0.5 });
  });

  it("marks a video waiting for Tom's go-ahead", () => {
    const item = productionItem({
      ...base,
      steps: [{ label: "Making the cut", state: "done" }, { label: "Waiting for you: add clips or finish", state: "now" }, { label: "Rendering", state: "todo" }],
    });
    expect(item).toMatchObject({ waiting: true, finishing: false, stopped: false, step: 2 });
  });

  it("shows starting the build after Finish", () => {
    const item = productionItem({
      ...base,
      finishRequestedAt: new Date("2026-11-27T21:00:00Z"),
      steps: [{ label: "Making the cut", state: "done" }, { label: "Waiting for you: add clips or finish", state: "now" }, { label: "Rendering", state: "todo" }],
    });
    expect(item).toMatchObject({ waiting: false, finishing: true, label: "Starting the build" });
  });

  it("uses the stage line before ripley sends steps", () => {
    expect(productionItem({ ...base, stage: "Sending 1 of 1 — 40%" })).toMatchObject({
      label: "Sending 1 of 1 — 40%",
      step: null,
      progress: 0.4,
    });
  });
});

describe("stageProgress", () => {
  it("reads the percent at the end of a sending line", () => {
    expect(stageProgress("Sending 1 of 9 — 54%")).toBe(0.54);
    expect(stageProgress("Paused 2 of 8 — 0%")).toBe(0);
    expect(stageProgress("On its way to ripley")).toBe(0);
    expect(stageProgress(null)).toBe(0);
  });
});
