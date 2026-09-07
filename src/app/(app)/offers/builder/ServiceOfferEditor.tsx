"use client";

import { useState } from "react";
import Link from "next/link";
import type { AssessmentState } from "./ProposalCreationWorkspaceDemo";
import { normalizeTierPackageIds, TIER_ORDER } from "./proposalTierRanges";
import { servicePackageIds } from "@/lib/quotes/proposalServices";
import {
  resolveProposalPackageName,
  type PackageId,
} from "./proposalPackageNames";
import type { ServiceConfiguration } from "./proposalServiceConfiguration";

const CONTROL =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brandnavy";

export default function ServiceOfferEditor({
  name,
  description,
  initial,
  names,
  catalogHref,
  onApply,
  onCancel,
}: {
  name: string;
  description: string;
  initial: ServiceConfiguration;
  names: AssessmentState["packageNames"];
  catalogHref?: string;
  onApply: (config: ServiceConfiguration) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [price, setPrice] = useState(String(initial.price));
  const validPrice =
    price.trim() !== "" && Number.isFinite(Number(price)) && Number(price) >= 0;
  return (
    <form
      aria-label={`Configure ${name} for this offer`}
      onSubmit={(event) => {
        event.preventDefault();
        if (draft.optional.length > 0 && !validPrice) return;
        onApply({
          ...draft,
          price: validPrice ? Number(price) : initial.price,
        });
      }}
      className="space-y-5 rounded-xl border border-brandnavy/15 bg-slate-50 p-4 sm:p-5"
    >
      <div>
        <h3 className="font-semibold text-slate-900">{name}</h3>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
        <p className="mt-2 text-xs font-medium text-brandnavy">
          Settings for this offer
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Included at no extra charge
          <TierRangeControl
            label={`Included in ${name}`}
            value={draft.included}
            names={names}
            onChange={(included) =>
              setDraft((saved) => ({
                ...saved,
                included,
                optional: saved.optional.filter((id) => !included.includes(id)),
              }))
            }
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Available to purchase separately
          <TierRangeControl
            label={`Optional in ${name}`}
            value={draft.optional}
            excluded={draft.included}
            names={names}
            onChange={(optional) =>
              setDraft((saved) => ({ ...saved, optional }))
            }
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Service frequency
          <select
            className={CONTROL}
            value={draft.cadence}
            onChange={(event) =>
              setDraft((saved) => ({
                ...saved,
                cadence: event.target.value as ServiceConfiguration["cadence"],
              }))
            }
          >
            <option value="monthly">Recurring monthly</option>
            <option value="one-time">One-time work</option>
          </select>
        </label>
        {draft.optional.length > 0 ? (
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Add-on price (${" "}
            {draft.cadence === "monthly" ? "per month" : "one time"})
            <input
              required
              type="number"
              min="0"
              step="0.01"
              className={CONTROL}
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
            <span className="text-xs font-normal text-slate-500">
              Only charged if the client selects this add-on.
            </span>
          </label>
        ) : (
          <p className="self-center text-sm text-slate-500">
            No separate charge. Package base prices stay unchanged.
          </p>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={draft.visible}
          onChange={(event) =>
            setDraft((saved) => ({ ...saved, visible: event.target.checked }))
          }
        />
        Show this service in the offer
      </label>
      {!draft.included.length && !draft.optional.length ? (
        <p className="text-sm text-amber-800">
          This service is not assigned to any package.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        {catalogHref ? (
          <Link
            href={catalogHref}
            className="text-xs text-slate-500 underline underline-offset-4"
          >
            Edit shared catalogue definition
          </Link>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={draft.optional.length > 0 && !validPrice}
            className="rounded-lg bg-brandnavy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Apply changes
          </button>
        </div>
      </div>
    </form>
  );
}

export function TierRangeControl({
  label,
  value,
  names,
  excluded = [],
  onChange,
}: {
  label: string;
  value: PackageId[];
  names: AssessmentState["packageNames"];
  excluded?: PackageId[];
  onChange: (packages: PackageId[]) => void;
}) {
  const ranges = TIER_ORDER.flatMap((_, start) =>
    TIER_ORDER.slice(start).map((to) =>
      TIER_ORDER.slice(start, TIER_ORDER.indexOf(to) + 1),
    ),
  ).filter((range) => range.every((id) => !excluded.includes(id)));
  const selected = normalizeTierPackageIds(value).join(",");
  const custom =
    selected !== "" && !ranges.some((range) => range.join(",") === selected);
  const name = (id: PackageId) => resolveProposalPackageName(names, id);
  return (
    <select
      aria-label={label}
      className={CONTROL}
      value={selected}
      onChange={(event) =>
        onChange(servicePackageIds(event.target.value.split(",")))
      }
    >
      <option value="">None</option>
      {custom ? (
        <option value={selected} disabled>
          Custom: {value.map(name).join(" + ")} (saved)
        </option>
      ) : null}
      {ranges.map((range) => (
        <option key={range.join(",")} value={range.join(",")}>
          {range.length === 1
            ? name(range[0])
            : `${name(range[0])} through ${name(range[range.length - 1])}`}
        </option>
      ))}
    </select>
  );
}
