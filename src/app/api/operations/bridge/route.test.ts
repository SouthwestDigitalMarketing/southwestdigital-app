import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ upsert: vi.fn(), findUnique: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { bridgeSwitch: { upsert: mocks.upsert, findUnique: mocks.findUnique } } }));
vi.mock("@/lib/simpleRateLimit", () => ({ checkRateLimit: () => ({ allowed: true, remaining: 1 }) }));

process.env.OPERATIONS_API_TOKEN_SHA256 = createHash("sha256").update("tok").digest("hex");
const headers = { authorization: "Bearer tok" };
const { GET, POST } = await import("./route");
const post = (body: unknown, auth: Record<string, string> = headers) =>
  new Request("http://x/api/operations/bridge", { method: "POST", headers: auth, body: JSON.stringify(body) });

beforeEach(() => Object.values(mocks).forEach((fn) => fn.mockReset()));

describe("/api/operations/bridge", () => {
  it("needs the operations token", async () => {
    expect((await GET(new Request("http://x/api/operations/bridge"))).status).toBe(401);
    expect((await POST(post({ mode: "off" }, { authorization: "Bearer nope" }))).status).toBe(401);
  });

  it("POST saves the heartbeat and answers the switch", async () => {
    mocks.upsert.mockResolvedValue({ enabled: true, changedAt: null, changedBy: "tom" });
    const res = await POST(post({ mode: "idle", lastMessageUid: 9 }));
    expect(await res.json()).toMatchObject({ enabled: true });
    const arg = mocks.upsert.mock.calls[0][0];
    expect(arg.update).toMatchObject({ mode: "idle", lastMessageUid: 9 });
    expect(arg.update).not.toHaveProperty("enabled");
    expect(arg.create.enabled).toBe(false);
  });

  it("an agent can turn it off, never on", async () => {
    mocks.upsert.mockResolvedValue({ enabled: false, changedAt: new Date(), changedBy: "ripley:donna" });
    await POST(post({ mode: "idle", turnOff: true, reportedBy: "donna" }));
    expect(mocks.upsert.mock.calls[0][0].update).toMatchObject({ enabled: false, changedBy: "ripley:donna" });
    await POST(post({ mode: "idle", enabled: true }));
    expect(mocks.upsert.mock.calls[1][0].update).not.toHaveProperty("enabled");
  });

  it("POST rejects a bad mode", async () => {
    expect((await POST(post({ mode: "maybe" }))).status).toBe(400);
  });

  it("GET shows the plain state", async () => {
    mocks.findUnique.mockResolvedValue(null);
    expect(await (await GET(new Request("http://x/api/operations/bridge", { headers }))).json()).toMatchObject({ enabled: false, state: "off" });
  });
});
