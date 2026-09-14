import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendSms } from "./quo";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockResolvedValue({ ok: true, text: async () => "" });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("QUO_API_KEY", "env-api-key-must-not-be-used");
  vi.stubEnv("QUO_FROM_NUMBER", "+15550000000");
  vi.stubEnv("QUO_PHONE_NUMBER_ID", "env-phone-id");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("sendSms", () => {
  it("uses the passed credentials and ignores QUO_* env", async () => {
    await sendSms("+15551234567", "hello", {
      apiKey: "brand-api-key",
      from: "+15550001111",
      phoneNumberId: "pn-brand",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.quo.com/v1/messages");
    expect(init.headers).toMatchObject({ Authorization: "brand-api-key" });
    expect(init.body).toBe(
      JSON.stringify({
        from: "+15550001111",
        to: ["+15551234567"],
        content: "hello",
        phoneNumberId: "pn-brand",
      }),
    );
    expect(String(init.body)).not.toContain("env-api-key-must-not-be-used");
    expect(String(init.body)).not.toContain("+15550000000");
  });

  it("does not call Quo when credentials are missing", async () => {
    await expect(sendSms("+15551234567", "hello", { apiKey: "", from: "+15550001111" })).rejects.toThrow(
      "SMS is not configured for this brand.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
