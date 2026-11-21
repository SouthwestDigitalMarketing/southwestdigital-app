import { beforeEach, describe, expect, it, vi } from "vitest";
import { signUnlock, UNLOCK_COOKIE } from "./token";

const mocks = vi.hoisted(() => ({ user: vi.fn(), cookie: vi.fn(), path: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("react", () => ({ cache: <T,>(fn: T) => fn }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: mocks.user } } }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === UNLOCK_COOKIE ? mocks.cookie() : undefined) }),
  headers: async () => ({ get: (name: string) => (name === "x-pathname" ? mocks.path() : null) }),
}));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`redirect:${to}`); } }));

const { requireUnlocked } = await import("./server");

const changedAt = new Date("2026-11-20T12:00:00Z");

beforeEach(() => {
  process.env.AUTH_SECRET = "test-secret";
  mocks.user.mockResolvedValue({ pinHash: "scrypt$x", pinChangedAt: changedAt });
  mocks.cookie.mockReturnValue(undefined);
  mocks.path.mockReturnValue("/contacts?tab=all");
});

describe("requireUnlocked", () => {
  it("sends a device with no unlock cookie to /unlock, keeping where it was going", async () => {
    await expect(requireUnlocked("u1")).rejects.toThrow("redirect:/unlock?next=%2Fcontacts%3Ftab%3Dall");
  });

  it("sends a required account with no PIN yet to /unlock to create one", async () => {
    mocks.user.mockResolvedValue({ email: "Thomas@BookkeepingConroe.com", pinHash: null, pinChangedAt: null });
    await expect(requireUnlocked("u1")).rejects.toThrow("redirect:/unlock");
  });

  it("lets an optional account with no PIN through, unlocked or not", async () => {
    mocks.user.mockResolvedValue({ email: "someone@example.com", pinHash: null, pinChangedAt: null });
    await expect(requireUnlocked("u1")).resolves.toMatchObject({ required: false, hasPin: false, locked: false });
  });

  it("locks an optional account once it has turned on a PIN", async () => {
    mocks.user.mockResolvedValue({ email: "someone@example.com", pinHash: "scrypt$x", pinChangedAt: changedAt });
    await expect(requireUnlocked("u1")).rejects.toThrow("redirect:/unlock");
  });

  it("lets a valid unlock through", async () => {
    mocks.cookie.mockReturnValue({ value: signUnlock("u1", changedAt.getTime(), Date.now(), "test-secret") });
    await expect(requireUnlocked("u1")).resolves.toMatchObject({ hasPin: true, unlocked: true });
  });

  it("rejects another user's unlock and an unlock from before a PIN change", async () => {
    mocks.cookie.mockReturnValue({ value: signUnlock("u2", changedAt.getTime(), Date.now(), "test-secret") });
    await expect(requireUnlocked("u1")).rejects.toThrow("redirect:/unlock");
    mocks.cookie.mockReturnValue({ value: signUnlock("u1", changedAt.getTime() - 1, Date.now(), "test-secret") });
    await expect(requireUnlocked("u1")).rejects.toThrow("redirect:/unlock");
  });

  it("never redirects to another site", async () => {
    mocks.path.mockReturnValue("//evil.example");
    await expect(requireUnlocked("u1")).rejects.toThrow("redirect:/unlock?next=%2Fdashboard");
  });
});
