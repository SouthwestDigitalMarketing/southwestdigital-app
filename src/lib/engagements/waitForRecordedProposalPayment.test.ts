import { afterEach, describe, expect, it, vi } from "vitest";
import { waitForRecordedProposalPayment } from "./waitForRecordedProposalPayment";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("waitForRecordedProposalPayment", () => {
  it("returns paid once confirm-payment reports paid", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ paid: false }))
      .mockResolvedValueOnce(jsonResponse({ paid: true }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(waitForRecordedProposalPayment({
      engagementId: "eng",
      headers: { "x-proposal-token": "token" },
      delayMs: 0,
    })).resolves.toBe("paid");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith("/api/proposal/eng/confirm-payment", {
      method: "POST",
      headers: { "x-proposal-token": "token" },
    });
  });

  it("returns pending when the webhook has not recorded payment", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ paid: false }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(waitForRecordedProposalPayment({
      engagementId: "eng",
      headers: { "x-proposal-token": "token" },
      attempts: 3,
      delayMs: 0,
    })).resolves.toBe("pending");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
