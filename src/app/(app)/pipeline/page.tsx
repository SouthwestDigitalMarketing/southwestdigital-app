import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffBrand } from "@/lib/brands/staff";
import { createPipelineAction, createStarterPipelinesAction } from "./actions";

type SearchParams = Promise<{
  created?: string;
  error?: string;
}>;

const ghost =
  "inline-flex h-9 cursor-pointer items-center rounded-full border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const primary =
  "inline-flex h-9 cursor-pointer items-center rounded-full bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50";
const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-slate-500 focus:outline-none";

function errorMessage(code: string) {
  if (code === "name-required") return "Pipeline name is required.";
  if (code === "key-invalid") return "Pipeline key is invalid. Use letters, numbers, and hyphens.";
  return "Unable to create pipeline.";
}

export default async function PipelineIndexPage({ searchParams }: { searchParams: SearchParams }) {
  const { brand } = await requireStaffBrand();
  const params = await searchParams;

  const pipelines = await prisma.pipeline.findMany({
    where: { brandId: brand.id },
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    include: {
      stages: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      },
      createdBy: {
        select: { user: { select: { name: true, email: true } } },
      },
      _count: { select: { items: true } },
    },
  });

  return (
    <div className="p-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900">CRM Pipelines</h1>
      </div>

      {params.error ? (
        <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage(params.error)}
        </p>
      ) : null}
      {params.created ? (
        <p className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {params.created === "starter"
            ? "Starter pipelines synced (Prospects + Leads + Client Phases 1-2)."
            : "Pipeline created."}
        </p>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">Pipeline purpose</h2>
        <p className="mt-2 text-sm text-slate-700">
          Pipelines track both pre-client and post-conversion progress. Leads and prospects advance to
          conversion, then clients move into Phase 1 onboarding/discovery and later service phases.
        </p>
        <div className="mt-3">
          <form action={createStarterPipelinesAction}>
            <button type="submit" className={ghost}>
              Create/sync starter pipelines
            </button>
          </form>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">Create pipeline</h2>
        <form action={createPipelineAction} className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium text-slate-600">
            Name
            <input name="name" required placeholder="Prospects Pipeline" className={inputClass} />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-600">
            Key <span className="font-normal text-slate-400">(optional; auto-generated from name)</span>
            <input name="key" placeholder="prospects" className={inputClass} />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-600">
            Type
            <select name="type" defaultValue="CUSTOM" className={`${inputClass} bg-white`}>
              <option value="CUSTOM">Custom</option>
              <option value="PROSPECTS">Prospects</option>
              <option value="LEADS">Leads</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-600">
            Stage template
            <select name="template" defaultValue="NONE" className={`${inputClass} bg-white`}>
              <option value="NONE">No template (empty pipeline)</option>
              <option value="PROSPECTS">Prospects template</option>
              <option value="LEADS">Leads template</option>
              <option value="CLIENT_PHASE_1">Client Phase 1 template</option>
              <option value="CLIENT_PHASE_2">Client Phase 2 template</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-600 md:col-span-2">
            Description
            <textarea
              name="description"
              rows={3}
              placeholder="What this pipeline is used for"
              className={inputClass}
            />
          </label>
          <div className="md:col-span-2">
            <button type="submit" className={primary}>
              Create pipeline
            </button>
          </div>
        </form>
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Pipelines ({pipelines.length})
          </p>
        </div>
        {pipelines.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">
            No pipelines yet. Create starter pipelines above or add one manually.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="px-5 py-3.5 text-sm font-semibold normal-case text-slate-700">Pipeline</th>
                <th className="px-5 py-3.5 text-sm font-semibold normal-case text-slate-700">Type</th>
                <th className="px-5 py-3.5 text-sm font-semibold normal-case text-slate-700">Stages</th>
                <th className="px-5 py-3.5 text-sm font-semibold normal-case text-slate-700">Cards</th>
                <th className="px-5 py-3.5 text-sm font-semibold normal-case text-slate-700">Created by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pipelines.map((pipeline, index) => (
                <tr key={pipeline.id} className={index % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                  <td className="px-5 py-4 align-top">
                    <Link href={`/pipeline/${encodeURIComponent(pipeline.key)}`} className="font-semibold text-brandnavy hover:underline">
                      {pipeline.name}
                    </Link>
                    <p className="text-xs text-slate-500">{pipeline.key}</p>
                  </td>
                  <td className="px-5 py-4 align-top text-slate-700">{pipeline.type}</td>
                  <td className="px-5 py-4 align-top text-slate-700">{pipeline.stages.length}</td>
                  <td className="px-5 py-4 align-top text-slate-700">{pipeline._count.items}</td>
                  <td className="px-5 py-4 align-top text-slate-600">
                    {pipeline.createdBy?.user?.name?.trim() ||
                      pipeline.createdBy?.user?.email ||
                      "System"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
