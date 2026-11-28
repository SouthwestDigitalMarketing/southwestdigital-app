import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ staff: vi.fn(), save: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/quotes/access", () => ({ requireQuoteStaffOrThrow: mocks.staff }));
vi.mock("@/lib/quotes/acceptedCopy", () => ({ saveAcceptedCopy: mocks.save }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { saveAcceptedCopyAction } from "./actions";
const form = () => { const f = new FormData(); f.set("id", "quote"); f.set("brandId", "attacker"); return f; };
beforeEach(() => { vi.clearAllMocks(); mocks.staff.mockResolvedValue({ brand: { id: "authorized" } }); });
describe("staff accepted-copy action", () => {
  it("takes brand only from staff auth and refreshes only the staff page", async () => {
    await saveAcceptedCopyAction(form());
    expect(mocks.save).toHaveBeenCalledWith({ brandId: "authorized", quoteId: "quote", source: "backfill" });
    expect(mocks.revalidate.mock.calls).toEqual([["/offers/quote"]]);
  });
  it("requires staff auth on the server", async () => {
    mocks.staff.mockRejectedValue(new Error("Unauthorized"));
    await expect(saveAcceptedCopyAction(form())).rejects.toThrow("Unauthorized"); expect(mocks.save).not.toHaveBeenCalled();
  });
});
