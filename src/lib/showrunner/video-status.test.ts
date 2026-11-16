import { describe, expect, it } from "vitest";
import { checkStatusToken, parseVideoStatus } from "./video-status";

const steps = [
  { label: "Sorting the clips: talking and b-roll", state: "done" },
  { label: "Rendering the finished video", state: "now" },
  { label: "Uploading to YouTube", state: "todo" },
];

describe("parseVideoStatus", () => {
  it("keeps a queue.json row with steps, render bars and its sent time", () => {
    const row = parseVideoStatus({
      batch: "mwjmg87n-a9a9fc", project: "TREB 261116 New Video", state: "episode", stage: "Rendering",
      steps, render: { total: 0.47, piece: 14, pieces: 28, pieceShare: 0.5, minutesLeft: 17 }, url: "", created: 1794850000,
    });
    expect(row?.batch).toBe("mwjmg87n-a9a9fc");
    expect(row?.steps?.map((s) => s.state)).toEqual(["done", "now", "todo"]);
    expect(row?.render).toEqual({ total: 0.47, piece: 14, pieces: 28, pieceShare: 0.5, minutesLeft: 17 });
    expect(row?.url).toBeNull();
    expect(row?.sentAt?.getTime()).toBe(1794850000 * 1000);
  });

  it("keeps the YouTube link and a stopped step's reason", () => {
    const row = parseVideoStatus({
      batch: "b1", state: "episode", url: "https://www.youtube.com/watch?v=g-S6zVZycr4",
      steps: [{ label: "Uploading to YouTube", state: "stopped", message: "YouTube refused the saved sign-in" }],
    });
    expect(row?.url).toBe("https://www.youtube.com/watch?v=g-S6zVZycr4");
    expect(row?.steps?.[0]).toEqual({ label: "Uploading to YouTube", state: "stopped", message: "YouTube refused the saved sign-in" });
  });

  it("uses an error row's message as its stage and drops bad parts", () => {
    const row = parseVideoStatus({ batch: "b2", state: "error", message: "The video drive is not writable", url: "http://x", render: { piece: 2 }, steps: [{ label: "x", state: "weird" }] });
    expect(row?.stage).toBe("The video drive is not writable");
    expect(row?.url).toBeNull();
    expect(row?.render).toBeNull();
    expect(row?.steps).toBeNull();
  });

  it("refuses rows without a valid batch or state", () => {
    expect(parseVideoStatus({ batch: "../etc", state: "episode" })).toBeNull();
    expect(parseVideoStatus({ batch: "b3" })).toBeNull();
    expect(parseVideoStatus(null)).toBeNull();
  });
});

describe("checkStatusToken", () => {
  const env = { SHOWRUNNER_STATUS_TOKEN: "x".repeat(40), SHOWRUNNER_STATUS_ACTOR_USER_ID: "user-1" };
  it("accepts the right token and names the actor", () => {
    expect(checkStatusToken(`Bearer ${"x".repeat(40)}`, env)).toEqual({ ok: true, actorUserId: "user-1" });
  });
  it("rejects a wrong or missing token", () => {
    expect(checkStatusToken("Bearer nope", env)).toEqual({ ok: false, status: 401 });
    expect(checkStatusToken(null, env)).toEqual({ ok: false, status: 401 });
  });
  it("says not configured without a long token, and names ripley when no actor is set", () => {
    expect(checkStatusToken("Bearer x", { SHOWRUNNER_STATUS_TOKEN: "short" })).toEqual({ ok: false, status: 503 });
    expect(checkStatusToken(`Bearer ${"x".repeat(40)}`, { SHOWRUNNER_STATUS_TOKEN: "x".repeat(40) })).toEqual({ ok: true, actorUserId: "showrunner-ripley" });
  });
});
