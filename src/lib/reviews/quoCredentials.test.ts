import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getQuoSmsCredentials } from "./quoCredentials";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), decrypt: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { brandIntegration: { findUnique: mocks.findUnique } },
}));
vi.mock("@/lib/secrets/encryption", () => ({ decryptSecret: mocks.decrypt }));

const ROW = {
  provider: "QUO",
  status: "ACTIVE",
  secretCiphertext: "cipher:not-a-real-secret",
  publicIdentifier: "+15550001111",
  externalAccountId: "+15559999999",
  externalPropertyId: "pn-1",
};

beforeEach(() => {
  mocks.findUnique.mockResolvedValue(ROW);
  mocks.decrypt.mockReturnValue("brand-api-key");
});
afterEach(() => {
  vi.clearAllMocks();
});

describe("getQuoSmsCredentials", () => {
  it("returns decrypted brand credentials and prefers publicIdentifier as from", async () => {
    await expect(getQuoSmsCredentials("brand-1")).resolves.toEqual({
      apiKey: "brand-api-key",
      from: "+15550001111",
      phoneNumberId: "pn-1",
    });
    expect(mocks.decrypt).toHaveBeenCalledWith("cipher:not-a-real-secret");
  });

  it("falls back to externalAccountId when publicIdentifier is empty", async () => {
    mocks.findUnique.mockResolvedValue({ ...ROW, publicIdentifier: "  " });
    await expect(getQuoSmsCredentials("brand-1")).resolves.toMatchObject({
      from: "+15559999999",
    });
  });

  it.each([
    ["missing row", null],
    ["wrong provider", { ...ROW, provider: "YOUTUBE" }],
    ["disconnected", { ...ROW, status: "DISCONNECTED" }],
    ["no secret", { ...ROW, secretCiphertext: null }],
  ])("throws when SMS is %s", async (_label, row) => {
    mocks.findUnique.mockResolvedValue(row);
    await expect(getQuoSmsCredentials("brand-1")).rejects.toThrow("SMS is not configured for this brand.");
    expect(mocks.decrypt).not.toHaveBeenCalled();
  });

  it("throws the same error when decrypt fails", async () => {
    mocks.decrypt.mockImplementation(() => {
      throw new Error("bad cipher");
    });
    await expect(getQuoSmsCredentials("brand-1")).rejects.toThrow("SMS is not configured for this brand.");
  });
});
