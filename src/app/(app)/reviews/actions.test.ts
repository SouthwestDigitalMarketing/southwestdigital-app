import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendReminder, sendReviewRequest } from "./actions";

const mocks = vi.hoisted(() => ({
  sendSms: vi.fn(),
  create: vi.fn(),
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  count: vi.fn(),
  update: vi.fn(),
  staff: vi.fn(),
  origin: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("@/lib/quo", () => ({ sendSms: mocks.sendSms }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    reviewRequest: {
      create: mocks.create,
      findUnique: mocks.findUnique,
      findFirst: mocks.findFirst,
      count: mocks.count,
      update: mocks.update,
    },
  },
}));
vi.mock("@/lib/brands/staff", () => ({ requireStaffBrandOrThrow: mocks.staff }));
vi.mock("@/lib/reviews/publicOrigin", () => ({ resolvePublicReviewOrigin: mocks.origin }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));

const ORIGIN = "https://app.example.test";
const PHONE = "5551234567";
const E164 = "+15551234567";

function form(overrides: Record<string, string | null> = {}) {
  const data = new FormData();
  const values: Record<string, string | null> = {
    recipientName: "Jane Smith",
    recipientPhone: PHONE,
    smsConsent: "on",
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value !== null) data.set(key, value);
  }
  return data;
}

function smsLink(content: string) {
  const match = String(content).match(/https:\/\/app\.example\.test\/r\/([0-9a-f]{32})/);
  expect(match, `expected brand origin link in SMS, got: ${content}`).toBeTruthy();
  return match![1];
}

beforeEach(() => {
  mocks.staff.mockResolvedValue({
    brand: { id: "brand-1", name: "Example Co" },
    membership: { id: "mem-1" },
  });
  mocks.origin.mockResolvedValue(ORIGIN);
  mocks.sendSms.mockResolvedValue(undefined);
  mocks.create.mockResolvedValue({ id: "req-1" });
  mocks.findFirst.mockResolvedValue(null);
  mocks.count.mockResolvedValue(0);
  mocks.findUnique.mockResolvedValue(null);
  mocks.update.mockResolvedValue({ id: "req-1" });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("sendReviewRequest", () => {
  it("sends a brand-domain link then creates the row", async () => {
    const order: string[] = [];
    mocks.sendSms.mockImplementation(async () => {
      order.push("sms");
    });
    mocks.create.mockImplementation(async () => {
      order.push("create");
      return { id: "req-1" };
    });

    await sendReviewRequest(form());

    expect(mocks.sendSms).toHaveBeenCalledTimes(1);
    const [to, content] = mocks.sendSms.mock.calls[0] as [string, string];
    expect(to).toBe(E164);
    expect(content).not.toContain("localhost");
    expect(content).not.toContain("admin.southwestdigital.io");
    expect(content).not.toContain("http://localhost:3000");
    const token = smsLink(content);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create.mock.calls[0][0]).toMatchObject({
      data: {
        brandId: "brand-1",
        token,
        recipientName: "Jane Smith",
        recipientPhone: E164,
        sentByMembershipId: "mem-1",
      },
    });
    expect(order).toEqual(["sms", "create"]);
  });

  it("does not create a row when SMS fails", async () => {
    mocks.sendSms.mockRejectedValue(new Error("Quo down"));
    await expect(sendReviewRequest(form())).rejects.toThrow("Quo down");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it.each([
    ["missing name", { recipientName: "" }],
    ["missing phone", { recipientPhone: "" }],
  ])("does not send when %s", async (_label, overrides) => {
    await expect(sendReviewRequest(form(overrides))).rejects.toThrow("Name and phone are required");
    expect(mocks.sendSms).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("does not send when the phone cannot be normalized", async () => {
    await expect(sendReviewRequest(form({ recipientPhone: "abc" }))).rejects.toThrow(
      "Enter a 10-digit US/Canada number",
    );
    expect(mocks.sendSms).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("does not send without brand membership", async () => {
    mocks.staff.mockResolvedValue({
      brand: { id: "brand-1", name: "Example Co" },
      membership: null,
    });
    await expect(sendReviewRequest(form())).rejects.toThrow("No brand access");
    expect(mocks.sendSms).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("does not send when the brand has no verified domain", async () => {
    mocks.origin.mockRejectedValue(
      new Error("This brand has no verified app domain. Add and verify one before sending review requests."),
    );
    await expect(sendReviewRequest(form())).rejects.toThrow("no verified app domain");
    expect(mocks.sendSms).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("does not send without SMS consent", async () => {
    await expect(sendReviewRequest(form({ smsConsent: null }))).rejects.toThrow(
      "Confirm you have permission to text this number.",
    );
    expect(mocks.sendSms).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("does not send the same phone twice within 24 hours", async () => {
    mocks.findFirst.mockResolvedValue({ id: "existing" });
    await expect(sendReviewRequest(form())).rejects.toThrow(
      "A review request was already sent to this number in the last 24 hours.",
    );
    expect(mocks.sendSms).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("does not send when the brand is at the daily SMS cap", async () => {
    mocks.count.mockResolvedValue(30);
    await expect(sendReviewRequest(form())).rejects.toThrow("daily SMS review-request limit");
    expect(mocks.sendSms).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe("sendReminder", () => {
  const row = {
    brandId: "brand-1",
    token: "existing-token",
    channel: "SMS",
    recipientPhone: E164,
    recipientName: "Jane Smith",
  };

  it("updates lastReminderAt only after SMS succeeds", async () => {
    mocks.findUnique.mockResolvedValue(row);
    const order: string[] = [];
    mocks.sendSms.mockImplementation(async () => {
      order.push("sms");
    });
    mocks.update.mockImplementation(async () => {
      order.push("update");
      return { id: "req-1" };
    });

    await sendReminder("req-1");

    const content = mocks.sendSms.mock.calls[0][1] as string;
    expect(content).toContain(`${ORIGIN}/r/existing-token`);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "req-1" },
      data: { lastReminderAt: expect.any(Date) },
    });
    expect(order).toEqual(["sms", "update"]);
  });

  it("does not stamp lastReminderAt when SMS fails", async () => {
    mocks.findUnique.mockResolvedValue(row);
    mocks.sendSms.mockRejectedValue(new Error("Quo down"));
    await expect(sendReminder("req-1")).rejects.toThrow("Quo down");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("throws for a non-SMS channel and does not send or update", async () => {
    mocks.findUnique.mockResolvedValue({ ...row, channel: "EMAIL" });
    await expect(sendReminder("req-1")).rejects.toThrow("Reminders can only be sent by SMS");
    expect(mocks.sendSms).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("does not send a reminder without membership", async () => {
    mocks.staff.mockResolvedValue({
      brand: { id: "brand-1", name: "Example Co" },
      membership: null,
    });
    await expect(sendReminder("req-1")).rejects.toThrow("No brand access");
    expect(mocks.sendSms).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
