import { describe, expect, it } from "vitest";
import { extractOfferEngagementFields, offerHasCleanup } from "./offerFields";

describe("extractOfferEngagementFields", () => {
  it("uses the company and resolved primary contact", () => {
    const fields = extractOfferEngagementFields({
      contactInfo: {
        companyName: "Acme Rentals",
        invoicingEmail: "bills@acme.test",
        owners: [{ id: "owner-1", firstName: "Pat", lastName: "Lee", email: "pat@acme.test", phone: "555" }],
        primaryContact: { sameAsOwner: true, ownerId: "owner-1", firstName: "", lastName: "", email: "", phone: "" },
      },
      assessment: { booksOverTwoMonthsBehind: true },
    });
    expect(fields).toMatchObject({
      clientName: "Acme Rentals",
      primaryContactName: "Pat Lee",
      primaryContactEmail: "pat@acme.test",
      billingContactEmail: "bills@acme.test",
      hasCleanup: true,
    });
  });

  it("falls back to Untitled proposal when no company is set", () => {
    expect(extractOfferEngagementFields({}).clientName).toBe("Untitled proposal");
    expect(offerHasCleanup({})).toBe(false);
  });
});
