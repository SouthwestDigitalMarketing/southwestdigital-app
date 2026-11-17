import "server-only";

import { prisma } from "@/lib/prisma";
import { dataForSeoApiUrl } from "./api-path";
import { parseMapResults, type MapItem } from "./grid";

type ProviderTask = { id?: string; status_code?: number; status_message?: string; cost?: number; data?: { tag?: string }; result?: Array<{ items?: MapItem[] }> | null };

function authHeader() {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) throw new Error("DataForSEO credentials are not configured.");
  return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
}

async function api(path: string, init: RequestInit = {}) {
  const response = await fetch(dataForSeoApiUrl(path), {
    ...init,
    headers: { Authorization: authHeader(), "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body || body.status_code !== 20000) {
    throw new Error(`DataForSEO request failed (${response.status}): ${body?.status_message ?? "invalid response"}`);
  }
  return body as { cost?: number; tasks?: ProviderTask[] };
}

function params(cell: { id: string; keyword: string; latitude: number; longitude: number }) {
  return {
    keyword: cell.keyword,
    language_code: "en",
    location_coordinate: `${cell.latitude},${cell.longitude},15z`,
    depth: 20,
    search_this_area: true,
    search_places: false,
    tag: cell.id,
  };
}

async function finishCell(cellId: string, task: ProviderTask) {
  if (!task.status_code || task.status_code >= 40000 || !task.result?.[0]) {
    await prisma.localSeoGridCell.update({
      where: { id: cellId },
      data: { status: "failed", error: task.status_message ?? "DataForSEO returned no results." },
    });
    return false;
  }
  const parsed = parseMapResults(task.result[0].items);
  await prisma.localSeoGridCell.update({
    where: { id: cellId },
    data: { status: "complete", rank: parsed.rank, competitors: parsed.competitors, error: null },
  });
  return true;
}

async function updateScanStatus(scanId: string, costDelta = 0) {
  const cells = await prisma.localSeoGridCell.findMany({ where: { scanId }, select: { status: true } });
  const pending = cells.some((cell) => cell.status === "queued");
  const failures = cells.some((cell) => cell.status === "failed");
  const status = pending ? "queued" : failures ? "partial" : "complete";
  await prisma.localSeoScan.update({
    where: { id: scanId },
    data: {
      status,
      actualCostUsd: { increment: costDelta },
      ...(pending ? {} : { completedAt: new Date() }),
    },
  });
}

export async function startLocalSeoScan(input: {
  brandId: string;
  source: "manual" | "weekly";
  scheduleKey?: string;
  settings: { gridSize: number; spacingMiles: number; keywords: string[] };
  points: Array<{ row: number; column: number; latitude: number; longitude: number }>;
  estimatedCostUsd: number;
  method: "standard" | "live";
}) {
  const scan = await prisma.localSeoScan.create({
    data: {
      brandId: input.brandId,
      source: input.source,
      scheduleKey: input.scheduleKey,
      status: "queued",
      gridSize: input.settings.gridSize,
      spacingMiles: input.settings.spacingMiles,
      keywords: input.settings.keywords,
      estimatedCostUsd: input.estimatedCostUsd,
      cells: {
        create: input.settings.keywords.flatMap((keyword) => input.points.map((point) => ({ keyword, ...point }))),
      },
    },
    include: { cells: true },
  });
  console.info("Local SEO scan cost estimate", {
    scanId: scan.id,
    method: input.method,
    serpCount: scan.cells.length,
    estimatedCostUsd: input.estimatedCostUsd,
  });

  try {
    if (input.method === "standard") {
      for (let offset = 0; offset < scan.cells.length; offset += 100) {
        const batch = scan.cells.slice(offset, offset + 100);
        const response = await api("/task_post", {
          method: "POST",
          body: JSON.stringify(batch.map((cell) => params(cell))),
        });
        const batchCost = response.cost ?? response.tasks?.reduce((sum, task) => sum + (task.cost ?? 0), 0) ?? 0;
        if (batchCost) await prisma.localSeoScan.update({ where: { id: scan.id }, data: { actualCostUsd: { increment: batchCost } } });
        const tasks = response.tasks ?? [];
        const byTag = new Map(tasks.map((task) => [task.data?.tag, task]));
        await Promise.all(batch.map(async (cell) => {
          const task = byTag.get(cell.id);
          if (task?.id && task.status_code && task.status_code < 40000) {
            await prisma.localSeoGridCell.update({ where: { id: cell.id }, data: { providerTaskId: task.id } });
          } else {
            await prisma.localSeoGridCell.update({
              where: { id: cell.id },
              data: { status: "failed", error: task?.status_message ?? "DataForSEO did not accept the task." },
            });
          }
        }));
      }
      await updateScanStatus(scan.id);
    } else {
      for (let offset = 0; offset < scan.cells.length; offset += 100) {
        const batch = scan.cells.slice(offset, offset + 100);
        const response = await api("/live/advanced", {
          method: "POST",
          body: JSON.stringify(batch.map((cell) => params(cell))),
        });
        const batchCost = response.cost ?? response.tasks?.reduce((sum, task) => sum + (task.cost ?? 0), 0) ?? 0;
        if (batchCost) await prisma.localSeoScan.update({ where: { id: scan.id }, data: { actualCostUsd: { increment: batchCost } } });
        const tasks = response.tasks ?? [];
        const byTag = new Map(tasks.map((task) => [task.data?.tag, task]));
        await Promise.all(batch.map(async (cell) => {
          const task = byTag.get(cell.id);
          if (task) await finishCell(cell.id, task);
          else await prisma.localSeoGridCell.update({
            where: { id: cell.id }, data: { status: "failed", error: "No result returned for this grid point." },
          });
        }));
      }
      await updateScanStatus(scan.id);
    }
    return scan;
  } catch (error) {
    const message = error instanceof Error ? error.message : "DataForSEO scan failed.";
    await prisma.localSeoScan.update({ where: { id: scan.id }, data: { status: "failed", error: message, completedAt: new Date() } });
    await prisma.localSeoGridCell.updateMany({ where: { scanId: scan.id, status: "queued" }, data: { status: "failed", error: message } });
    throw error;
  }
}

export async function collectReadyLocalSeoTasks() {
  const pending = await prisma.localSeoGridCell.findMany({
    where: { status: "queued", providerTaskId: { not: null } },
    select: { id: true, providerTaskId: true, scanId: true },
  });
  if (!pending.length) return { completed: 0, failed: 0 };
  const readyResponse = await api("/tasks_ready");
  const ready = new Map<string, string>();
  for (const task of readyResponse.tasks ?? []) {
    for (const item of (task.result ?? []) as Array<{ id?: string; endpoint_advanced?: string }>) {
      if (item.id && item.endpoint_advanced) ready.set(item.id, item.endpoint_advanced);
    }
  }
  let completed = 0;
  let failed = 0;
  const costs = new Map<string, number>();
  for (let offset = 0; offset < pending.length; offset += 10) {
    const batch = pending.slice(offset, offset + 10).filter((cell) => ready.has(cell.providerTaskId!));
    await Promise.all(batch.map(async (cell) => {
      try {
        const endpoint = ready.get(cell.providerTaskId!)!;
        const result = await api(endpoint.startsWith("/") ? endpoint : `/${endpoint}`);
        const task = result.tasks?.[0];
        const ok = task ? await finishCell(cell.id, task) : false;
        if (ok) completed += 1;
        else failed += 1;
        if (task?.cost) costs.set(cell.scanId, (costs.get(cell.scanId) ?? 0) + task.cost);
      } catch (error) {
        failed += 1;
        await prisma.localSeoGridCell.update({
          where: { id: cell.id },
          data: { status: "failed", error: error instanceof Error ? error.message : "Could not read result." },
        });
      }
    }));
  }
  const scanIds = new Set(pending.map((cell) => cell.scanId));
  for (const scanId of scanIds) await updateScanStatus(scanId, costs.get(scanId) ?? 0);
  return { completed, failed };
}
