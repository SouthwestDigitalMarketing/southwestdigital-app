import { spawnSync } from "child_process";
import { describe, expect, it } from "vitest";
import { safeFileName, sendPageLink, signSession, signTicket, ticketMatches } from "./ticket";

const secret = "test-secret-not-for-production";

describe("phone intake tickets", () => {
  it("keeps a safe file name", () => {
    expect(safeFileName("PXL 2026/clip.mp4")).toBe("clip.mp4");
    expect(safeFileName("../weird name!.png")).toBe("weird_name_.png");
    expect(safeFileName("   ")).toBe("upload.bin");
  });

  it("signs a ticket the Python road can check", () => {
    const sig = signTicket(secret, 1_700_000_000, 4, "clip.mp4");
    expect(ticketMatches(secret, 1_700_000_000, 4, "clip.mp4", sig)).toBe(true);
    expect(ticketMatches(secret, 1_700_000_000, 5, "clip.mp4", sig)).toBe(false);
    const py = spawnSync(
      "python3",
      ["scripts/phone_intake.py", "--sign", secret, "1700000000", "4", "clip.mp4"],
      { encoding: "utf8" },
    );
    expect(py.status).toBe(0);
    expect(py.stdout.trim()).toBe(sig);
  });

  it("builds a send-page link the Python road accepts", () => {
    const link = sendPageLink({ secret, publicUrl: "http://127.0.0.1:8932", nowSeconds: 1_700_000_000 });
    expect(link.ok).toBe(true);
    if (!link.ok) return;
    const url = new URL(link.url);
    expect(url.pathname).toBe("/send");
    expect(url.searchParams.get("exp")).toBe(String(link.exp));
    const py = spawnSync(
      "python3",
      ["scripts/phone_intake.py", "--sign-session", secret, String(link.exp)],
      { encoding: "utf8" },
    );
    expect(py.status).toBe(0);
    expect(py.stdout.trim()).toBe(url.searchParams.get("sig"));
    expect(signSession(secret, link.exp)).toBe(url.searchParams.get("sig"));
  });

  it("refuses a missing or bad send road address", () => {
    expect(sendPageLink({ secret: "", publicUrl: "http://x", nowSeconds: 1 })).toMatchObject({ ok: false });
    expect(sendPageLink({ secret, publicUrl: "ftp://x", nowSeconds: 1 })).toMatchObject({ ok: false });
  });
});
