import { describe, expect, it } from "vitest";
import {
  buildStorylines,
  parseMilestoneOverrides,
  resolveMilestones,
  type WeekSignals,
} from "./storylines";

const empty: WeekSignals = {
  proposalsSent: 0,
  proposalsViewed: 0,
  proposalsAccepted: 0,
  newClients: 0,
  repliesAnswered: 0,
  replyMedianBusinessSeconds: null,
  reportsOut: 0,
  transactionsTouched: 0,
  videosLive: 0,
  latestRevenueUsd: null,
  previousRevenueUsd: null,
  revenueMonthLabel: null,
};

function serialized(line: { headline: string; metrics: string[]; hook: string; confirm: string }) {
  return `${line.headline}\n${line.metrics.join("\n")}\n${line.hook}\n${line.confirm}`;
}

describe("buildStorylines", () => {
  it("spots a viewed proposal still waiting on an answer", () => {
    const lines = buildStorylines({ ...empty, proposalsSent: 2, proposalsViewed: 1 }, "");
    expect(lines[0].kind).toBe("proposal-waiting");
    expect(lines[0].headline).toMatch(/sign/i);
    expect(lines[0].metrics.join(" ")).toMatch(/2 proposals sent/);
    expect(lines[0].metrics.join(" ")).toMatch(/1 proposal viewed/);
  });

  it("celebrates a signed proposal and a new client without naming anyone", () => {
    const lines = buildStorylines({ ...empty, proposalsAccepted: 1, newClients: 1 }, "");
    const won = lines.find((line) => line.kind === "client-won");
    expect(won).toBeDefined();
    expect(serialized(won!)).not.toMatch(/LLC|Inc\.|Rodan|Derek/i);
  });

  it("turns fast replies into a scoreboard story", () => {
    const lines = buildStorylines(
      { ...empty, repliesAnswered: 12, replyMedianBusinessSeconds: 5400 },
      "",
    );
    const phones = lines.find((line) => line.kind === "fast-replies");
    expect(phones).toBeDefined();
    expect(phones!.metrics.join(" ")).toMatch(/12 messages answered/);
    expect(phones!.serviceLine).toMatch(/1\.5 h/);
  });

  it("always offers two or three storylines, even with a quiet week", () => {
    const lines = buildStorylines(empty, "Can we onboard three sets of books at once?");
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines.length).toBeLessThanOrEqual(3);
    expect(lines.some((line) => line.kind === "climb")).toBe(true);
  });

  it("never prints client prices or firm revenue next to a client story", () => {
    const signals: WeekSignals = {
      ...empty,
      proposalsSent: 3,
      proposalsViewed: 2,
      proposalsAccepted: 1,
      newClients: 2,
      repliesAnswered: 20,
      replyMedianBusinessSeconds: 3600,
      reportsOut: 5,
      transactionsTouched: 400,
      videosLive: 1,
      latestRevenueUsd: 8200,
      previousRevenueUsd: 7900,
      revenueMonthLabel: "Nov 2026",
    };
    for (const line of buildStorylines(signals, "")) {
      const text = serialized(line);
      expect(text).not.toMatch(/\$\s*(?!10K\b)\d/);
      expect(text).not.toMatch(/llc|inc\.|corp\b/i);
      expect(text).not.toMatch(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
    }
  });

  it("flags the national side when an episode ships", () => {
    const lines = buildStorylines({ ...empty, videosLive: 1 }, "");
    const shipped = lines.find((line) => line.kind === "national-shipped");
    expect(shipped).toBeDefined();
    expect(shipped!.metrics.join(" ")).toMatch(/1 episode went live/);
  });

  it("merges spotted milestones with manual ticks, manual wins", () => {
    const auto = new Map([["youtube-client", { done: true, at: "2026-11-20T00:00:00.000Z" }]]);
    const resolved = resolveMilestones(auto, { "outside-texas": { done: true, at: null } });
    expect(resolved).toHaveLength(3);
    expect(resolved.find((milestone) => milestone.key === "youtube-client")).toMatchObject({ done: true, source: "auto" });
    expect(resolved.find((milestone) => milestone.key === "outside-texas")).toMatchObject({ done: true, source: "manual" });
    expect(resolved.find((milestone) => milestone.key === "toll-free")).toMatchObject({ done: false });
    const overridden = resolveMilestones(auto, { "youtube-client": { done: false } });
    expect(overridden.find((milestone) => milestone.key === "youtube-client")).toMatchObject({ done: false, source: "manual" });
    expect(parseMilestoneOverrides(undefined)).toEqual({});
    expect(() => parseMilestoneOverrides({ "x": { done: "yes" } })).toThrow();
  });

  it("carries the mountain position and trend into the climb fallback", () => {
    const lines = buildStorylines(
      { ...empty, latestRevenueUsd: 8200, previousRevenueUsd: 7900, revenueMonthLabel: "Nov 2026" },
      "",
    );
    const climb = lines.find((line) => line.kind === "climb");
    expect(climb).toBeDefined();
    expect(climb!.metrics.join(" ")).toMatch(/82%/);
    expect(climb!.metrics.join(" ")).toMatch(/up from/);
  });
});
