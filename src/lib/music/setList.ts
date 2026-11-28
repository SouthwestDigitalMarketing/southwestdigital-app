import { z } from "zod";

/** Parts of a wedding day, in order; matches easyweddingband.com/music. */
export const MOMENTS = ["Ceremony", "Cocktail hour", "Dinner", "First dance and parent dances", "Dance floor", "Last dance"] as const;
/** Where a song stands (Tom, 2026-11-28): suggested songs come from the website draft or from people we ask. */
export const SONG_STATUSES = ["Suggested", "Learning", "Play it", "Not for us"] as const;

export type Moment = (typeof MOMENTS)[number];
export type SongStatus = (typeof SONG_STATUSES)[number];

const text = (max: number) => z.string().trim().max(max);

export const songSchema = z.object({
  id: z.string().min(1).max(64),
  title: text(160).min(1, "Add the song title."),
  artist: text(160).default(""),
  moment: z.enum(MOMENTS),
  status: z.enum(SONG_STATUSES).default("Suggested"),
  suggestedBy: text(160).default(""),
});
export type Song = z.infer<typeof songSchema>;

/** Stored JSON is trusted only after this: bad rows are dropped, not shown half-broken. */
export function parseSongs(value: unknown): Song[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    const parsed = songSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

const newSong = songSchema.omit({ id: true });

export const songChangeSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add"), song: newSong }),
  z.object({ op: z.literal("update"), id: z.string().min(1), song: newSong.partial() }),
  z.object({ op: z.literal("remove"), id: z.string().min(1) }),
]);
export type SongChange = z.infer<typeof songChangeSchema>;

const MAX_SONGS = 500;

/** Applies one validated change; the id generator is injectable for tests. */
export function changeSongs(songs: Song[], change: unknown, makeId: () => string = () => crypto.randomUUID()): Song[] {
  const parsed = songChangeSchema.parse(change);
  if (parsed.op === "add") {
    if (songs.length >= MAX_SONGS) throw new Error(`The list holds up to ${MAX_SONGS} songs.`);
    return [...songs, songSchema.parse({ ...parsed.song, id: makeId() })];
  }
  if (!songs.some((song) => song.id === parsed.id)) throw new Error("That song is no longer on the list.");
  if (parsed.op === "remove") return songs.filter((song) => song.id !== parsed.id);
  return songs.map((song) => (song.id === parsed.id ? songSchema.parse({ ...song, ...parsed.song, id: song.id }) : song));
}

/** The songs drafted for easyweddingband.com/music, as the first suggestions. */
const STARTER: Array<[Moment, string, string]> = [
  ["Ceremony", "Canon in D", "Pachelbel"],
  ["Ceremony", "Can't Help Falling in Love", "Elvis Presley"],
  ["Ceremony", "Here Comes the Sun", "The Beatles"],
  ["Ceremony", "A Thousand Years", "Christina Perri"],
  ["Cocktail hour", "Stand by Me", "Ben E. King"],
  ["Cocktail hour", "Georgia on My Mind", "Ray Charles"],
  ["Cocktail hour", "Pride and Joy (instrumental)", "Stevie Ray Vaughan"],
  ["Cocktail hour", "Little Wing (instrumental)", "Jimi Hendrix"],
  ["Dinner", "(Sittin' On) The Dock of the Bay", "Otis Redding"],
  ["Dinner", "What a Wonderful World", "Louis Armstrong"],
  ["Dinner", "Into the Mystic", "Van Morrison"],
  ["Dinner", "Harvest Moon", "Neil Young"],
  ["First dance and parent dances", "At Last", "Etta James"],
  ["First dance and parent dances", "Wonderful Tonight", "Eric Clapton"],
  ["First dance and parent dances", "My Girl", "The Temptations"],
  ["First dance and parent dances", "Have I Told You Lately", "Van Morrison"],
  ["Dance floor", "Brown Eyed Girl", "Van Morrison"],
  ["Dance floor", "Mustang Sally", "Wilson Pickett"],
  ["Dance floor", "Sweet Home Alabama", "Lynyrd Skynyrd"],
  ["Dance floor", "Oh, Pretty Woman", "Roy Orbison"],
  ["Dance floor", "Johnny B. Goode", "Chuck Berry"],
  ["Dance floor", "Shout", "The Isley Brothers"],
  ["Dance floor", "Start Me Up", "The Rolling Stones"],
  ["Dance floor", "Proud Mary", "Creedence Clearwater Revival"],
  ["Last dance", "Sweet Caroline", "Neil Diamond"],
  ["Last dance", "Don't Stop Believin'", "Journey"],
];

export function starterSongs(makeId: () => string = () => crypto.randomUUID()): Song[] {
  return STARTER.map(([moment, title, artist]) => ({ id: makeId(), title, artist, moment, status: "Suggested", suggestedBy: "Website draft" }));
}
