import Link from "next/link";
import { requireDonna } from "@/lib/donna/access";
import { loadDesk, storageMissing } from "@/lib/donna/store";
import {
  mailboxFolderTables,
  mailboxHealth,
  type MailboxFolder,
} from "@/lib/donna/domain";
import { DonnaFrame, shortTime } from "../DonnaFrame";

function FolderTable({
  title,
  folders,
}: {
  title: string;
  folders: MailboxFolder[];
}) {
  if (!folders.length) return null;
  return (
    <section
      aria-label={title}
      className="overflow-hidden rounded-xl border border-slate-200"
    >
      <h3 className="bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      <ul className="grid grid-cols-2 gap-px bg-slate-100 lg:grid-cols-4">
        {folders.map((folder) => (
          <li
            key={folder.folder}
            className="flex min-w-0 items-baseline justify-between gap-2 bg-white px-3 py-2"
          >
            <span className="truncate text-sm">{folder.label}</span>
            <span className="tabular-nums text-sm font-semibold">
              {folder.messages.toLocaleString("en-US")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export const dynamic = "force-dynamic";
export default async function EmailPage() {
  const { dataContext } = await requireDonna();
  let data;
  try {
    data = await loadDesk(dataContext, "needs-you");
  } catch (e) {
    if (!storageMissing(e)) throw e;
    return (
      <DonnaFrame active="email">
        <p className="text-sm">The email desk is being set up.</p>
      </DonnaFrame>
    );
  }
  const m = data.mailboxes[0];
  const folders = mailboxFolderTables(m?.coverage);
  const remaining = data.mailboxes.reduce(
    (n, b) =>
      n +
      Number(
        (b.coverage as { remaining_threads?: number })?.remaining_threads ?? 0,
      ),
    0,
  );
  const health = m ? mailboxHealth(m) : "Not connected";
  return (
    <DonnaFrame active="email">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Email</h2>
        <div className="flex items-center gap-2">
          <Link
            href="/donna/email/work"
            className="text-xs text-slate-500 underline decoration-slate-300"
          >
            Open work
          </Link>
          <span
            className={`rounded-full px-3 py-1 text-xs ${m?.lastError ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}`}
          >
            {m?.paused
              ? "Paused"
              : health.startsWith("Listening")
                ? "Listening"
                : health}
          </span>
        </div>
      </div>
      {m ? (
        <p className="truncate text-sm text-slate-500" title={m.address}>
          {m.address}
        </p>
      ) : (
        <Link
          href="/donna/settings"
          className="inline-block rounded-lg bg-slate-900 px-4 py-3 text-sm text-white"
        >
          Connect email
        </Link>
      )}
      {folders.zoho.length || folders.custom.length ? (
        <>
          <FolderTable title="Zoho folders" folders={folders.zoho} />
          <FolderTable title="Custom folders" folders={folders.custom} />
        </>
      ) : (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
          Folder counts appear after Donna checks the mailbox.
        </p>
      )}
      <section
        aria-label="Email status"
        className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm"
      >
        <div className="flex justify-between gap-3">
          <span className="text-slate-500">Last checked</span>
          <span>{shortTime(m?.lastCheckedAt ?? null)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-slate-500">History to review</span>
          <Link
            href="/donna/settings?section=coverage"
            className="font-medium underline decoration-slate-300"
          >
            {remaining.toLocaleString("en-US")} conversations
          </Link>
        </div>
        {m?.lastError ? (
          <p role="alert" className="line-clamp-2 text-xs text-rose-700">
            {m.lastError}
          </p>
        ) : null}
      </section>
      <Link
        href="/donna/settings"
        className="inline-block text-sm text-slate-600 underline decoration-slate-300"
      >
        Manage email
      </Link>
    </DonnaFrame>
  );
}
