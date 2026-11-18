import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/pipe/tags", () => ({ applyPipeTag: vi.fn() }));
vi.mock("@/lib/pipe/contacts", () => ({ upsertPipeContact: vi.fn() }));
vi.mock("@/lib/tenancy/context", () => ({ createBrandDataContext: vi.fn(), withBrandDataTransaction: vi.fn() }));

const { clientKeyFor, clientTagsFor } = await import("./clientWon");

describe("client won", () => {
  it("makes a stable slug from the client name", () => {
    expect(clientKeyFor("Rodan Properties LLC")).toBe("rodan-properties-llc");
    expect(clientKeyFor("RODAN PROPERTIES, LLC")).toBe("rodan-properties-llc");
    expect(clientKeyFor("Smith & Sons, Inc.")).toBe("smith-and-sons-inc");
    expect(clientKeyFor("!!!")).toBe("client");
  });

  it("tags a monthly client with the service and starts the Reviews pipeline", () => {
    const keys = clientTagsFor(true).map((t) => t.key);
    expect(keys).toEqual([
      "contract-signed",
      "paid",
      "active-client",
      "monthly-bookkeeping",
      "service-monthly-bookkeeping-active",
      "review-pending",
    ]);
    expect(clientTagsFor(false).map((t) => t.key)).not.toContain("service-monthly-bookkeeping-active");
  });
});
