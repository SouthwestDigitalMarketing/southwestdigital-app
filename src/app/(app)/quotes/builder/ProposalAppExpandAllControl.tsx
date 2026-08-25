"use client";

import { useState } from "react";

export const EXPAND_ALL_STORAGE_KEY = "proposal-app-demo-expand-all-v1";

export function readStoredExpandAllPreference(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(EXPAND_ALL_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeStoredExpandAllPreference(expanded: boolean) {
  try {
    window.localStorage.setItem(EXPAND_ALL_STORAGE_KEY, String(expanded));
  } catch {
    // Ignore localStorage failures in demo mode.
  }
}

export default function ProposalAppExpandAllControl({
  onExpandAll,
  onCollapseAll,
}: {
  onExpandAll: () => void;
  onCollapseAll: () => void;
}) {
  const [expanded, setExpanded] = useState(() => readStoredExpandAllPreference());

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    writeStoredExpandAllPreference(next);
    if (next) {
      onExpandAll();
    } else {
      onCollapseAll();
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="text-sm font-semibold text-slate-500 transition hover:text-slate-900"
    >
      {expanded ? "Collapse All" : "Expand All"}
    </button>
  );
}
