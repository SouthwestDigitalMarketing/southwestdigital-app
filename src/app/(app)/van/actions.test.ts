import { beforeEach, describe, expect, it, vi } from "vitest";
import { starterPlan } from "@/lib/van/starter";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), transaction: vi.fn(), revalidate: vi.fn(),
  lock: vi.fn(), find: vi.fn(), update: vi.fn(), upsert: vi.fn(),
}));
vi.mock("@/lib/brands/staff", () => ({ requireStaffBrandOrThrow: mocks.auth }));
vi.mock("@/lib/tenancy/context", () => ({ withBrandDataTransaction: mocks.transaction }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { changeVanAction, startVanAction } from "./actions";

const context = { brandId: "brand-a", actorUserId: "staff-a" };
const tx = { $queryRaw: mocks.lock, vanHunt: { findUniqueOrThrow: mocks.find, update: mocks.update, upsert: mocks.upsert } };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ dataContext: context });
  mocks.transaction.mockImplementation(async (_context, operation) => operation(tx));
  mocks.lock.mockResolvedValue([{ id: "hunt-a" }]);
  mocks.update.mockResolvedValue({});
  mocks.upsert.mockResolvedValue({});
});

describe("Van server actions (isolated mocks, no database)", () => {
  it("requires staff authorization before creating or changing a hunt", async () => {
    mocks.auth.mockRejectedValue(new Error("Unauthorized"));
    await expect(startVanAction("shortlist")).rejects.toThrow("Unauthorized");
    await expect(changeVanAction({ kind: "remove" })).rejects.toThrow("Unauthorized");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("starts only the authorized brand and never overwrites an existing hunt", async () => {
    expect(await startVanAction("shortlist")).toEqual({});
    expect(mocks.transaction.mock.calls[0][0]).toBe(context);
    const data = mocks.upsert.mock.calls[0][0];
    expect(data.where).toEqual({ brandId: "brand-a" });
    expect(data.create.brandId).toBe("brand-a");
    expect(data.create.plan.sections.candidates).toHaveLength(5);
    expect(data.update).toEqual({});
    expect(mocks.revalidate).toHaveBeenCalledWith("/van");
  });
  it("supports an empty candidate list with needs and costs", async () => {
    expect(await startVanAction("empty")).toEqual({});
    expect(mocks.upsert.mock.calls[0][0].create.plan.sections.candidates).toEqual([]);
  });
  it("locks the authorized brand before loading and changing the latest plan", async () => {
    const plan = starterPlan();
    mocks.find.mockResolvedValue({ id: "hunt-a", plan });
    expect(await changeVanAction({ kind: "status", id: plan.sections.candidates[0].id, status: "Asked seller", brandId: "brand-b" })).toEqual({});
    expect(mocks.transaction.mock.calls[0][0]).toBe(context);
    const [sql, brand] = mocks.lock.mock.calls[0];
    expect(sql.join("?")).toContain('WHERE "brandId" = ? FOR UPDATE');
    expect(brand).toBe("brand-a");
    expect(mocks.find).toHaveBeenCalledWith({ where: { id: "hunt-a" } });
    expect(mocks.update.mock.calls[0][0].data.plan.sections.candidates[0].status).toBe("Asked seller");
    expect(mocks.update.mock.calls[0][0].data.plan.sections.candidates.slice(1)).toEqual(plan.sections.candidates.slice(1));
  });
  it("does not write when the brand has no hunt", async () => {
    mocks.lock.mockResolvedValue([]);
    expect(await changeVanAction({})).toEqual({ error: "Start a van hunt first." });
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects malformed client changes without a write", async () => {
    mocks.find.mockResolvedValue({ id: "hunt-a", plan: starterPlan() });
    expect(await changeVanAction({ kind: "check", key: "price", done: true })).toHaveProperty("error");
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("returns a useful error if a van was removed in another tab", async () => {
    const plan = starterPlan();
    mocks.find.mockResolvedValue({ id: "hunt-a", plan: { sections: { ...plan.sections, candidates: [] } } });
    expect(await changeVanAction({ kind: "status", id: plan.sections.candidates[0].id, status: "Bought" })).toEqual({ error: "That van no longer exists." });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
