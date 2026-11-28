import { describe, expect, it } from "vitest";
import {
  collectPromiseFieldsFromAssessment,
  hashPromiseText,
  PromiseBlockedError,
  promiseBlockMessage,
  readPromiseConfirmations,
  scanPromiseRisks,
  unresolvedPromiseHits,
  unresolvedSnapshotPromiseHits,
  validatePromiseConfirmations,
} from "./promiseCheck";

describe("collectPromiseFieldsFromAssessment", () => {
  it("collects intro, bonus, option, and note text with named places", () => {
    const fields = collectPromiseFieldsFromAssessment({
      introHeadline: "Clean books, guaranteed.",
      introBody: "Plain body.",
      bonuses: [
        { id: "b1", name: "Bonus One", description: "Same-day turnaround.", defaultPackageIds: ["grow"] },
        { id: "b2", name: "Archived", description: "24/7 help.", archived: true, defaultPackageIds: ["grow"] },
        { id: "b3", name: "NoDesc", defaultPackageIds: ["grow"] },
      ],
      additionalOptions: [
        { id: "o1", name: "Extra Reports", description: "Unlimited revisions." },
      ],
      discretionaryMultiplierNote: "CPA review included.",
      assessmentNotes: "Client audit next month.",
    });
    expect(fields.map((field) => field.where)).toEqual([
      "Intro headline",
      "Intro body",
      "Bonus: Bonus One",
      "Additional option: Extra Reports",
      "Custom note",
      "Assessment notes",
    ]);
  });

  it("returns no fields for an empty or missing assessment", () => {
    expect(collectPromiseFieldsFromAssessment(null)).toEqual([]);
    expect(collectPromiseFieldsFromAssessment({})).toEqual([]);
    expect(collectPromiseFieldsFromAssessment({ introHeadline: "", bonuses: "junk" })).toEqual([]);
  });
});

describe("readPromiseConfirmations", () => {
  it("keeps well-formed confirmations and drops junk", () => {
    const good = { where: "Intro body", phrase: "guarantee", textHash: "abc12345", confirmedAt: "2026-11-27T00:00:00Z" };
    const withBy = { ...good, confirmedBy: "staff@x.test" };
    expect(readPromiseConfirmations({ promiseConfirmations: [good, withBy] })).toEqual([good, withBy]);
    expect(readPromiseConfirmations({ promiseConfirmations: [{ where: "x" }, null, "s"] })).toEqual([]);
    expect(readPromiseConfirmations({})).toEqual([]);
    expect(readPromiseConfirmations(null)).toEqual([]);
  });

  it("validates a bare confirmations value", () => {
    const good = { where: "w", phrase: "p", textHash: "h", confirmedAt: "t" };
    expect(validatePromiseConfirmations([good, 42])).toEqual([good]);
    expect(validatePromiseConfirmations(undefined)).toEqual([]);
  });
});

describe("unresolvedSnapshotPromiseHits", () => {
  const snapshot = {
    promiseConfirmations: [] as Array<{ where: string; phrase: string; textHash: string; confirmedAt: string }>,
    assessment: { introBody: "We guarantee same-day results." },
  };

  it("flags assessment hits with no confirmations", () => {
    const unresolved = unresolvedSnapshotPromiseHits(snapshot);
    expect(unresolved.map((hit) => hit.phrase).sort()).toEqual(["guarantee", "same day"]);
  });

  it("clears when every hit is confirmed, and resurfaces when the text is edited", () => {
    const hits = scanPromiseRisks(collectPromiseFieldsFromAssessment(snapshot.assessment));
    const confirmed = hits.map((hit) => ({
      where: hit.where, phrase: hit.phrase, textHash: hit.textHash, confirmedAt: "2026-11-27T00:00:00Z",
    }));
    expect(unresolvedSnapshotPromiseHits({ ...snapshot, promiseConfirmations: confirmed })).toEqual([]);
    const edited = { ...snapshot, promiseConfirmations: confirmed, assessment: { introBody: "We guarantee same-day results, truly." } };
    expect(unresolvedSnapshotPromiseHits(edited)).toHaveLength(2);
  });

  it("scans caller-supplied cover-letter fields against the same confirmations", () => {
    const cover = [{ where: "Cover email", text: "Call us 24/7 for help." }];
    const unresolved = unresolvedSnapshotPromiseHits({ assessment: {} }, cover);
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0].where).toBe("Cover email");
    const confirmed = [{
      where: "Cover email",
      phrase: unresolved[0].phrase,
      textHash: hashPromiseText(cover[0].text),
      confirmedAt: "2026-11-27T00:00:00Z",
    }];
    expect(unresolvedSnapshotPromiseHits({ assessment: {}, promiseConfirmations: confirmed }, cover)).toEqual([]);
  });

  it("ignores unresolved hits in junk snapshots", () => {
    expect(unresolvedSnapshotPromiseHits(null)).toEqual([]);
    expect(unresolvedSnapshotPromiseHits({ assessment: null })).toEqual([]);
  });
});

describe("promiseBlockMessage", () => {
  it("names each flagged place and the finalize step", () => {
    const hits = scanPromiseRisks([
      { where: "Intro body", text: "guaranteed results" },
      { where: "Cover email", text: "call us 24/7" },
    ]);
    const message = promiseBlockMessage(unresolvedPromiseHits(hits, []));
    expect(message).toContain("Intro body");
    expect(message).toContain("Cover email");
    expect(message).toContain("finalize");
  });
});

describe("PromiseBlockedError", () => {
  it("is an Error so routes can map it to a 409", () => {
    expect(new PromiseBlockedError("blocked")).toBeInstanceOf(Error);
  });
});
