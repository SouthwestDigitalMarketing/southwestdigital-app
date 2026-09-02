"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Pencil, Plus, X, Check } from "lucide-react";
import {
  DISCOUNT_KINDS,
  discountKindLabel,
  formatDiscountSchedule,
  type DiscountDeadlineMode,
  type DiscountKind,
} from "@/lib/discounts/kinds";
import {
  archiveBrandDiscountAction,
  createBrandDiscountAction,
  restoreBrandDiscountAction,
  updateBrandDiscountAction,
} from "./actions";

export type DiscountRow = {
  id: string;
  name: string;
  kind: string;
  percent: number;
  amount: number;
  title: string;
  details: string;
  activationMode: string;
  activationDelayDays: number;
  deadlineMode: string;
  durationDays: number;
  deadlineDate: string | null;
  active: boolean;
};

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brandnavy focus:ring-2 focus:ring-brandnavy/20";
const labelClass = "block text-sm font-semibold text-slate-700";

export function DiscountsCatalog({ discounts }: { discounts: DiscountRow[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<void>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
        after?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save this discount.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      {discounts.length === 0 && editingId !== "new" ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-500">No discounts yet.</p>
          <p className="mt-1 text-sm text-slate-400">
            Create a discount, then choose whether it shows the first time they open the proposal.
          </p>
        </div>
      ) : null}

      {discounts.map((discount) =>
        editingId === discount.id ? (
          <DiscountForm
            key={discount.id}
            discount={discount}
            pending={pending}
            onCancel={() => setEditingId(null)}
            onSave={(formData) =>
              run(() => updateBrandDiscountAction(discount.id, formData), () => setEditingId(null))
            }
          />
        ) : (
          <DiscountCard
            key={discount.id}
            discount={discount}
            pending={pending}
            onEdit={() => setEditingId(discount.id)}
            onArchive={() => run(() => archiveBrandDiscountAction(discount.id))}
            onRestore={() => run(() => restoreBrandDiscountAction(discount.id))}
          />
        ),
      )}

      {editingId === "new" ? (
        <DiscountForm
          pending={pending}
          onCancel={() => setEditingId(null)}
          onSave={(formData) =>
            run(() => createBrandDiscountAction(formData), () => setEditingId(null))
          }
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditingId("new")}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-3 text-sm font-semibold text-slate-500 transition hover:border-slate-400 hover:text-slate-700"
        >
          <Plus className="h-4 w-4" />
          Create discount
        </button>
      )}
    </div>
  );
}

function DiscountCard({
  discount,
  pending,
  onEdit,
  onArchive,
  onRestore,
}: {
  discount: DiscountRow;
  pending: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const schedule = formatDiscountSchedule(discount);

  return (
    <div className={`rounded-xl border bg-white px-5 py-4 ${discount.active ? "border-slate-200" : "border-slate-200 opacity-60"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {discountKindLabel(discount.kind)}
            {discount.active ? "" : " · Archived"}
          </p>
          <p className="mt-0.5 truncate text-base font-semibold text-slate-900">{discount.name}</p>
          <p className="mt-1 text-sm text-slate-500">{schedule}.</p>
          {discount.title ? <p className="mt-1 text-sm text-slate-700">{discount.title}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            disabled={pending}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:text-slate-800 disabled:opacity-40"
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </button>
          {discount.active ? (
            <button
              type="button"
              onClick={onArchive}
              disabled={pending}
              className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:text-rose-600 disabled:opacity-40"
              title="Archive"
            >
              <Archive className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onRestore}
              disabled={pending}
              className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:text-slate-800 disabled:opacity-40"
              title="Restore"
            >
              <ArchiveRestore className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DiscountForm({
  discount,
  pending,
  onSave,
  onCancel,
}: {
  discount?: DiscountRow;
  pending: boolean;
  onSave: (formData: FormData) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<DiscountKind>((discount?.kind as DiscountKind) ?? "bonus");
  const [showOnFirstOpen, setShowOnFirstOpen] = useState(discount?.activationMode === "immediate");
  const [deadlineMode, setDeadlineMode] = useState<DiscountDeadlineMode>(
    discount?.deadlineMode === "date" ? "date" : "relative",
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave(new FormData(event.currentTarget));
      }}
      className="space-y-5 rounded-xl border border-slate-200 bg-white p-5"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">{discount ? "Edit discount" : "New discount"}</p>
        <button type="button" onClick={onCancel} className="rounded p-1 text-slate-400 hover:text-slate-700">
          <X className="h-4 w-4" />
        </button>
      </div>

      <label className={labelClass}>
        Internal name
        <input
          name="name"
          required
          defaultValue={discount?.name ?? ""}
          className={inputClass}
          placeholder="e.g. September start bonus"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className={labelClass}>
          Type of benefit
          <select
            name="kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as DiscountKind)}
            className={inputClass}
          >
            {DISCOUNT_KINDS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {kind === "percent-off" ? (
          <label className={labelClass}>
            Percent off
            <div className="relative mt-1">
              <input
                name="percent"
                type="number"
                min={1}
                max={100}
                defaultValue={discount?.percent ?? 10}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm text-slate-900 outline-none focus:border-brandnavy focus:ring-2 focus:ring-brandnavy/20"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 inline-flex items-center text-sm font-semibold text-slate-400">
                %
              </span>
            </div>
          </label>
        ) : kind === "amount-off" ? (
          <label className={labelClass}>
            Amount off
            <div className="relative mt-1">
              <span className="pointer-events-none absolute inset-y-0 left-3 inline-flex items-center text-sm font-semibold text-slate-400">
                $
              </span>
              <input
                name="amount"
                type="number"
                min={1}
                defaultValue={discount?.amount ?? 250}
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm text-slate-900 outline-none focus:border-brandnavy focus:ring-2 focus:ring-brandnavy/20"
              />
            </div>
          </label>
        ) : (
          <div />
        )}
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          name="showOnFirstOpen"
          value="on"
          checked={showOnFirstOpen}
          onChange={(event) => setShowOnFirstOpen(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brandnavy focus:ring-brandnavy"
        />
        <span>
          <span className="block">Show when the lead first opens the proposal</span>
          <span className="mt-0.5 block text-xs font-normal text-slate-500">
            Off: this stays hidden. Turn it on later when you want it on the proposal, including ones already sent.
          </span>
        </span>
      </label>
      <input type="hidden" name="activationMode" value={showOnFirstOpen ? "immediate" : "held"} />

      <div className="grid gap-4 md:grid-cols-2">
        <label className={labelClass}>
          Once shown, keep it available for
          <div className="relative mt-1">
            <input
              name="durationDays"
              type="number"
              min={1}
              max={365}
              defaultValue={discount?.durationDays ?? 14}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-14 text-sm text-slate-900 outline-none focus:border-brandnavy focus:ring-2 focus:ring-brandnavy/20"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 inline-flex items-center text-sm font-semibold text-slate-400">
              days
            </span>
          </div>
        </label>
        <label className={labelClass}>
          Or until this date
          <span className="ml-2 font-normal text-slate-400">optional</span>
          <input
            name="deadlineDate"
            type="date"
            defaultValue={discount?.deadlineDate ?? ""}
            onChange={(event) => setDeadlineMode(event.target.value ? "date" : "relative")}
            className={inputClass}
          />
        </label>
      </div>
      <input type="hidden" name="deadlineMode" value={deadlineMode} />

      {kind !== "percent-off" ? <input type="hidden" name="percent" value={discount?.percent ?? 10} /> : null}
      {kind !== "amount-off" ? <input type="hidden" name="amount" value={discount?.amount ?? 250} /> : null}

      <label className={labelClass}>
        Headline
        <span className="ml-2 font-normal text-slate-400">shown to the lead</span>
        <input
          name="title"
          defaultValue={discount?.title ?? ""}
          placeholder="e.g. First monthly close included"
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        What they receive if they start in time
        <textarea
          name="details"
          rows={3}
          defaultValue={discount?.details ?? ""}
          placeholder="Be specific. Name the extra, discount, or waived fee."
          className={`${inputClass} min-h-[84px] resize-y`}
        />
      </label>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {discount ? "Save" : "Create"}
        </button>
      </div>
    </form>
  );
}
