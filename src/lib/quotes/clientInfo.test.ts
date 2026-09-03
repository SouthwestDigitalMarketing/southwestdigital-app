import { describe, expect, it } from "vitest";
import { quoteClientDetailsFromSnapshot } from "./clientInfo";

describe("quoteClientDetailsFromSnapshot", () => {
  it("uses the resolved primary contact and company name", () => {
    const snapshot = {
      contactInfo: {
        companyName: "Promoline",
        invoicingEmail: "billing@promoline.test",
        owners: [
          {
            id: "owner-1",
            firstName: "Khaled",
            lastName: "Saleh",
            email: "khaled@promoline.test",
          },
        ],
        primaryContact: {
          sameAsOwner: true,
          ownerId: "owner-1",
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
          role: "",
        },
      },
    };

    expect(
      quoteClientDetailsFromSnapshot(snapshot, {
        name: "Fallback",
        email: "fallback@example.test",
        company: null,
      }),
    ).toEqual({
      name: "Khaled Saleh",
      email: "billing@promoline.test",
      company: "Promoline",
    });
  });

  it("falls back to the existing client when no contact info is present", () => {
    expect(
      quoteClientDetailsFromSnapshot(
        {},
        {
          name: "Khaled",
          email: "khaled@example.test",
          company: "Promoline",
        },
      ),
    ).toEqual({
      name: "Khaled",
      email: "khaled@example.test",
      company: "Promoline",
    });
  });
});
