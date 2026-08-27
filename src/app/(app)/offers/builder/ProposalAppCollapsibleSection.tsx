"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { readStoredExpandAllPreference } from "./ProposalAppExpandAllControl";

export type ProposalAppCollapsibleForceSignal = {
  value: boolean;
  token: number;
};

export default function ProposalAppCollapsibleSection({
  title,
  children,
  defaultOpen = false,
  forceOpen,
  bodyClassName = "px-5 pb-7 pt-3",
  titleClassName = "text-lg font-semibold tracking-tight text-slate-900",
  headerMeta,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  forceOpen?: ProposalAppCollapsibleForceSignal;
  bodyClassName?: string;
  titleClassName?: string;
  headerMeta?: ReactNode;
}) {
  const [open, setOpen] = useState(() =>
    forceOpen ? readStoredExpandAllPreference() : defaultOpen,
  );
  const [lastForceToken, setLastForceToken] = useState(forceOpen?.token);

  if (forceOpen && forceOpen.token !== lastForceToken) {
    setLastForceToken(forceOpen.token);
    setOpen(forceOpen.value);
  }

  return (
    <div className="proposal-builder-section">
      <div className="flex w-full items-center justify-between gap-4 px-5 py-6 text-left">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="flex min-w-0 items-center gap-3"
          aria-expanded={open}
        >
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
          <span className={titleClassName}>{title}</span>
        </button>

        {headerMeta ? <div className="shrink-0">{headerMeta}</div> : null}
      </div>

      {open ? <div className={bodyClassName}>{children}</div> : null}
    </div>
  );
}
