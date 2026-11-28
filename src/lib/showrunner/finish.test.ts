import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeLocalTitleScreen } from "./finish";

describe("writeLocalTitleScreen", () => {
  let inbox = "";

  afterEach(async () => {
    delete process.env.PHONE_INTAKE_INBOX;
    if (inbox) await rm(inbox, { recursive: true, force: true });
  });

  it("writes .title-screen.json in the done folder", async () => {
    inbox = await mkdtemp(path.join(os.tmpdir(), "title-screen-"));
    await mkdir(path.join(inbox, "done", "mwzglzlj-5643aa"), { recursive: true });
    process.env.PHONE_INTAKE_INBOX = inbox;
    expect(await writeLocalTitleScreen("mwzglzlj-5643aa")).toBe(true);
    const body = JSON.parse(
      await readFile(path.join(inbox, "done", "mwzglzlj-5643aa", ".title-screen.json"), "utf8"),
    ) as { approved: boolean; at: number };
    expect(body.approved).toBe(true);
    expect(typeof body.at).toBe("number");
  });

  it("skips when the inbox is not this machine", async () => {
    delete process.env.PHONE_INTAKE_INBOX;
    expect(await writeLocalTitleScreen("mwzglzlj-5643aa")).toBe(false);
  });
});
