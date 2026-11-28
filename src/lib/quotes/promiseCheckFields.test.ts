import { describe, expect, it } from "vitest";
import {
  collectPromiseFieldsFromAssessment,
  hashPromiseText,
  PromiseBlockedError,
  promiseBlockMessage,
  publishedOrDraftSnapshot,
  readPromiseConfirmations,
  readRenderedOptionCopy,
  renderedOptionCopyForAssessment,
  scanPromiseRisks,
  unresolvedPromiseHits,
  unresolvedSnapshotPromiseHits,
  validatePromiseConfirmations,
} from "./promiseCheck";

describe("collectPromiseFieldsFromAssessment", () => {
  it("collects intro, bonus, and option text with named places", () => {
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
    });
    expect(fields.map((field) => field.where)).toEqual([
      "Intro headline",
      "Intro body",
      "Bonus name: b1",
      "Bonus: Bonus One",
      "Bonus name: b3",
      "Additional option name: o1",
      "Additional option: Extra Reports",
    ]);
  });

  it("scans package names and the credit reason with stable places", () => {
    const fields = collectPromiseFieldsFromAssessment({
      packageNames: { grow: "24/7 Advisory", improve: "Momentum", maintain: "Essentials" },
      firstPaymentCreditReason: "CPA work already paid.",
    });
    expect(fields).toEqual([
      { where: "Package name: grow", text: "24/7 Advisory" },
      { where: "Package name: improve", text: "Momentum" },
      { where: "Package name: maintain", text: "Essentials" },
      { where: "First payment credit reason", text: "CPA work already paid." },
    ]);
    const hits = scanPromiseRisks(fields);
    expect(hits.map((hit) => [hit.where, hit.phrase])).toEqual([
      ["Package name: grow", "24/7"],
      ["First payment credit reason", "CPA"],
    ]);
  });

  it("keys bonus/option names by stable id so confirmations survive renames and reorders", () => {
    const assessment = {
      bonuses: [
        { id: "b2", name: "Second", description: "Plain." },
        { id: "b1", name: "Guaranteed fast books", description: "Plain." },
      ],
      additionalOptions: [
        { id: "o1", name: "Unlimited check-ins", description: "Plain." },
      ],
    };
    const hits = scanPromiseRisks(collectPromiseFieldsFromAssessment(assessment));
    expect(hits.map((hit) => [hit.where, hit.phrase])).toEqual([
      ["Bonus name: b1", "guarantee"],
      ["Additional option name: o1", "unlimited"],
    ]);
    const confirmed = hits.map((hit) => ({
      where: hit.where, phrase: hit.phrase, textHash: hit.textHash, confirmedAt: "2026-11-27T00:00:00Z",
    }));
    // Renaming the bonus and reordering the list keeps the same stable
    // places and text, so the earlier confirmation still counts.
    const renamed = {
      bonuses: [
        { id: "b1", name: "Fast books, new name, guaranteed", description: "Plain." },
        { id: "b2", name: "Second", description: "Plain." },
      ],
      additionalOptions: [
        { id: "o1", name: "Unlimited check-ins", description: "Plain." },
      ],
    };
    const renamedHits = scanPromiseRisks(collectPromiseFieldsFromAssessment(renamed));
    expect(renamedHits.map((hit) => [hit.where, hit.phrase])).toEqual([
      ["Bonus name: b1", "guarantee"],
      ["Additional option name: o1", "unlimited"],
    ]);
    expect(renamedHits[0].textHash).not.toBe(hits[0].textHash);
    const reorderOnly = {
      bonuses: [...assessment.bonuses].reverse(),
      additionalOptions: assessment.additionalOptions,
    };
    expect(unresolvedPromiseHits(
      scanPromiseRisks(collectPromiseFieldsFromAssessment(reorderOnly)),
      confirmed,
    )).toEqual([]);
  });

  it("skips archived and id-less bonus/option names", () => {
    const fields = collectPromiseFieldsFromAssessment({
      bonuses: [
        { id: "b1", name: "24/7 help", description: "Plain.", archived: true },
        { name: "Guaranteed nameless", description: "Plain." },
      ],
      additionalOptions: [
        { id: "o1", name: "Same-day rush", archived: true, description: "Plain." },
      ],
    });
    expect(fields.map((field) => field.where)).toEqual(["Bonus: Guaranteed nameless"]);
  });

  it("never scans the internal-only notes", () => {
    const fields = collectPromiseFieldsFromAssessment({
      introBody: "Plain body.",
      discretionaryMultiplierNote: "CPA review included, guaranteed.",
      assessmentNotes: "Client audit next month, 24/7 help.",
    });
    expect(fields).toEqual([{ where: "Intro body", text: "Plain body." }]);
  });

  it("returns no fields for an empty or missing assessment", () => {
    expect(collectPromiseFieldsFromAssessment(null)).toEqual([]);
    expect(collectPromiseFieldsFromAssessment({})).toEqual([]);
    expect(collectPromiseFieldsFromAssessment({ introHeadline: "", bonuses: "junk" })).toEqual([]);
  });

  it("scans frozen option copy when provided", () => {
    const assessment = {
      bonuses: [{ id: "b1", name: "Bonus One", description: "Clean stored text." }],
    };
    expect(collectPromiseFieldsFromAssessment(assessment)).toEqual([
      { where: "Bonus name: b1", text: "Bonus One" },
      { where: "Bonus: Bonus One", text: "Clean stored text." },
    ]);
    expect(
      collectPromiseFieldsFromAssessment(assessment, { b1: "Frozen text, guaranteed." }),
    ).toEqual([
      { where: "Bonus name: b1", text: "Bonus One" },
      { where: "Bonus: Bonus One", text: "Frozen text, guaranteed." },
    ]);
  });
});

describe("renderedOptionCopy", () => {
  it("freezes non-archived option descriptions keyed by id", () => {
    expect(
      renderedOptionCopyForAssessment({
        bonuses: [
          { id: "b1", description: "Bonus text." },
          { id: "b2", description: "Archived text.", archived: true },
          { id: "b3" },
        ],
        additionalOptions: [{ id: "o1", description: "Option text." }],
      }),
    ).toEqual({ b1: "Bonus text.", o1: "Option text." });
    expect(renderedOptionCopyForAssessment({})).toEqual({});
    expect(renderedOptionCopyForAssessment(null)).toEqual({});
  });

  it("reads back only well-formed frozen copies", () => {
    expect(readRenderedOptionCopy({ renderedOptionCopy: { b1: "Frozen." } })).toEqual({ b1: "Frozen." });
    expect(readRenderedOptionCopy({})).toBeNull();
    expect(readRenderedOptionCopy({ renderedOptionCopy: {} })).toBeNull();
    expect(readRenderedOptionCopy({ renderedOptionCopy: { b1: "", b2: 42 } })).toBeNull();
    expect(readRenderedOptionCopy({ renderedOptionCopy: "junk" })).toBeNull();
  });

  it("scans the frozen text, not later stored edits", () => {
    const frozen = { b1: "Call us 24/7 for help." };
    const snapshot = {
      assessment: { bonuses: [{ id: "b1", name: "Bonus One", description: "Clean stored text." }] },
      renderedOptionCopy: frozen,
      promiseConfirmations: [],
    };
    const unresolved = unresolvedSnapshotPromiseHits(snapshot);
    expect(unresolved.map((hit) => hit.phrase)).toEqual(["24/7"]);
    const confirmed = unresolved.map((hit) => ({
      where: hit.where, phrase: hit.phrase, textHash: hit.textHash, confirmedAt: "2026-11-27T00:00:00Z",
    }));
    expect(unresolvedSnapshotPromiseHits({ ...snapshot, promiseConfirmations: confirmed })).toEqual([]);
  });
});

describe("publishedOrDraftSnapshot", () => {
  const draft = { assessment: { introBody: "Draft." } };
  const published = { assessment: { introBody: "Published." } };

  it("prefers the published snapshot and falls back to the draft", () => {
    expect(publishedOrDraftSnapshot({ snapshotJson: draft, publishedSnapshotJson: published })).toBe(published);
    expect(publishedOrDraftSnapshot({ snapshotJson: draft })).toBe(draft);
    expect(publishedOrDraftSnapshot({ snapshotJson: draft, publishedSnapshotJson: null })).toBe(draft);
    expect(publishedOrDraftSnapshot({ snapshotJson: draft, publishedSnapshotJson: {} })).toBe(draft);
    expect(publishedOrDraftSnapshot({})).toBeNull();
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
