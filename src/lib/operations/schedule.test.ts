import { describe, expect, it } from "vitest";
import { PLAYBOOK } from "./playbook";
import {
  buildBoard,
  firmDateKey,
  firmInstant,
  healthOf,
  isOccurrence,
  latestPeriod,
  occurrences,
  type BoardEvidence,
} from "./schedule";

const duty = (id: string) => PLAYBOOK.find((d) => d.id === id)!;
const client = { id: "c1", name: "Rodan", startsOn: "2026-11-19" };
const evidence = (over: Partial<BoardEvidence>): BoardEvidence => ({
  dutyId: "daily-bank-feeds",
  clientId: "c1",
  period: "2026-11-19",
  status: "done",
  summary: "0 pending",
  sourceRef: null,
  reportedBy: "sol",
  occurredAt: new Date("2026-11-19T14:00:00Z"),
  ...over,
});

describe("firm-local time", () => {
  it("converts Chicago wall time to an instant across daylight saving", () => {
    expect(firmInstant("2026-11-19", 9).toISOString()).toBe("2026-11-19T15:00:00.000Z"); // CST
    expect(firmInstant("2026-07-01", 9).toISOString()).toBe("2026-07-01T14:00:00.000Z"); // CDT
  });

  it("keys the date by the Chicago day", () => {
    expect(firmDateKey(new Date("2026-11-19T03:00:00Z"))).toBe("2026-11-18");
  });
});

describe("occurrences", () => {
  it("lists each day's duties with their due time", () => {
    const occ = occurrences("2026-11-20", new Date("2026-11-20T18:00:00Z"));
    const bank = occ.find((o) => o.duty.id === "daily-bank-feeds")!;
    expect(bank.period).toBe("2026-11-20");
    expect(bank.dueAt.toISOString()).toBe("2026-11-20T15:00:00.000Z");
    expect(occ.some((o) => o.duty.id === "weekly-recap")).toBe(true); // Friday
  });

  it("finds the newest period a duty fell due", () => {
    const saturday = new Date("2026-11-21T18:00:00Z");
    expect(latestPeriod(duty("daily-bank-feeds"), saturday)).toBe("2026-11-20");
    expect(latestPeriod(duty("monthly-close"), saturday)).toBe("2026-11-20");
    expect(latestPeriod(duty("monthly-check-in"), saturday)).toBe("2026-10-25");
  });

  it("rejects a period the duty is not due on", () => {
    expect(isOccurrence(duty("weekly-status-note"), "2026-11-23")).toBe(true); // Monday
    expect(isOccurrence(duty("weekly-status-note"), "2026-11-24")).toBe(false);
  });
});

describe("board", () => {
  const morning = new Date("2026-11-19T14:00:00Z"); // 8:00 Chicago
  const afternoon = new Date("2026-11-19T21:00:00Z"); // 15:00 Chicago
  const bankFor = (items: ReturnType<typeof buildBoard>) =>
    items.find((i) => i.duty.id === "daily-bank-feeds" && i.client?.id === "c1")!;

  it("is due before its hour and overdue after, with no evidence", () => {
    expect(bankFor(buildBoard({ now: morning, clients: [client], evidence: [] })).state).toBe("due");
    expect(bankFor(buildBoard({ now: afternoon, clients: [client], evidence: [] })).state).toBe("overdue");
  });

  it("takes the newest evidence for the occurrence", () => {
    const items = buildBoard({
      now: afternoon,
      clients: [client],
      evidence: [
        evidence({ status: "waiting_client", occurredAt: new Date("2026-11-19T15:00:00Z") }),
        evidence({ status: "done", occurredAt: new Date("2026-11-19T16:00:00Z") }),
      ],
    });
    expect(bankFor(items).state).toBe("done");
  });

  it("ignores evidence for another period or client", () => {
    const items = buildBoard({
      now: afternoon,
      clients: [client],
      evidence: [evidence({ period: "2026-11-18" }), evidence({ clientId: "c2" })],
    });
    expect(bankFor(items).state).toBe("overdue");
  });

  it("expects nothing from a client before its start date", () => {
    const later = { ...client, startsOn: "2026-11-20" };
    const items = buildBoard({ now: afternoon, clients: [later], evidence: [] });
    expect(items.filter((i) => i.client)).toHaveLength(0);
  });

  it("puts problems first and rates health", () => {
    const items = buildBoard({
      now: afternoon,
      clients: [client],
      evidence: [evidence({ status: "done" })],
    });
    expect(items[0].state).toBe("overdue");
    expect(healthOf(items.filter((i) => i.client && i.duty.id === "daily-bank-feeds"))).toBe("green");
    expect(healthOf(items.filter((i) => i.client))).toBe("red");
    expect(healthOf([])).toBe("none");
  });
});
