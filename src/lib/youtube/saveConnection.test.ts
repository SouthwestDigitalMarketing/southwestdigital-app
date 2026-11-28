import { IntegrationProvider, IntegrationStatus } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { disconnectYouTube, markYouTubeAuthError, saveYouTubeConnection } from "./saveConnection";

const mocks = vi.hoisted(() => ({
  findManyTheme: vi.fn(),
  findManyIntegration: vi.fn(),
  findUnique: vi.fn(),
  count: vi.fn(),
  upsert: vi.fn(),
  updateTheme: vi.fn(),
  deleteMany: vi.fn(),
  updateMany: vi.fn(),
  transaction: vi.fn(),
  encrypt: vi.fn(),
  decrypt: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    brandTheme: { findMany: mocks.findManyTheme, update: mocks.updateTheme },
    brandIntegration: {
      findMany: mocks.findManyIntegration,
      findUnique: mocks.findUnique,
      count: mocks.count,
      upsert: mocks.upsert,
      deleteMany: mocks.deleteMany,
      updateMany: mocks.updateMany,
    },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/secrets/encryption", () => ({
  encryptSecret: mocks.encrypt,
  decryptSecret: mocks.decrypt,
}));

beforeEach(() => {
  mocks.encrypt.mockReturnValue("cipher:token");
  mocks.decrypt.mockReturnValue("refresh-token");
  mocks.findManyTheme.mockResolvedValue([]);
  mocks.findManyIntegration.mockResolvedValue([]);
  mocks.findUnique.mockResolvedValue(null);
  mocks.count.mockResolvedValue(0);
  mocks.upsert.mockResolvedValue({});
  mocks.updateTheme.mockResolvedValue({});
  mocks.deleteMany.mockResolvedValue({ count: 1 });
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops));
  mocks.fetch.mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("saveYouTubeConnection", () => {
  it("writes the current brand and copies the token to brands already on that channel", async () => {
    mocks.findManyTheme.mockResolvedValue([{ brandId: "treb" }]);
    mocks.findManyIntegration.mockResolvedValue([{ brandId: "treb" }, { brandId: "bkc-dup" }]);

    await saveYouTubeConnection({
      brandId: "bkc",
      channelId: "UC-treb",
      channelTitle: "The Real Estate Bookkeeper",
      refreshToken: "fresh-token",
    });

    expect(mocks.encrypt).toHaveBeenCalledWith("fresh-token");
    const brandIds = mocks.upsert.mock.calls.map((call) => call[0].where.brandId_key.brandId).sort();
    expect(brandIds).toEqual(["bkc", "bkc-dup", "treb"]);
    for (const call of mocks.upsert.mock.calls) {
      expect(call[0].update).toMatchObject({
        provider: IntegrationProvider.YOUTUBE,
        status: IntegrationStatus.ACTIVE,
        externalAccountId: "UC-treb",
        secretCiphertext: "cipher:token",
      });
    }
    expect(mocks.updateTheme).toHaveBeenCalledWith({
      where: { brandId: "bkc" },
      data: { youtubeChannelId: "UC-treb" },
    });
  });
});

describe("disconnectYouTube", () => {
  it("revokes at Google only when no other brand still uses the channel", async () => {
    mocks.findUnique.mockResolvedValue({
      secretCiphertext: "cipher:token",
      externalAccountId: "UC-treb",
    });
    mocks.count.mockResolvedValue(1);

    await disconnectYouTube("bkc");

    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { brandId: "bkc", key: "youtube" },
    });
    expect(mocks.updateTheme).toHaveBeenCalledWith({
      where: { brandId: "bkc" },
      data: { youtubeChannelId: null },
    });
  });

  it("revokes at Google when this is the last brand on the channel", async () => {
    mocks.findUnique.mockResolvedValue({
      secretCiphertext: "cipher:token",
      externalAccountId: "UC-treb",
    });
    mocks.count.mockResolvedValue(0);

    await disconnectYouTube("treb");

    expect(mocks.decrypt).toHaveBeenCalledWith("cipher:token");
    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://oauth2.googleapis.com/revoke",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("markYouTubeAuthError", () => {
  it("marks the brand integration ERROR", async () => {
    await markYouTubeAuthError("treb", "invalid_grant");
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { brandId: "treb", key: "youtube" },
      data: expect.objectContaining({
        status: IntegrationStatus.ERROR,
        lastErrorCode: "invalid_grant",
      }),
    });
  });
});
