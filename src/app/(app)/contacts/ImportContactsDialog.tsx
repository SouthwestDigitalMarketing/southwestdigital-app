"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importContactsAction, type ImportContactsResult } from "./actions";

type TagOption = { id: string; label: string };

type ContactField = "name" | "firstName" | "lastName" | "email" | "phone" | "company" | "notes";

const CONTACT_FIELDS: Array<{ value: ContactField; label: string }> = [
  { value: "name", label: "Full name" },
  { value: "firstName", label: "First name" },
  { value: "lastName", label: "Last name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "company", label: "Company" },
  { value: "notes", label: "Notes" },
];

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const source = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (inQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += ch;
  }
  if (inQuotes) throw new Error("CSV contains an unterminated quoted field.");
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

function guessMapping(header: string[]): Record<number, ContactField | "">  {
  const mapping: Record<number, ContactField | ""> = {};
  header.forEach((cell, index) => {
    const lower = cell.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (lower === "firstname" || lower === "first" || lower === "given" || lower === "givenname") {
      mapping[index] = "firstName";
    } else if (lower === "lastname" || lower === "last" || lower === "surname" || lower === "family" || lower === "familyname") {
      mapping[index] = "lastName";
    } else if (lower === "email" || lower === "emailaddress") {
      mapping[index] = "email";
    } else if (lower === "phone" || lower === "phonenumber" || lower === "mobile" || lower === "cell" || lower === "telephone") {
      mapping[index] = "phone";
    } else if (lower === "company" || lower === "companyname" || lower === "business" || lower === "organization" || lower === "organisation") {
      mapping[index] = "company";
    } else if (lower === "notes" || lower === "note" || lower === "comments" || lower === "comment") {
      mapping[index] = "notes";
    } else if (lower === "name" || lower === "fullname" || lower === "contactname") {
      mapping[index] = "name";
    } else {
      mapping[index] = "";
    }
  });
  return mapping;
}

export function ImportContactsDialog({ tags }: { tags: TagOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, ContactField | "">>({});
  const [tagId, setTagId] = useState<string>("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportContactsResult | null>(null);
  const [pending, startTransition] = useTransition();

  const header = rows[0] ?? [];
  const dataRows = rows.slice(1);
  const previewRows = dataRows.slice(0, 5);
  const canImport = useMemo(() => {
    const mapped = Object.values(mapping).filter((v) => v);
    return mapped.includes("name") || mapped.includes("firstName") || mapped.includes("lastName");
  }, [mapping]);

  function reset() {
    setFileName("");
    setRows([]);
    setMapping({});
    setTagId("");
    setParseError(null);
    setResult(null);
  }

  function close() {
    if (pending) return;
    setOpen(false);
    reset();
  }

  async function onFile(file: File) {
    setParseError(null);
    setResult(null);
    setFileName(file.name);
    try {
      if (file.size > 750_000) throw new Error("Choose a CSV smaller than 750 KB.");
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.length < 2) throw new Error("CSV needs a header row plus at least one data row.");
      if (parsed.length - 1 > 1_000) throw new Error("Import up to 1,000 contacts at a time.");
      setRows(parsed);
      setMapping(guessMapping(parsed[0]));
    } catch (err) {
      setRows([]);
      setMapping({});
      setParseError(err instanceof Error ? err.message : "Unable to parse CSV.");
    }
  }

  function submit() {
    const payload = dataRows.map((cells) => {
      const record: Record<ContactField, string> = {
        name: "",
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        company: "",
        notes: "",
      };
      cells.forEach((cell, index) => {
        const target = mapping[index];
        if (target) record[target] = cell.trim();
      });
      return record;
    });
    startTransition(async () => {
      try {
        const outcome = await importContactsAction({
          rows: payload,
          tagId: tagId || null,
        });
        setResult(outcome);
        router.refresh();
      } catch (err) {
        setParseError(err instanceof Error ? err.message : "Import failed.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 cursor-pointer items-center rounded-full border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Import CSV
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={close}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 id="import-title" className="text-lg font-semibold text-slate-900">Import contacts from CSV</h2>
                <p className="mt-1 text-sm text-slate-500">Upload a CSV, map columns, and optionally tag every row on import.</p>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={pending}
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Close
              </button>
            </header>

            <div className="max-h-[calc(90vh-160px)] overflow-y-auto px-5 py-4 text-sm">
              {result ? (
                <div className="space-y-3">
                  <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    Imported {result.created} contact{result.created === 1 ? "" : "s"}. Skipped {result.skipped}.
                  </p>
                  {result.errors.length ? (
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Errors:</p>
                      <ul className="mt-1 space-y-1 text-sm text-rose-700">
                        {result.errors.slice(0, 20).map((err) => (
                          <li key={`${err.row}-${err.message}`}>Row {err.row}: {err.message}</li>
                        ))}
                        {result.errors.length > 20 ? (
                          <li className="text-slate-500">…and {result.errors.length - 20} more.</li>
                        ) : null}
                      </ul>
                    </div>
                  ) : null}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={reset}
                      className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50"
                    >
                      Import another file
                    </button>
                    <button
                      type="button"
                      onClick={close}
                      className="ui-action-primary rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-700">CSV file</span>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void onFile(file);
                      }}
                      className="block w-full text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-full file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-50"
                    />
                    {fileName ? <p className="text-xs text-slate-500">Selected: {fileName}</p> : null}
                  </label>

                  {parseError ? (
                    <p className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{parseError}</p>
                  ) : null}

                  {header.length > 0 ? (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-slate-700">Map columns ({dataRows.length} data rows)</p>
                      <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="min-w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50">
                              {header.map((cell, index) => (
                                <th key={index} className="border-b border-slate-200 px-3 py-2 text-left align-top">
                                  <p className="font-semibold text-slate-800">{cell || `(column ${index + 1})`}</p>
                                  <select
                                    value={mapping[index] ?? ""}
                                    onChange={(event) => setMapping((prev) => ({ ...prev, [index]: event.target.value as ContactField | "" }))}
                                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                                    aria-label={`Map column ${cell || index + 1}`}
                                  >
                                    <option value="">(ignore)</option>
                                    {CONTACT_FIELDS.map((field) => (
                                      <option key={field.value} value={field.value}>{field.label}</option>
                                    ))}
                                  </select>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {previewRows.map((cells, rowIdx) => (
                              <tr key={rowIdx} className="border-b border-slate-100">
                                {header.map((_, index) => (
                                  <td key={index} className="px-3 py-2 align-top text-slate-600">
                                    {cells[index] ?? ""}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {previewRows.length < dataRows.length ? (
                        <p className="text-xs text-slate-500">Showing first {previewRows.length} of {dataRows.length} rows.</p>
                      ) : null}

                      <label className="grid gap-1">
                        <span className="text-sm font-medium text-slate-700">Apply tag to every row (optional)</span>
                        <select
                          value={tagId}
                          onChange={(event) => setTagId(event.target.value)}
                          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                        >
                          <option value="">No tag</option>
                          {tags.map((tag) => (
                            <option key={tag.id} value={tag.id}>{tag.label}</option>
                          ))}
                        </select>
                        <span className="text-xs text-slate-500">
                          If the tag has a pipeline automation, each imported contact will land on that pipeline&apos;s configured stage.
                        </span>
                      </label>

                      {!canImport ? (
                        <p className="text-xs text-amber-700">Map a Full name column, or at least one First name or Last name column, to enable import.</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {!result ? (
              <footer className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
                <button
                  type="button"
                  onClick={close}
                  disabled={pending}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={pending || !canImport || dataRows.length === 0}
                  onClick={submit}
                  className="ui-action-primary rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition disabled:opacity-50"
                >
                  {pending ? "Importing…" : `Import ${dataRows.length} row${dataRows.length === 1 ? "" : "s"}`}
                </button>
              </footer>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
