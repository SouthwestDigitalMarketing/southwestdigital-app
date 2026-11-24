"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { SEO_PLAN, SEO_PLAN_AS_OF, SEO_PLAN_STATUS_LABEL, type SeoPlanStatus } from "@/lib/localSeo/seoPlan";

const statusStyle: Record<SeoPlanStatus, { mark: string; chip: string }> = {
  done: { mark: "border-emerald-500 bg-emerald-500 text-white", chip: "bg-emerald-50 text-emerald-700" },
  ongoing: { mark: "border-sky-400 bg-sky-50 text-sky-600", chip: "bg-sky-50 text-sky-700" },
  waiting: { mark: "border-amber-400 bg-amber-50 text-amber-600", chip: "bg-amber-50 text-amber-800" },
  check: { mark: "border-violet-400 bg-violet-50 text-violet-600", chip: "bg-violet-50 text-violet-700" },
  todo: { mark: "border-slate-300 bg-white text-transparent", chip: "bg-slate-100 text-slate-600" },
};

const allItems = SEO_PLAN.flatMap((section) => section.items);
const doneCount = allItems.filter((item) => item.status === "done").length;

/** Text link that opens the Chris Palmer SEO plan as a checklist; tap a line for its details. */
export function SeoPlanChecklist() {
  const [open, setOpen] = useState(false);
  const [openItem, setOpenItem] = useState<string | null>(null);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-800">
        SEO plan checklist · {doneCount} of {allItems.length} done
      </button>
      {open ? (
        <Modal onClose={() => setOpen(false)} labelledBy="seo-plan-title" className="max-w-xl">
          <div className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="seo-plan-title" className="text-lg font-semibold text-slate-900">SEO plan checklist</h2>
                <p className="mt-1 text-xs text-slate-500">Chris Palmer study · {doneCount} of {allItems.length} done · as of {SEO_PLAN_AS_OF} · tap a line for details</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100" aria-label="Close">✕</button>
            </div>
            {SEO_PLAN.map((section) => (
              <section key={section.title} className="mt-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{section.title}</h3>
                <ul className="mt-1 divide-y divide-slate-100">
                  {section.items.map((item) => {
                    const key = `${section.title}:${item.title}`;
                    const expanded = openItem === key;
                    const style = statusStyle[item.status];
                    return (
                      <li key={key}>
                        <button type="button" onClick={() => setOpenItem(expanded ? null : key)} aria-expanded={expanded} className="flex w-full items-center gap-3 py-2 text-left">
                          <span aria-hidden className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] leading-none ${style.mark}`}>✓</span>
                          <span className={`min-w-0 flex-1 truncate text-sm ${item.status === "done" ? "text-slate-500" : "text-slate-900"}`}>{item.title}</span>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${style.chip}`}>{SEO_PLAN_STATUS_LABEL[item.status]}</span>
                        </button>
                        {expanded ? (
                          <div className="relative mb-2 ml-7 rounded-lg bg-slate-900 px-3 py-2 text-xs leading-5 text-slate-100 shadow-lg">
                            <span aria-hidden className="absolute -top-1 left-4 h-2 w-2 rotate-45 bg-slate-900" />
                            <p>{item.what}</p>
                            {item.next ? <p className="mt-1"><span className="font-semibold text-white">Next: </span>{item.next}</p> : null}
                            {item.blocker ? <p className="mt-1 text-amber-200"><span className="font-semibold">Blocked by: </span>{item.blocker}</p> : null}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </Modal>
      ) : null}
    </>
  );
}
