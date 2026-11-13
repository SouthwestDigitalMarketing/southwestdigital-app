import { spawnSync } from "child_process";
import { describe, expect, it } from "vitest";
import { planIntake, safeFileName, signTicket, ticketMatches } from "./ticket";

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

  it("builds a put link and refuses the wrong kind of file", () => {
    const plan = planIntake({
      name: "take.mp4",
      size: 12,
      type: "video/mp4",
      secret,
      publicUrl: "http://127.0.0.1:8932",
      nowSeconds: 1_700_000_000,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const url = new URL(plan.putUrl);
    expect(url.pathname).toBe("/upload");
    expect(url.searchParams.get("name")).toBe("take.mp4");
    expect(url.searchParams.get("size")).toBe("12");
    expect(url.searchParams.get("sig")).toBe(plan.sig);

    const notAVideo = planIntake({
      name: "notes.txt",
      size: 12,
      type: "text/plain",
      secret,
      publicUrl: "http://127.0.0.1:8932",
      nowSeconds: 1_700_000_000,
    });
    expect(notAVideo).toMatchObject({ ok: false, status: 400 });

    const tooBig = planIntake({
      name: "huge.mp4",
      size: 3_000_000_001,
      type: "video/mp4",
      secret,
      publicUrl: "http://127.0.0.1:8932",
      nowSeconds: 1_700_000_000,
    });
    expect(tooBig).toMatchObject({ ok: false, status: 400 });
  });
});
