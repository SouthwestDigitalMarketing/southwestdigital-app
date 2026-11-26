import type { MailboxFolder } from "@/lib/donna/domain";

/** One table of mailbox folders with message counts (Zoho's own, or custom). */
export function FolderTable({
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
