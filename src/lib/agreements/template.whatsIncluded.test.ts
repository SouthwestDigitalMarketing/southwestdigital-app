import { describe, expect, it } from "vitest";
import { generateProposalAgreementText } from "@/lib/engagements/agreementGenerator";

describe("agreement WHAT'S INCLUDED", () => {
  const base = { brandName: "Example", clientName: "Client", selectedTierLabel: "Grow" };

  it("is absent for legacy agreements without the new data", () => {
    const text = generateProposalAgreementText(base);
    expect(text).not.toContain("WHAT'S INCLUDED");
  });

  it("renders the included services plus the support meaning after Scope", () => {
    const text = generateProposalAgreementText({
      ...base,
      whatsIncluded: [
        { name: "Monthly Bookkeeping", description: "Books done monthly." },
        { name: "White-Glove Concierge", description: "We reply within 2 business hours (Mon–Fri, 9–5 Central), and you get a direct line for anything time-sensitive." },
      ],
    });
    expect(text).toContain("WHAT'S INCLUDED");
    expect(text).toContain("White-Glove Concierge: We reply within 2 business hours");
    expect(text.indexOf("WHAT'S INCLUDED")).toBeGreaterThan(text.indexOf("SCOPE OF WORK"));
    expect(text.indexOf("WHAT'S INCLUDED")).toBeLessThan(text.indexOf("FEE STRUCTURE"));
  });

  it("does not disturb numbered clause numbering", () => {
    const without = generateProposalAgreementText(base);
    const withSection = generateProposalAgreementText({
      ...base,
      whatsIncluded: [{ name: "Monthly Bookkeeping", description: "" }],
    });
    const numbers = (text: string) => [...text.matchAll(/^(\d+)\. /gm)].map((match) => match[1]);
    expect(numbers(withSection)).toEqual(numbers(without));
    expect(numbers(withSection)).toEqual(numbers(without).map((_, index) => String(index + 1)));
  });
});
