/** Closed vocabulary for Scanner. People live in ScanRole, not here. */

export const SCANNER_BRAND_SLUG = "bookkeeping-conroe";

export const SCAN_ROOMS = [
  { key: "phone", label: "Phone lines" },
  { key: "inbox", label: "Email inbox" },
  { key: "payments", label: "Payments" },
  { key: "contracts", label: "Contracts" },
  { key: "non-inbox", label: "Email, not inbox" },
] as const;

export const SCAN_ROLES = [
  { key: "mail-desk", label: "Mail desk" },
  { key: "sales-pipeline", label: "Sales pipeline" },
  { key: "client-delivery", label: "Client delivery" },
  { key: "systems", label: "Systems" },
] as const;

export const FIX_LEVEL_LABEL = {
  1: "Would fix on its own",
  2: "Ask first",
  3: "Surface only",
} as const;

export type ScanRoom = (typeof SCAN_ROOMS)[number]["key"];
export type ScanRoleKey = (typeof SCAN_ROLES)[number]["key"];
export type ScanSeverity = "urgent" | "normal";
export type FixLevel = 1 | 2 | 3;

const ROOM_KEYS = new Set<string>(SCAN_ROOMS.map((room) => room.key));
const ROLE_KEYS = new Set<string>(SCAN_ROLES.map((role) => role.key));

export function isScanRoom(value: string): value is ScanRoom {
  return ROOM_KEYS.has(value);
}

export function isScanRoleKey(value: string): value is ScanRoleKey {
  return ROLE_KEYS.has(value);
}

export function roomLabel(key: string): string {
  return SCAN_ROOMS.find((room) => room.key === key)?.label ?? key;
}

export function roleLabel(key: string): string {
  return SCAN_ROLES.find((role) => role.key === key)?.label ?? key;
}

export function fixLevelLabel(level: number): string {
  if (level === 1 || level === 2 || level === 3) return FIX_LEVEL_LABEL[level];
  return `Fix level ${level}`;
}
