"use client";

import { useState } from "react";
import { PHONE_INTAKE_MAX_BYTES } from "@/lib/phone-intake/ticket";

type Row = {
  id: string;
  name: string;
  state: "wait" | "send" | "done" | "fail";
  progress: number;
  bytes?: number;
  sha256?: string;
  error?: string;
};

function putFile(url: string, file: File, onProgress: (ratio: number) => void) {
  return new Promise<{ name: string; bytes: number; sha256: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(xhr.responseText || "The send failed."));
        return;
      }
      try {
        resolve(JSON.parse(xhr.responseText) as { name: string; bytes: number; sha256: string });
      } catch {
        reject(new Error("The reply was not a receipt."));
      }
    };
    xhr.onerror = () => reject(new Error("The send failed."));
    xhr.send(file);
  });
}

export default function PhoneSend() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  function patch(id: string, next: Partial<Row>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...next } : row)));
  }

  async function onPick(files: FileList | null) {
    if (!files || files.length === 0 || busy) return;
    const batch = Array.from(files).map((file) => ({
      file,
      row: {
        id: `${file.name}-${file.size}-${Math.random().toString(16).slice(2)}`,
        name: file.name,
        state: "wait" as const,
        progress: 0,
      },
    }));
    setRows((current) => [...batch.map((item) => item.row), ...current]);
    setBusy(true);
    try {
      for (const item of batch) {
        if (item.file.size < 1 || item.file.size > PHONE_INTAKE_MAX_BYTES) {
          patch(item.row.id, { state: "fail", error: "That file is empty or over 3 GB." });
          continue;
        }
        patch(item.row.id, { state: "send" });
        try {
          const ticket = await fetch("/api/phone-intake", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: item.file.name, size: item.file.size, type: item.file.type }),
          });
          const payload = (await ticket.json().catch(() => null)) as { putUrl?: string; error?: string } | null;
          if (!ticket.ok || !payload?.putUrl) {
            patch(item.row.id, { state: "fail", error: payload?.error || "Could not start the send." });
            continue;
          }
          const receipt = await putFile(payload.putUrl, item.file, (ratio) => {
            patch(item.row.id, { progress: ratio });
          });
          patch(item.row.id, {
            state: "done",
            progress: 1,
            name: receipt.name,
            bytes: receipt.bytes,
            sha256: receipt.sha256,
          });
        } catch (error) {
          patch(item.row.id, {
            state: "fail",
            error: error instanceof Error ? error.message : "The send failed.",
          });
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 max-w-xl">
      <label className="block text-base font-semibold text-slate-800" htmlFor="phone-files">
        Choose videos and pictures
      </label>
      <input
        id="phone-files"
        className="mt-3 block w-full text-base file:mr-4 file:rounded-full file:border-0 file:bg-slate-900 file:px-5 file:py-3 file:text-base file:font-semibold file:text-white"
        type="file"
        accept="video/*,image/*"
        multiple
        disabled={busy}
        onChange={(event) => {
          const picked = event.target.files;
          event.target.value = "";
          void onPick(picked);
        }}
      />
      <ul className="mt-6 space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="break-all text-sm font-semibold text-slate-900">{row.name}</p>
            {row.state === "send" ? (
              <p className="mt-1 text-sm text-slate-600">{Math.round(row.progress * 100)}%</p>
            ) : null}
            {row.state === "done" ? (
              <p className="mt-1 break-all text-sm text-slate-700">
                {row.bytes?.toLocaleString("en-US")} bytes
                <br />
                {row.sha256}
              </p>
            ) : null}
            {row.state === "fail" ? <p className="mt-1 text-sm text-rose-700">{row.error}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
