import { SET_LIST_GROUPS, type SetListContact } from "./setListContacts";

/** Contact tags for Music > People (Tom, 2026-11-28: use SWapp contact cards, tagged Music). */
export const MUSIC_TAG = { key: "music", label: "Music" } as const;

export const GROUP_TAGS: Record<(typeof SET_LIST_GROUPS)[number], { key: string; label: string }> = {
  "Wedding planners and coordinators": { key: "wedding-planner", label: "Wedding planner" },
  "Wedding DJs": { key: "wedding-dj", label: "Wedding DJ" },
  "Venue coordinators": { key: "venue-coordinator", label: "Venue coordinator" },
  "Wedding bands in other cities": { key: "wedding-band", label: "Wedding band" },
};

export const GROUP_TAG_KEYS = Object.values(GROUP_TAGS).map((tag) => tag.key);

/** Contact cards have no website field, so the website and source go in the notes. */
export function contactNotes(contact: SetListContact): string {
  return [
    contact.url ? `Website: ${contact.url}` : null,
    contact.city ? `Location: ${contact.city}` : null,
    `Google reviews: ${contact.reviews}`,
    "Added from Music > People (set list research), 2026-11-28.",
  ].filter(Boolean).join("\n");
}

export function websiteFromNotes(notes: string | null): string | null {
  return notes?.match(/^Website: (\S+)$/m)?.[1] ?? null;
}
