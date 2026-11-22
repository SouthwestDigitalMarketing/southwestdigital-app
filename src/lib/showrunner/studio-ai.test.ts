import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { draftWithAI, hasPrivacyLeak, regenerateBeat } from "./studio-ai";
import type { Answers } from "./studio";

const answers: Answers = {
  happened: "A landlord had missing records for three properties.",
  handled: "We gathered statements and reconciled the books.",
  outcome: "The monthly report was delivered.",
  service: "Firm-wide reply time was 2 hours.",
  next: "Will onboarding be smoother next week?",
};

const outline = {
  title: "A landlord's missing records",
  question: "Can we make the books usable again?",
  payoff: "The monthly report was delivered.",
  hook: "Will onboarding be smoother next week?",
  beats: [
    { name: "The question", talk: ["Pick up last week's hook", "Explain the missing records"], show: ["Tom to camera"] },
    { name: "The work", talk: ["Gather statements", "Reconcile the books"], show: ["Safe example screen"] },
    { name: "The result", talk: ["The report was delivered", "What changed for the client"], show: ["Tom to camera"] },
    { name: "Scoreboard", talk: ["Show the mountain", "Firm-wide reply time was 2 hours"], show: ["Mountain graphic"] },
    { name: "Next week", talk: ["Ask about onboarding", "Leave the outcome open"], show: ["Tom to camera"] },
  ],
};

function apiResult(value: unknown) {
  return { ok: true, json: async () => ({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify(value) }] }] }) } as Response;
}

describe("draftWithAI", () => {
  beforeEach(() => { process.env.OPENAI_API_KEY = "test-only"; });
  afterEach(() => { delete process.env.OPENAI_API_KEY; vi.unstubAllGlobals(); });

  it("turns the interview into a validated storyboard and carries last week's hook", async () => {
    const fetchMock = vi.fn().mockResolvedValue(apiResult(outline));
    vi.stubGlobal("fetch", fetchMock);
    const result = await draftWithAI(answers, "Can the firm handle three sets of books?");
    expect(result.source).toBe("openai");
    expect(result.episode.carriedHook).toBe("Can the firm handle three sets of books?");
    expect(result.episode.beats[0].talk[0]).toBe("Can the firm handle three sets of books?");
    expect(result.episode.beats).toHaveLength(5);
    expect(result.episode.beats.every((beat) => beat.talk.length >= 2 && beat.talk.length <= 4)).toBe(true);
    expect(result.episode.done).toEqual([false, false, false, false, false]);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.store).toBe(false);
    expect(body.text.format.type).toBe("json_schema");
  });

  it("does not put an echoed client name on the storyboard", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(apiResult({ ...outline, title: "Derek Potts's missing records" })));
    const result = await draftWithAI({ ...answers, happened: "Derek Potts had missing records." }, "");
    expect(result.source).toBe("guided");
    expect(JSON.stringify(result.episode.beats)).not.toContain("Derek Potts");
    expect(result.warning).toMatch(/private detail/);
  });

  it("catches a lowercase dictated client name before showing the draft", () => {
    expect(hasPrivacyLeak({ ...outline, title: "derek called about records" }, { ...answers, happened: "the client derek called" })).toBe(true);
  });

  it("rejects a company name from the answers even in lowercase", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(apiResult({ ...outline, payoff: "SJ Equity LLC got its report." })));
    const result = await draftWithAI({ ...answers, happened: "sj equity llc had missing records." }, "");
    expect(result.source).toBe("guided");
    expect(JSON.stringify(result.episode.beats)).not.toContain("SJ Equity LLC");
  });

  it("rejects a single client first name when identified in the answer", () => {
    expect(hasPrivacyLeak({ ...outline, title: "Derek's missing records" }, { ...answers, happened: "The client Derek had missing records." })).toBe(true);
  });

  it("rejects client payment amounts", () => {
    expect(hasPrivacyLeak({ ...outline, payoff: "Client pays $450 per month" }, answers)).toBe(true);
  });

  it("rejects email addresses and phone numbers", () => {
    expect(hasPrivacyLeak({ ...outline, payoff: "Write to jane@example.com" }, answers)).toBe(true);
    expect(hasPrivacyLeak({ ...outline, payoff: "Call 281-555-0123" }, answers)).toBe(true);
  });

  it("falls back visibly when no key is configured", async () => {
    delete process.env.OPENAI_API_KEY;
    const result = await draftWithAI(answers, "Will they sign?");
    expect(result.source).toBe("guided");
    expect(result.warning).toMatch(/not configured/);
    expect(result.episode.carriedHook).toBe("Will they sign?");
  });

  it("rejects an outline outside the 4–6 beat limit", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(apiResult({ ...outline, beats: outline.beats.slice(0, 3) })));
    const result = await draftWithAI(answers, "");
    expect(result.source).toBe("guided");
    expect(result.episode.beats).toHaveLength(5);
  });

  it("regenerates one beat with validation and carries the previous hook", async () => {
    const fetchMock = vi.fn().mockResolvedValue(apiResult({ name: "Another way in", talk: ["Set the scene", "Why it matters"], show: ["Tom to camera"] }));
    vi.stubGlobal("fetch", fetchMock);
    const drafted = await draftWithAI(answers, "Will they sign?");
    const result = await regenerateBeat(drafted.episode, 0);
    expect(result.source).toBe("openai");
    expect(result.beat.talk[0]).toBe("Will they sign?");
    expect(result.beat.show).toEqual(["Tom to camera"]);
  });

  it("rejects a private name in a regenerated beat", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(apiResult({ name: "Derek Potts", talk: ["Set the scene", "Why it matters"], show: ["Tom to camera"] })));
    const episode = (await draftWithAI({ ...answers, happened: "Derek Potts had missing records." }, "")).episode;
    const result = await regenerateBeat(episode, 1);
    expect(result.source).toBe("guided");
    expect(JSON.stringify(result.beat)).not.toContain("Derek Potts");
  });
});
