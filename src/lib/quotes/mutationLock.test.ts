import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { lockQuoteMutation } from "./mutationLock";

function transaction(quote: unknown, rows: Array<{ id: string }> = [{ id: "quote" }]) {
  return { $queryRaw: vi.fn().mockResolvedValue(rows), quote: { findFirst: vi.fn().mockResolvedValue(quote) } };
}
const openQuote = { id: "quote", status: "sent", engagement: { signedAt: null }, publishedAt: new Date(), expiresAt: null };

describe("quote publication/signature lock", () => {
  it("locks only the authorized brand's quote before checking current signature state", async () => {
    const tx = transaction(openQuote);
    await expect(lockQuoteMutation(tx as unknown as Prisma.TransactionClient, "brand", "quote", "publish")).resolves.toEqual(openQuote);
    expect(tx.$queryRaw.mock.calls[0].slice(1)).toEqual(["quote", "brand"]);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.quote.findFirst.mock.invocationCallOrder[0]);
  });
  it("rejects publishing after a signature was committed", async () => {
    const tx = transaction({ ...openQuote, engagement: { signedAt: new Date() } });
    await expect(lockQuoteMutation(tx as unknown as Prisma.TransactionClient, "brand", "quote", "publish")).rejects.toThrow("Signed offers");
  });
  it("rejects a missing or cross-brand quote", async () => {
    const tx = transaction(openQuote, []);
    await expect(lockQuoteMutation(tx as unknown as Prisma.TransactionClient, "other", "quote", "publish")).rejects.toThrow("not found");
    expect(tx.quote.findFirst).not.toHaveBeenCalled();
  });
  it("rechecks expiry under the lock before signing", async () => {
    const tx = transaction({ ...openQuote, expiresAt: new Date(0) });
    await expect(lockQuoteMutation(tx as unknown as Prisma.TransactionClient, "brand", "quote", "sign")).rejects.toThrow("no longer available");
  });
});
