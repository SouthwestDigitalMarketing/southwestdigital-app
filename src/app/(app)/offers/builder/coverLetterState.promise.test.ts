import { describe, expect, it } from "vitest";
import { coverPromiseHits, normalizeCoverTextForScan } from "./coverLetterState";
import { hashPromiseText, unresolvedPromiseHits } from "@/lib/quotes/promiseCheck";

describe("coverPromiseHits", () => {
  it("flags the assessment text plus the exact cover email and SMS bodies", () => {
    const hits = coverPromiseHits(
      {
        introBody: "Clean books, guaranteed.",
        packageNames: { grow: "Grow", improve: "Improve", maintain: "Maintain" },
      },
      {
        emailSubject: "Your bookkeeping proposal",
        emailBody: "Hi there, call us 24/7 for help.",
        smsBody: "Same-day turnaround, reply here.",
      },
    );
    expect(hits.map((hit) => [hit.where, hit.phrase])).toEqual([
      ["Intro body", "guarantee"],
      ["Cover email", "24/7"],
      ["Cover SMS", "same day"],
    ]);
  });

  it("scans package names, credit reasons, and bonus names like finalize does", () => {
    const hits = coverPromiseHits(
      {
        packageNames: { grow: "24/7 Advisory", improve: "Improve", maintain: "Maintain" },
        firstPaymentCreditReason: "CPA work already paid.",
        bonuses: [{ id: "b1", name: "Unlimited check-ins", description: "Plain." }],
      },
      { emailSubject: "Subject", emailBody: "Plain body.", smsBody: "Plain sms." },
    );
    expect(hits.map((hit) => [hit.where, hit.phrase])).toEqual([
      ["Package name: grow", "24/7"],
      ["First payment credit reason", "CPA"],
      ["Bonus name: b1", "unlimited"],
    ]);
  });

  it("normalizes the proposal link so confirming survives a republish", () => {
    const bodies = {
      emailSubject: "Your bookkeeping proposal",
      emailBody: "Review it here:\nhttps://example.test/proposal/token-1\nCall us 24/7.",
      smsBody: "Plain sms.",
    };
    const hits = coverPromiseHits({}, bodies);
    expect(hits.map((hit) => hit.phrase)).toEqual(["24/7"]);
    const normalized = normalizeCoverTextForScan(
      `${bodies.emailSubject}\n\n${bodies.emailBody}`,
    );
    expect(hits[0].textHash).toBe(hashPromiseText(normalized));
    const confirmed = [{
      where: "Cover email",
      phrase: hits[0].phrase,
      textHash: hashPromiseText(normalized),
      confirmedAt: "2026-11-27T00:00:00Z",
    }];
    // Re-stamping a new link keeps the normalized text (and hash) identical.
    const relinked = coverPromiseHits({}, {
      ...bodies,
      emailBody: bodies.emailBody.replace("token-1", "token-2"),
    });
    expect(unresolvedPromiseHits(relinked, confirmed)).toEqual([]);
  });

  it("finds nothing in clean assessment and cover text", () => {
    expect(coverPromiseHits(
      { introBody: "Clean books." },
      { emailSubject: "Subject", emailBody: "Plain body.", smsBody: "Plain sms." },
    )).toEqual([]);
  });
});
