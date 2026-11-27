import { describe, expect, it } from "vitest";
import { buildHourlyAgreementText } from "./hourlyAgreementText";

const fields = {
  companyName: "Acme Co",
  firstName: "Alex",
  lastName: "Example",
  contactEmail: "alex@example.test",
  date: new Date("2026-09-02T12:00:00Z"),
};

describe("buildHourlyAgreementText", () => {
  it("fills client facts and strips every remaining token", () => {
    const text = buildHourlyAgreementText(
      "Agreement for {{clientName}}\n{{contactLine}}\n{{date}}\n{{brandName}} {{scopeOfWork}} {{feeStructure}} {{volumeClause}} {{hourlyRate}}",
      fields,
    );
    expect(text).toContain("Agreement for Acme Co");
    expect(text).toContain("Contact:          Alex Example | alex@example.test");
    expect(text).toContain("September 2, 2026");
    expect(text).not.toContain("{{");
    expect(text).not.toMatch(/volume/i);
  });

  it("returns null when no template is selected", () => {
    expect(buildHourlyAgreementText(null, fields)).toBeNull();
  });

  it("falls back to Client and keeps text token-free without contact facts", () => {
    const text = buildHourlyAgreementText("Hi {{clientName}} {{contactLine}}", {
      ...fields,
      companyName: "  ",
      firstName: "",
      lastName: "",
      contactEmail: "",
    });
    expect(text).toBe("Hi Client ");
    expect(text).not.toContain("{{");
  });
});
