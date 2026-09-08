"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { ChevronDown, ExternalLink, Sparkles } from "lucide-react";
import { Modal } from "@/components/Modal";
import {
  getDefaultOptionsTemplateSnapshotAction,
  getOptionsTemplateSnapshotAction,
  listOptionsTemplatesAction,
  overwriteOptionsTemplateSnapshotAction,
  saveOptionsTemplateAction,
  type OptionsTemplateListItem,
} from "../options-templates/actions";
import type { OptionsTemplateAssessmentSlice } from "@/lib/quotes/optionsTemplates";

const AUTO_APPLY_PREFIX = "swapp:options-template-applied:";

function autoApplyKey(scopeId: string | null) {
  return scopeId ? `${AUTO_APPLY_PREFIX}${scopeId}` : null;
}

function readScopeId(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return (
    params.get("engagementId") ??
    params.get("offer") ??
    params.get("contacts") ??
    params.get("contact") ??
    null
  );
}

export type OptionsTemplatesToolbarProps = {
  currentSlice: OptionsTemplateAssessmentSlice;
  onApply: (slice: OptionsTemplateAssessmentSlice) => void;
  hasCustomizedOptions: boolean;
  middleSlot?: ReactNode;
};

export default function OptionsTemplatesToolbar({
  currentSlice,
  onApply,
  hasCustomizedOptions,
  middleSlot,
}: OptionsTemplatesToolbarProps) {
  const [templates, setTemplates] = useState<OptionsTemplateListItem[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  // Native popover so Escape, light dismiss and focus return come from the
  // browser; the previous panel could only be closed with the mouse.
  const dropdownId = `options-templates-${useId().replaceAll(":", "")}`;
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveMode, setSaveMode] = useState<"new" | "overwrite">("new");
  const [saveTargetId, setSaveTargetId] = useState<string>("");
  const [saveName, setSaveName] = useState("");
  const [saveDescription, setSaveDescription] = useState("");
  const [saveMakeDefault, setSaveMakeDefault] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const autoAppliedRef = useRef(false);

  useEffect(() => {
    if (!dropdownOpen) return;
    // The panel is positioned once on open, so a resize would strand it.
    const close = () => dropdownRef.current?.hidePopover();
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, [dropdownOpen]);

  useEffect(() => {
    let cancelled = false;
    listOptionsTemplatesAction(false)
      .then((rows) => {
        if (!cancelled) setTemplates(rows);
      })
      .catch((e) => {
        if (cancelled) return;
        setTemplates([]);
        setError(e instanceof Error ? `Templates unavailable: ${e.message}` : "Templates unavailable.");
        console.error("[OptionsTemplatesToolbar] listOptionsTemplatesAction failed", e);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (autoAppliedRef.current) return;
    if (hasCustomizedOptions) {
      autoAppliedRef.current = true;
      return;
    }
    const scopeId = readScopeId();
    const key = autoApplyKey(scopeId);
    if (!key) return;
    try {
      if (window.localStorage.getItem(key)) {
        autoAppliedRef.current = true;
        return;
      }
    } catch {
      return;
    }
    autoAppliedRef.current = true;
    getDefaultOptionsTemplateSnapshotAction("bookkeeping")
      .then((result) => {
        if (!result) return;
        onApply(result.slice);
        try {
          window.localStorage.setItem(key, "1");
        } catch {
          // localStorage may be unavailable in private mode — non-fatal.
        }
        const skipped = result.skippedIds.length;
        setStatusMessage(
          skipped > 0
            ? `Applied default template "${result.templateName}" (${skipped} item${skipped === 1 ? "" : "s"} skipped — no longer in catalog).`
            : `Applied default template "${result.templateName}".`,
        );
      })
      .catch(() => {
        // Silent — the toolbar remains available for manual load.
      });
  }, [hasCustomizedOptions, onApply]);

  function loadTemplate(id: string, name: string) {
    dropdownRef.current?.hidePopover();
    setError(null);
    startTransition(async () => {
      try {
        const result = await getOptionsTemplateSnapshotAction(id);
        if (!result) {
          setError("Template not found.");
          return;
        }
        onApply(result.slice);
        const skipped = result.skippedIds.length;
        setStatusMessage(
          skipped > 0
            ? `Loaded "${name}" (${skipped} item${skipped === 1 ? "" : "s"} skipped — no longer in catalog).`
            : `Loaded "${name}".`,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load template.");
      }
    });
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        if (saveMode === "overwrite") {
          if (!saveTargetId) {
            setError("Choose a template to overwrite.");
            return;
          }
          await overwriteOptionsTemplateSnapshotAction(saveTargetId, currentSlice);
          const chosen = templates.find((t) => t.id === saveTargetId);
          setStatusMessage(`Updated "${chosen?.name ?? "template"}".`);
        } else {
          await saveOptionsTemplateAction({
            name: saveName,
            description: saveDescription,
            makeDefault: saveMakeDefault,
            slice: currentSlice,
          });
          setStatusMessage("Template saved.");
        }
        setSaveOpen(false);
        setSaveName("");
        setSaveDescription("");
        setSaveMakeDefault(false);
        setSaveTargetId("");
        const refreshed = await listOptionsTemplatesAction(false);
        setTemplates(refreshed);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save template.");
      }
    });
  }

  const activeTemplates = templates.filter((t) => t.archivedAt === null);
  const defaultTemplate = activeTemplates.find((t) => t.defaultForProductKind === "bookkeeping");

  return (
    <div className="contents">
      <div className="relative">
        <button
          type="button"
          disabled={isPending}
          popoverTarget={dropdownId}
          aria-haspopup="true"
          aria-expanded={dropdownOpen}
          onClick={(event) => {
            const panel = dropdownRef.current;
            if (!panel) return;
            const rect = event.currentTarget.getBoundingClientRect();
            panel.style.minWidth = `${rect.width}px`;
            panel.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8))}px`;
            const below = window.innerHeight - rect.bottom;
            const openBelow = below >= 240 || below >= rect.top;
            panel.style.top = openBelow ? `${rect.bottom + 4}px` : "auto";
            panel.style.bottom = openBelow ? "auto" : `${window.innerHeight - rect.top + 4}px`;
            panel.style.maxHeight = `${Math.max(0, (openBelow ? below : rect.top) - 12)}px`;
          }}
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm font-medium text-slate-700 transition hover:border-slate-500 hover:bg-slate-100 focus-visible:outline-2 disabled:opacity-50"
        >
          <Sparkles className="h-3.5 w-3.5" /> Load template
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <div
          id={dropdownId}
          ref={dropdownRef}
          popover="auto"
          onToggle={(event) => setDropdownOpen(event.newState === "open")}
          aria-label="Load options template"
          className="fixed m-0 w-max max-w-[calc(100vw-2.5rem)] overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
          onMouseLeave={() => dropdownRef.current?.hidePopover()}
        >
          {activeTemplates.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-500">
              No templates yet. Save one below.
            </p>
          ) : (
            activeTemplates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => loadTemplate(t.id, t.name)}
                className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline-2"
              >
                <span className="whitespace-nowrap max-sm:whitespace-normal">{t.name}</span>
                {t.defaultForProductKind ? (
                  <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Default
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>
      </div>

      {middleSlot}

      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setSaveName("");
          setSaveDescription("");
          setSaveMakeDefault(false);
          setSaveMode(activeTemplates.length > 0 ? "overwrite" : "new");
          setSaveTargetId(activeTemplates[0]?.id ?? "");
          setSaveOpen(true);
        }}
        className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm font-medium text-slate-700 transition hover:border-slate-500 hover:bg-slate-100 disabled:opacity-50"
      >
        Save as template
      </button>

      <Link
        href="/offers/options-templates"
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        Manage templates <ExternalLink className="h-3 w-3" />
      </Link>

      {statusMessage ? (
        <span className="text-xs text-emerald-700">{statusMessage}</span>
      ) : null}
      {error ? <span className="text-xs text-red-700">{error}</span> : null}

      {saveOpen ? (
        <Modal open onClose={() => setSaveOpen(false)} label="Save options template">
          <div className="space-y-4 p-5">
            <h2 className="text-lg font-semibold text-slate-900">Save options template</h2>
            <p className="text-sm text-slate-600">
              Captures the current Options step configuration. Catalog items are referenced by key, so missing items are skipped when the template is loaded later.
            </p>
            {activeTemplates.length > 0 ? (
              <fieldset className="rounded-md border border-slate-200 p-3 text-sm">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Mode
                </legend>
                <label className="mt-1 flex items-start gap-2">
                  <input
                    type="radio"
                    name="save-mode"
                    checked={saveMode === "overwrite"}
                    onChange={() => setSaveMode("overwrite")}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-semibold text-slate-800">Update existing template</span>
                    <span className="block text-xs text-slate-500">
                      Overwrite the contents of a template you already saved.
                    </span>
                  </span>
                </label>
                <label className="mt-2 flex items-start gap-2">
                  <input
                    type="radio"
                    name="save-mode"
                    checked={saveMode === "new"}
                    onChange={() => setSaveMode("new")}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-semibold text-slate-800">Save as new template</span>
                    <span className="block text-xs text-slate-500">
                      Create a new template alongside your existing ones.
                    </span>
                  </span>
                </label>
              </fieldset>
            ) : null}
            {saveMode === "overwrite" && activeTemplates.length > 0 ? (
              <label className="block text-sm">
                <span className="font-semibold text-slate-700">Template to update</span>
                <select
                  value={saveTargetId}
                  onChange={(e) => setSaveTargetId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  {activeTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.defaultForProductKind ? " (default)" : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label className="block text-sm">
                  <span className="font-semibold text-slate-700">Name</span>
                  <input
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    maxLength={120}
                    autoFocus
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-semibold text-slate-700">Description (optional)</span>
                  <textarea
                    value={saveDescription}
                    onChange={(e) => setSaveDescription(e.target.value)}
                    className="mt-1 h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    maxLength={500}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={saveMakeDefault}
                    onChange={(e) => setSaveMakeDefault(e.target.checked)}
                  />
                  Set as default template for bookkeeping offers
                  {defaultTemplate && !saveMakeDefault ? (
                    <span className="text-xs text-slate-500">(currently: {defaultTemplate.name})</span>
                  ) : null}
                </label>
              </>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSaveOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={
                  isPending ||
                  (saveMode === "new" && !saveName.trim()) ||
                  (saveMode === "overwrite" && !saveTargetId)
                }
                className="ui-action-primary rounded-md px-3 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {saveMode === "overwrite" ? "Update template" : "Save template"}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
