import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cellsFindMany: vi.fn(),
  cellsUpdate: vi.fn(),
  scanUpdate: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    localSeoGridCell: { findMany: mocks.cellsFindMany, update: mocks.cellsUpdate },
    localSeoScan: { update: mocks.scanUpdate },
  },
}));

import { collectReadyLocalSeoTasks } from "./provider";

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.cellsFindMany
    .mockResolvedValueOnce([{ id: "cell-1", providerTaskId: "task-1", scanId: "scan-1" }])
    .mockResolvedValueOnce([{ status: "complete" }]);
  mocks.cellsUpdate.mockResolvedValue({});
  mocks.scanUpdate.mockResolvedValue({});
  process.env.DATAFORSEO_LOGIN = "test-login";
  process.env.DATAFORSEO_PASSWORD = "test-password";
  vi.stubGlobal(
    "fetch",
    vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status_code: 20000,
        tasks: [{ result: [{ id: "task-1", endpoint_advanced: "/v3/serp/google/maps/task_get/advanced/task-1" }] }],
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status_code: 20000,
        tasks: [{
          status_code: 20000,
          cost: 0.0006,
          result: [{ items: [{ type: "maps_search", title: "Bookkeeping Conroe", rank_group: 1, phone: "9362834346" }] }],
        }],
      }))),
  );
});

describe("collectReadyLocalSeoTasks cost accounting", () => {
  it("does not add the echoed task_get cost a second time", async () => {
    await expect(collectReadyLocalSeoTasks()).resolves.toEqual({ completed: 1, failed: 0 });

    expect(mocks.scanUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.scanUpdate.mock.calls[0][0].data).not.toHaveProperty("actualCostUsd");
    expect(fetch).toHaveBeenNthCalledWith(1, "https://api.dataforseo.com/v3/serp/google/maps/tasks_ready", expect.anything());
    expect(fetch).toHaveBeenNthCalledWith(2, "https://api.dataforseo.com/v3/serp/google/maps/task_get/advanced/task-1", expect.anything());
  });
});
