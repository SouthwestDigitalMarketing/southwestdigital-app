"use client";

import { useRef, useState, useTransition } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { AGREEMENT_TEMPLATE_TOKENS } from "@/lib/agreements/template";
import type { AgreementTemplateView } from "@/lib/agreements/types";
import {
  archiveAgreementTemplateAction,
  createAgreementTemplateAction,
  deleteAgreementTemplateAction,
  restoreAgreementTemplateAction,
  setDefaultAgreementTemplateAction,
  setDefaultForProductKindAction,
  updateAgreementTemplateAction,
} from "./actions";

const PRODUCT_KIND_OPTIONS = [
  { value: "", label: "None" },
  { value: "bookkeeping", label: "Bookkeeping" },
  { value: "consulting", label: "Consulting" },
  { value: "coaching", label: "Coaching" },
] as const;

function TemplateEditor({ template }: { template: AgreementTemplateView }) {
  const router = useRouter();
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? "");
  const [content, setContent] = useState(template.content);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const archived = template.status === "archived";

  function run(action: () => Promise<unknown>, successMessage?: string) {
    setMessage(null);
    startTransition(async () => {
      try {
        await action();
        if (successMessage) setMessage(successMessage);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Something went wrong.");
      }
    });
  }

  function insertToken(token: string) {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? content.length;
    const end = textarea?.selectionEnd ?? content.length;
    setContent(`${content.slice(0, start)}${token}${content.slice(end)}`);
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">{template.name}</h2>
            {template.isDefault ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Default</span>
            ) : null}
            {template.defaultForProductKind ? (
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700">
                Default for {template.defaultForProductKind}
              </span>
            ) : null}
            {archived ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">Archived</span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Last updated {new Date(template.updatedAt).toLocaleString()}
          </p>
          {!archived ? (
            <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
              Default for product kind
              <select
                disabled={isPending}
                value={template.defaultForProductKind ?? ""}
                onChange={(event) =>
                  run(
                    () =>
                      setDefaultForProductKindAction(
                        template.id,
                        (event.target.value || null) as "bookkeeping" | "consulting" | "coaching" | null,
                      ),
                    "Default updated.",
                  )
                }
                className="rounded-md border border-slate-300 px-2 py-1 text-xs"
              >
                {PRODUCT_KIND_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {!archived && !template.isDefault ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => setDefaultAgreementTemplateAction(template.id), "Default updated.")}
              className="ui-action-secondary rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:opacity-50"
            >
              Make default
            </button>
          ) : null}
          {archived ? (
            <>
              <button
                type="button"
                disabled={isPending}
                onClick={() => run(() => restoreAgreementTemplateAction(template.id), "Template restored.")}
                className="ui-action-secondary rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:opacity-50"
              >
                Restore
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  if (window.confirm("Permanently delete this archived template? Published offers keep their saved agreement copy.")) {
                    run(() => deleteAgreementTemplateAction(template.id));
                  }
                }}
                className="ui-action-danger rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:opacity-50"
              >
                Delete
              </button>
            </>
          ) : !template.isDefault ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => archiveAgreementTemplateAction(template.id))}
              className="ui-action-secondary rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:opacity-50"
            >
              Archive
            </button>
          ) : null}
        </div>
      </div>

      <fieldset disabled={archived || isPending} className="mt-5 space-y-4 disabled:opacity-65">
        <div>
          <label htmlFor={`agreement-name-${template.id}`} className="text-sm font-semibold text-slate-700">Name</label>
          <input
            id={`agreement-name-${template.id}`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brandnavy focus:outline-none focus:ring-2 focus:ring-brandnavy/20"
          />
        </div>
        <div>
          <label htmlFor={`agreement-description-${template.id}`} className="text-sm font-semibold text-slate-700">Internal description</label>
          <input
            id={`agreement-description-${template.id}`}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="When should staff use this agreement?"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brandnavy focus:outline-none focus:ring-2 focus:ring-brandnavy/20"
          />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700">Insert proposal details</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {AGREEMENT_TEMPLATE_TOKENS.map((token) => (
              <button
                key={token}
                type="button"
                onClick={() => insertToken(token)}
                className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700 hover:bg-slate-200"
              >
                {token}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor={`agreement-content-${template.id}`} className="text-sm font-semibold text-slate-700">Agreement text</label>
          <textarea
            ref={textareaRef}
            id={`agreement-content-${template.id}`}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={30}
            className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-3 font-mono text-sm leading-6 text-slate-900 focus:border-brandnavy focus:outline-none focus:ring-2 focus:ring-brandnavy/20"
          />
        </div>
      </fieldset>

      <div className="mt-4 flex items-center justify-between gap-4">
        <p aria-live="polite" className={`text-sm ${message?.includes("wrong") || message?.includes("required") || message?.includes("not ") ? "text-red-600" : "text-emerald-700"}`}>
          {message}
        </p>
        {!archived ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(
              () => updateAgreementTemplateAction(template.id, { name, description, content }),
              "Agreement template saved.",
            )}
            className="ui-action-primary shrink-0 rounded-lg border px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save template"}
          </button>
        ) : null}
      </div>
    </section>
  );
}

export function AgreementTemplatesManager({ templates }: { templates: AgreementTemplateView[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, startCreating] = useTransition();
  const [createError, setCreateError] = useState<string | null>(null);
  const editingTemplate = templates.find((template) => template.id === editingId) ?? null;

  function createTemplate() {
    setCreateError(null);
    startCreating(async () => {
      try {
        const id = await createAgreementTemplateAction();
        setEditingId(id);
        router.refresh();
      } catch (error) {
        setCreateError(error instanceof Error ? error.message : "Unable to create template.");
      }
    });
  }

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Agreement Templates</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Maintain reusable agreements here. Offer builders select a template; publishing saves its current text with that offer.
          </p>
          <p className="mt-2 max-w-3xl text-xs text-amber-700">
            Agreement language can have legal consequences. Have qualified counsel review templates before using them with clients.
          </p>
        </div>
      </div>
      {createError ? <p className="mt-3 text-sm text-red-600">{createError}</p> : null}

      <div className="mt-5">
        <button
          type="button"
          disabled={isCreating}
          onClick={createTemplate}
          className="ui-action-primary rounded-lg border px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
        >
          {isCreating ? "Creating…" : "New template"}
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {templates.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">No agreement templates yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="px-5 py-3 font-semibold text-slate-700">Template</th>
                  <th className="px-5 py-3 font-semibold text-slate-700">Description</th>
                  <th className="px-5 py-3 font-semibold text-slate-700">Status</th>
                  <th className="px-5 py-3 font-semibold text-slate-700">Updated</th>
                  <th className="px-5 py-3 text-right font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {templates.map((template) => (
                  <tr key={template.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">{template.name}</p>
                      {template.isDefault ? <p className="mt-1 text-xs font-semibold text-emerald-700">Default</p> : null}
                    </td>
                    <td className="max-w-sm px-5 py-4 text-slate-600">{template.description || "—"}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${template.status === "archived" ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700"}`}>
                        {template.status === "archived" ? "Archived" : "Active"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">{new Date(template.updatedAt).toLocaleDateString()}</td>
                    <td className="px-5 py-4 text-right">
                      <button type="button" onClick={() => setEditingId(template.id)} className="text-xs font-semibold text-slate-900 hover:underline">
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingTemplate ? (
        <Modal
          onClose={() => setEditingId(null)}
          labelledBy="agreement-template-editor-title"
          className="max-w-5xl overflow-hidden bg-slate-50"
          closeOnBackdrop={false}
        >
          <div className="flex max-h-[calc(100dvh-1rem)] min-h-0 flex-col sm:max-h-[calc(100dvh-2rem)]">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <h2 id="agreement-template-editor-title" className="text-lg font-semibold text-slate-900">Edit agreement template</h2>
              <button type="button" onClick={() => setEditingId(null)} aria-label="Close template editor" title="Close template editor" className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <TemplateEditor key={`${editingTemplate.id}:${editingTemplate.updatedAt}`} template={editingTemplate} />
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
