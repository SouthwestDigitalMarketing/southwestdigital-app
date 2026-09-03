"use client";

import { useEffect, useState } from "react";
import { useBrand } from "@/lib/brands/context";

export type MessageTemplate = {
  id: string;
  brandId: string;
  channel: "email" | "text";
  name: string;
  subject: string;
  content: string;
};

const EMAIL_DEFAULT: Omit<MessageTemplate, "id" | "brandId"> = {
  channel: "email",
  name: "Bookkeeping proposal",
  subject: "Your bookkeeping proposal for {{companyName}}",
  content: `Hi {{firstName}},

Thank you for taking the time to meet with me. I put together a bookkeeping proposal for {{companyName}}.

You can review it here:
{{proposalUrl}}

The proposal shows your service options, what each option includes, and the price. You can pick the option that works best for you.

{{brandName}} would be glad to help you get clear, organized books and reach your goals.

Thank you,
{{brandName}}`,
};

const TEXT_DEFAULT: Omit<MessageTemplate, "id" | "brandId"> = {
  channel: "text",
  name: "Bookkeeping proposal text",
  subject: "",
  content: `Hi {{ownerNames}},

I put together a bookkeeping proposal for {{companyName}}. You can review it here:
{{proposalUrl}}

{{brandName}}`,
};

function defaults(brandId: string, channel: MessageTemplate["channel"]): MessageTemplate[] {
  const template = channel === "email" ? EMAIL_DEFAULT : TEXT_DEFAULT;
  return [{ ...template, id: `${channel}-default`, brandId }];
}

export function MessageTemplateManager({
  channel,
  onApply,
}: {
  channel: MessageTemplate["channel"];
  onApply: (template: MessageTemplate) => void;
}) {
  const { brand } = useBrand();
  const storageKey = `offer-message-templates:${brand.id}:${channel}`;
  const [templates, setTemplates] = useState(() => defaults(brand.id, channel));
  const [selectedId, setSelectedId] = useState(() => defaults(brand.id, channel)[0].id);
  const [editingId, setEditingId] = useState(() => defaults(brand.id, channel)[0].id);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? "null") as MessageTemplate[] | null;
      if (Array.isArray(stored) && stored.length > 0) {
        // Hydrate the client-only template store after the browser is available.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTemplates(stored.filter((template) => template.brandId === brand.id && template.channel === channel));
        setSelectedId(stored[0]?.id ?? `${channel}-default`);
        setEditingId(stored[0]?.id ?? `${channel}-default`);
      }
    } catch {
      // Use the built-in template when browser storage is unavailable.
    } finally {
      setHydrated(true);
    }
  }, [brand.id, channel, storageKey]);

  useEffect(() => {
    if (!hydrated || templates.length === 0) return;
    window.localStorage.setItem(storageKey, JSON.stringify(templates));
  }, [hydrated, storageKey, templates]);

  const selected = templates.find((template) => template.id === selectedId) ?? templates[0];

  function editTemplate(template: MessageTemplate) {
    setEditingId(template.id);
    setName(template.name);
    setSubject(template.subject);
    setContent(template.content);
  }

  function selectTemplate(id: string) {
    const template = templates.find((item) => item.id === id);
    if (!template) return;
    setSelectedId(id);
    editTemplate(template);
    onApply(template);
    setMessage(`${channel === "email" ? "Email" : "Text"} template selected.`);
  }

  function createTemplate() {
    const id = `${channel}-${Date.now()}`;
    setEditingId(id);
    setName("New message template");
    setSubject(channel === "email" ? "Your bookkeeping proposal for {{companyName}}" : "");
    setContent("");
    setIsOpen(true);
    setMessage(null);
  }

  function saveTemplate() {
    const cleanName = name.trim();
    const cleanContent = content.trim();
    if (!cleanName || !cleanContent) {
      setMessage("A template name and message are required.");
      return;
    }
    const existing = templates.find((template) => template.id === editingId);
    const updated: MessageTemplate = {
      id: existing?.id ?? editingId,
      brandId: brand.id,
      channel,
      name: cleanName,
      subject: subject.trim(),
      content: cleanContent,
    };
    setTemplates((current) => existing ? current.map((template) => template.id === editingId ? updated : template) : [...current, updated]);
    setSelectedId(updated.id);
    onApply(updated);
    setMessage("Template saved.");
  }

  function deleteTemplate() {
    if (!selected || templates.length === 1) {
      setMessage("Keep at least one template.");
      return;
    }
    if (!window.confirm(`Delete “${selected.name}”?`)) return;
    const remaining = templates.filter((template) => template.id !== selected.id);
    setTemplates(remaining);
    selectTemplate(remaining[0].id);
    setMessage("Template deleted.");
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Template</span>
          <select
            value={selected?.id ?? ""}
            onChange={(event) => selectTemplate(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brandnavy focus:outline-none focus:ring-2 focus:ring-brandnavy/20"
          >
            {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => { const nextOpen = !isOpen; setIsOpen(nextOpen); if (nextOpen && selected) editTemplate(selected); }} className="ui-action-secondary rounded-lg border px-3 py-2 text-sm font-semibold">
          {isOpen ? "Close manager" : "Manage templates"}
        </button>
      </div>

      {isOpen ? (
        <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={createTemplate} className="ui-action-secondary rounded-lg border px-3 py-2 text-sm font-semibold">New template</button>
            <button type="button" onClick={deleteTemplate} className="ui-action-danger rounded-lg border px-3 py-2 text-sm font-semibold">Delete selected</button>
          </div>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Template name" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" />
          {channel === "email" ? <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" /> : null}
          <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={8} placeholder="Message template" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-6 text-slate-900" />
          <p className="text-xs text-slate-500">
            Use {"{{firstName}}"}, {"{{ownerNames}}"}, {"{{companyName}}"}, {"{{proposalUrl}}"}, and {"{{brandName}}"}.
          </p>
          <div className="flex items-center justify-between gap-3">
            <p aria-live="polite" className={`text-sm ${message?.includes("required") || message?.includes("Keep") ? "text-rose-600" : "text-emerald-700"}`}>{message}</p>
            <button type="button" onClick={saveTemplate} className="ui-action-primary rounded-lg px-4 py-2 text-sm font-semibold">Save template</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
