import { describe, expect, it } from "vitest";
import { makeDraft, makePilotDraft, mountainPosition, parseEpisodes, validateForLock } from "./studio";

const answers = {
  happened: "A landlord had late books. Client name: Jane Doe.",
  handled: "We made a clear list of missing records and followed up.",
  outcome: "The owner sent the records. The month is not closed yet.",
  service: "Our firm-wide reply time was 2 hours.",
  next: "Will the month close on time?",
};

describe("weekly episode path", () => {
  it("carries the published hook into a five-clip draft without echoing private answers", () => {
    const episode = makeDraft(answers, "Can we get the missing records?");
    expect(episode.carriedHook).toBe("Can we get the missing records?");
    expect(episode.question).toBe(episode.carriedHook);
    expect(episode.beats).toHaveLength(5);
    expect(episode.beats.every((beat) => beat.talk.length >= 2 && beat.talk.length <= 4 && beat.show.length > 0)).toBe(true);
    expect(JSON.stringify(episode.beats)).not.toContain("Jane Doe");
    expect(validateForLock(episode, episode.carriedHook).id).toBe(episode.id);
  });

  it("refuses a stale hook or client payment in edited beats", () => {
    const episode = makeDraft(answers, "Earlier hook");
    expect(() => validateForLock(episode, "A newer hook")).toThrow(/hook changed/);
    episode.beats[1].talk[0] = "Client paid: $450 per month";
    expect(() => validateForLock(episode, "Earlier hook")).toThrow(/client names and what a client pays/);
  });

  it("refuses a client name, email, and a missing carry-over hook", () => {
    const episode = makeDraft(answers, "Earlier hook");
    episode.title = "How We Helped";
    expect(validateForLock(episode, "Earlier hook").title).toBe("How We Helped");
    episode.question = "What happened this week?";
    expect(() => validateForLock(episode, "Earlier hook")).toThrow(/Put last week's hook/);
    episode.question = "Earlier hook";
    episode.beats[0].talk[0] = "Jane Doe sent her records";
    expect(() => validateForLock(episode, "Earlier hook")).toThrow(/Remove names/);
    episode.beats[0].talk[0] = "Email jane@example.com for the records";
    expect(() => validateForLock(episode, "Earlier hook")).toThrow(/Remove names/);
  });

  it("refuses a bare client fee", () => {
    const episode = makeDraft(answers, "");
    episode.beats[1].talk[0] = "The client pays $450";
    expect(() => validateForLock(episode, "")).toThrow(/client names and what a client pays/);
  });

  it("keeps Base Camp until Tom supplies the number", () => {
    expect(mountainPosition(null)).toEqual({ name: "Base Camp", percent: 0 });
    expect(mountainPosition(5100)).toEqual({ name: "Halfway Ridge", percent: 51 });
  });

  it("seeds the sanitized contract pilot from the series canon", () => {
    const episode = makePilotDraft("");
    expect(episode.title).toBe("Will They Sign? How We Do Contracts");
    expect(episode.beats).toHaveLength(5);
    expect(JSON.stringify(episode.beats)).not.toContain("$450");
    expect(() => validateForLock(episode, "")).toThrow(/service number/);
    episode.serviceNumber = "Our firm-wide reply time was 2 hours.";
    expect(validateForLock(episode, "").id).toBe(episode.id);
  });

  it("keeps saved drafts from before the service-number field", () => {
    const old = makeDraft(answers, "") as Record<string, unknown>;
    delete old.serviceNumber;
    expect(parseEpisodes([old])[0].serviceNumber).toMatch(/Tom to supply/);
    expect(parseEpisodes([old])).toHaveLength(1);
  });
});
