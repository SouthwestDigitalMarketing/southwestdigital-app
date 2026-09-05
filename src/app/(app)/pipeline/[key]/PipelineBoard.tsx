"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Modal } from "@/components/Modal";
import { formatPhone } from "@/lib/phone";
import { addLeadNoteAction, movePipelineItemAction } from "../actions";

type Stage = {
  id: string;
  key: string;
  name: string;
  valueMultiplier: number;
};

type Item = {
  id: string;
  stageId: string;
  leadName: string;
  leadCompany: string | null;
  leadEmail: string | null;
  leadPhone: string | null;
  leadStatus: string;
  contactId: string | null;
  contactName: string | null;
  leadKind: string;
  category: string;
  expectedServices: string | null;
  notes: string | null;
  baseValueUsd: number;
  weightedValueUsd: number;
};

const chipButton =
  "rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

export default function PipelineBoard({
  pipelineKey,
  stages,
  items,
}: {
  pipelineKey: string;
  stages: Stage[];
  items: Item[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [movingItemId, setMovingItemId] = useState<string | null>(null);
  const [callNote, setCallNote] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );

  function moveItem(itemId: string, stageId: string) {
    setActionError(null);
    setMovingItemId(itemId);
    startTransition(async () => {
      try {
        const data = new FormData();
        data.set("itemId", itemId);
        data.set("stageId", stageId);
        data.set("pipelineKey", pipelineKey);
        await movePipelineItemAction(data);
        router.refresh();
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Could not move this card.");
      } finally {
        setMovingItemId(null);
      }
    });
  }

  function logCall(itemId: string) {
    const text = callNote.trim();
    if (!text) return;
    setActionError(null);
    startTransition(async () => {
      try {
        const data = new FormData();
        data.set("itemId", itemId);
        data.set("text", text);
        await addLeadNoteAction(data);
        setCallNote("");
        router.refresh();
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Could not save the call note.");
      }
    });
  }

  return (
    <div className="mt-5 space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">Pipeline stages</h2>
          <p className="text-xs text-slate-500">Drag a card between stages, or click one to open its details.</p>
        </div>
        <div className="overflow-x-auto pb-2">
          <div className="grid min-w-max grid-flow-col auto-cols-[320px] gap-3">
            {stages.map((stage, index) => {
              const columnItems = items.filter((item) => item.stageId === stage.id);
              return (
                <section
                  key={stage.id}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const itemId = event.dataTransfer.getData("text/pipeline-item-id");
                    setDraggingId(null);
                    if (itemId) moveItem(itemId, stage.id);
                  }}
                  className="flex flex-col rounded-lg border border-slate-200 bg-slate-50"
                >
                  <header className="border-b border-slate-200 px-3 pb-2 pt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Stage {index + 1}
                    </p>
                    <h3 className="text-sm font-semibold text-slate-900">{stage.name}</h3>
                  </header>
                  <div className="grid gap-2 p-3">
                    {columnItems.length === 0 ? (
                      <p className="rounded border border-dashed border-slate-300 bg-white px-2 py-3 text-xs text-slate-500">
                        Drop cards here
                      </p>
                    ) : null}
                    {columnItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData("text/pipeline-item-id", item.id);
                          setDraggingId(item.id);
                        }}
                        onDragEnd={() => setDraggingId(null)}
                        onClick={() => {
                          setSelectedId(item.id);
                          setCallNote("");
                          setActionError(null);
                        }}
                        className={`cursor-pointer rounded-xl border px-3 py-2 text-left transition ${
                          selectedId === item.id
                            ? "border-slate-700 bg-white shadow-md"
                            : "border-slate-300 bg-white shadow-sm hover:border-slate-500 hover:shadow-md"
                        } ${draggingId === item.id ? "opacity-60" : ""}`}
                      >
                        <p className="text-sm font-semibold text-slate-900">{item.leadName}</p>
                        <p className="text-xs text-slate-600">{item.leadCompany?.trim() || "No company"}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-800">
                          ${item.weightedValueUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">{item.leadStatus}</p>
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </section>

      {selected ? (
        <Modal onClose={() => setSelectedId(null)} labelledBy="pipeline-detail-title" className="max-w-2xl" busy={pending}>
          <div className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <h3 id="pipeline-detail-title" className="text-base font-semibold text-slate-900">{selected.leadName}</h3>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {selected.leadPhone ? (
                  <a href={`tel:${selected.leadPhone}`} className={chipButton}>
                    Call
                  </a>
                ) : null}
                <Link
                  href={selected.contactId ? `/offers?contact=${encodeURIComponent(selected.contactId)}` : "/offers"}
                  className={chipButton}
                >
                  Send offer
                </Link>
                {selected.contactId ? (
                  <Link href={`/contacts/${selected.contactId}`} className={chipButton}>
                    View contact
                  </Link>
                ) : (
                  <Link href="/contacts" className={chipButton}>
                    Manage contacts
                  </Link>
                )}
                <button type="button" onClick={() => setSelectedId(null)} className={chipButton}>
                  Close
                </button>
              </div>
            </div>
            <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
              <p><span className="font-semibold">Company:</span> {selected.leadCompany || "N/A"}</p>
              <p><span className="font-semibold">Email:</span> {selected.leadEmail || "N/A"}</p>
              <p><span className="font-semibold">Phone:</span> {selected.leadPhone ? formatPhone(selected.leadPhone) : "N/A"}</p>
              <p><span className="font-semibold">Linked contact:</span> {selected.contactName || "N/A"}</p>
              <p><span className="font-semibold">Status:</span> {selected.leadStatus}</p>
              <p><span className="font-semibold">Category:</span> {selected.category}</p>
              <p className="md:col-span-2"><span className="font-semibold">Expected services:</span> {selected.expectedServices || "N/A"}</p>
              <p><span className="font-semibold">Base value:</span> ${selected.baseValueUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              <p><span className="font-semibold">Weighted value:</span> ${selected.weightedValueUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              <p className="whitespace-pre-wrap md:col-span-2"><span className="font-semibold">Notes:</span> {selected.notes || "N/A"}</p>
            </div>
            <form
              className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3"
              onSubmit={(event) => {
                event.preventDefault();
                logCall(selected.id);
              }}
            >
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Log call note
                <textarea
                  value={callNote}
                  onChange={(event) => setCallNote(event.target.value)}
                  maxLength={2_000}
                  rows={3}
                  placeholder="Outcome, objections, and next step"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-800 focus:border-slate-500 focus:outline-none"
                />
              </label>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-400">{callNote.length}/2,000</span>
                <button type="submit" disabled={pending || !callNote.trim()} className={chipButton}>
                  {pending ? "Saving…" : "Log call"}
                </button>
              </div>
            </form>
            {actionError ? (
              <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {actionError}
              </p>
            ) : null}
            <div className="pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Move to stage
              </p>
              <div className="flex flex-wrap gap-1.5">
                {stages.map((stage) => (
                  <button
                    key={stage.id}
                    type="button"
                    disabled={selected.stageId === stage.id || pending || movingItemId === selected.id}
                    onClick={() => moveItem(selected.id, stage.id)}
                    className={chipButton}
                  >
                    {stage.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
