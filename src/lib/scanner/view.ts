import { SCAN_ROOMS, type ScanRoom } from "./vocab";

export type ScanListRow = {
  id: string;
  room: string;
  key: string;
  what: string;
  severity: string;
  evidence: string;
  state: string;
  fixLevel: number;
  roleKey: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  closedAt: Date | null;
  doneNote: string | null;
};

export function needsAttention(row: Pick<ScanListRow, "state" | "fixLevel" | "severity">): boolean {
  return row.state === "open" && (row.fixLevel === 2 || row.severity === "urgent");
}

export function sortNeedsYou(rows: ScanListRow[]): ScanListRow[] {
  return rows.filter(needsAttention).sort((a, b) => {
    const urgent = Number(b.severity === "urgent") - Number(a.severity === "urgent");
    if (urgent !== 0) return urgent;
    return b.lastSeenAt.getTime() - a.lastSeenAt.getTime();
  });
}

export function groupOpenByRoom(rows: ScanListRow[]): Array<{ room: ScanRoom; label: string; items: ScanListRow[] }> {
  const open = rows.filter((row) => row.state === "open");
  return SCAN_ROOMS.flatMap((room) => {
    const items = open
      .filter((row) => row.room === room.key)
      .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime());
    return items.length > 0 ? [{ room: room.key, label: room.label, items }] : [];
  });
}

export function recentClosed(rows: ScanListRow[], limit = 20): ScanListRow[] {
  return rows
    .filter((row) => row.state === "closed")
    .sort((a, b) => (b.closedAt ?? b.lastSeenAt).getTime() - (a.closedAt ?? a.lastSeenAt).getTime())
    .slice(0, limit);
}

const WHEN = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatWhen(date: Date): string {
  return `${WHEN.format(date)} CT`;
}
