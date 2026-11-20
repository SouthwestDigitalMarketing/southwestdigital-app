import { describe, expect, it } from "vitest";
import { buildScorecardClients, phoneE164, type ClientRecordRow } from "./clients";

const contact = {
  name: "Rodan Properties",
  phoneE164: "+19365550101",
  phoneNumber: "(936) 555-0101",
  email: "Owner@Rodan.com",
  secondaryEmail: "owner@rodan.com ",
  businessEmail: null,
  personalEmail: "Pat@example.com",
};
const row = (over: Partial<ClientRecordRow> = {}): ClientRecordRow => ({
  contactId: "c1",
  startDate: new Date("2026-11-17T00:00:00Z"),
  endDate: null,
  evidenceDate: new Date("2026-11-13T00:00:00Z"),
  contact,
  ...over,
});

describe("phoneE164", () => {
  it("normalises US numbers and drops the rest", () => {
    expect(phoneE164("936-555-0101")).toBe("+19365550101");
    expect(phoneE164("1 (936) 555 0101")).toBe("+19365550101");
    expect(phoneE164("+19365550101")).toBe("+19365550101");
    expect(phoneE164("555-0101")).toBeNull();
    expect(phoneE164(null)).toBeNull();
  });
});

describe("buildScorecardClients", () => {
  it("dedupes phones and lower-cased emails, takes the earliest start or evidence day", () => {
    expect(buildScorecardClients([row(), row({ startDate: new Date("2026-12-01T00:00:00Z"), evidenceDate: new Date("2026-11-30T00:00:00Z") })])).toEqual([
      {
        contactId: "c1",
        name: "Rodan Properties",
        phones: ["+19365550101"],
        emails: ["owner@rodan.com", "pat@example.com"],
        clientFrom: "2026-11-13",
        clientUntil: null,
      },
    ]);
  });

  it("sets clientUntil only when every record has ended", () => {
    const ended = [
      row({ endDate: new Date("2026-03-31T00:00:00Z") }),
      row({ endDate: new Date("2026-06-30T00:00:00Z") }),
    ];
    expect(buildScorecardClients(ended)[0].clientUntil).toBe("2026-06-30");
    expect(buildScorecardClients([...ended, row()])[0].clientUntil).toBeNull();
  });

  it("returns one row per contact sorted by name", () => {
    const other = { ...contact, name: "AAA Discount Maid", phoneE164: null, phoneNumber: "bad", email: null, secondaryEmail: null, personalEmail: null };
    const clients = buildScorecardClients([row(), row({ contactId: "c2", contact: other })]);
    expect(clients.map((c) => c.contactId)).toEqual(["c2", "c1"]);
    expect(clients[0]).toMatchObject({ phones: [], emails: [] });
  });
});
