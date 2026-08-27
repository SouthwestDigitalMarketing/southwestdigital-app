"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { setContactBrandAction, setContactClientAction } from "./actions";

type Item = { id: string; label: string };

function AssignmentPicker({
  items,
  assignedIds,
  empty,
  pending,
  onToggle,
}: {
  items: Item[];
  assignedIds: string[];
  empty: string;
  pending: boolean;
  onToggle: (id: string, assigned: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const assigned = new Set(assignedIds);
  const selected = items.filter((item) => assigned.has(item.id));

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className={`relative min-w-0 ${pending ? "opacity-60" : ""}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title={selected.map((item) => item.label).join(", ") || empty}
        className="flex w-full min-w-0 items-center gap-1 rounded-md px-1 py-0.5 text-left hover:bg-slate-100"
      >
        <span className="min-w-0 flex-1 overflow-hidden whitespace-nowrap">
          {selected.length === 0 ? (
            <span className="text-xs text-slate-400">{empty}</span>
          ) : (
            selected.map((item) => (
              <span
                key={item.id}
                className="mr-1 inline-flex max-w-[9rem] truncate rounded-full bg-slate-100 px-2 py-0.5 align-middle text-[11px] font-medium text-slate-700"
              >
                {item.label}
              </span>
            ))
          )}
        </span>
        <ChevronDown size={12} className="shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {items.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">Nothing to assign yet.</p>
          ) : (
            items.map((item) => {
              const on = assigned.has(item.id);
              return (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => onToggle(item.id, !on)}
                    className="h-3.5 w-3.5 rounded border-slate-300"
                  />
                  <span className="truncate">{item.label}</span>
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export function ClientAssignment({
  contactId,
  clients,
  assignedIds,
}: {
  contactId: string;
  clients: Item[];
  assignedIds: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <AssignmentPicker
      items={clients}
      assignedIds={assignedIds}
      empty="Assign"
      pending={pending}
      onToggle={(clientId, assigned) => {
        const data = new FormData();
        data.set("contactId", contactId);
        data.set("clientId", clientId);
        data.set("assigned", assigned ? "1" : "0");
        startTransition(async () => {
          await setContactClientAction(data);
          router.refresh();
        });
      }}
    />
  );
}

export function BrandAssignment({
  contactId,
  brands,
  assignedIds,
}: {
  contactId: string;
  brands: Item[];
  assignedIds: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <AssignmentPicker
      items={brands}
      assignedIds={assignedIds}
      empty="Assign"
      pending={pending}
      onToggle={(relatedBrandId, assigned) => {
        const data = new FormData();
        data.set("contactId", contactId);
        data.set("relatedBrandId", relatedBrandId);
        data.set("assigned", assigned ? "1" : "0");
        startTransition(async () => {
          await setContactBrandAction(data);
          router.refresh();
        });
      }}
    />
  );
}
