import { describe, expect, it } from "vitest";
import { changeSongs, parsePastedSongs, parseSongs, starterSongs } from "./setList";

let n = 0;
const id = () => `s${++n}`;

describe("set list songs", () => {
  it("starts from the website draft, all suggested", () => {
    const songs = starterSongs(id);
    expect(songs).toHaveLength(27);
    expect(songs.some((song) => song.title === "Sweet Caroline")).toBe(false);
    expect(songs.every((song) => song.status === "Suggested" && song.suggestedBy === "Website draft")).toBe(true);
  });

  it("adds, updates and removes one song", () => {
    let songs = changeSongs([], { op: "add", song: { title: " Shout ", artist: "The Isley Brothers", moment: "Dance floor", suggestedBy: "5 Star Entertainers" } }, () => "a");
    expect(songs).toEqual([{ id: "a", title: "Shout", artist: "The Isley Brothers", moment: "Dance floor", status: "Suggested", suggestedBy: "5 Star Entertainers" }]);
    songs = changeSongs(songs, { op: "update", id: "a", song: { status: "Play it" } });
    expect(songs[0].status).toBe("Play it");
    expect(changeSongs(songs, { op: "remove", id: "a" })).toEqual([]);
  });

  it("rejects an unknown moment, an empty title and a missing song", () => {
    expect(() => changeSongs([], { op: "add", song: { title: "X", moment: "Brunch" } })).toThrow();
    expect(() => changeSongs([], { op: "add", song: { title: "  ", moment: "Dinner" } })).toThrow();
    expect(() => changeSongs([], { op: "remove", id: "gone" })).toThrow("no longer on the list");
  });

  it("drops stored rows that do not parse", () => {
    expect(parseSongs([{ id: "a", title: "At Last", moment: "Dinner" }, { title: "no id" }, "junk"])).toHaveLength(1);
    expect(parseSongs(null)).toEqual([]);
  });

  it("parses a pasted ChatGPT list and skips the chatter", () => {
    const text = `81. "I Gotta Feeling" – The Black Eyed Peas
82. "Levels" – Avicii
85. Last Dance: "Closing Time" – Semisonic (or "Don't Stop Me Now" – Queen)
If you'd like to refine this list, let me know:
• Genres to lean into or cut (e.g., more country)
First dance: At Last - Etta James`;
    expect(parsePastedSongs(text)).toEqual([
      { title: "I Gotta Feeling", artist: "The Black Eyed Peas", moment: "Dance floor" },
      { title: "Levels", artist: "Avicii", moment: "Dance floor" },
      { title: "Closing Time", artist: "Semisonic", moment: "Last dance" },
      { title: "At Last", artist: "Etta James", moment: "First dance and parent dances" },
    ]);
  });

  it("adds many at once and skips songs already listed", () => {
    const start = [{ id: "a", title: "Levels", artist: "Avicii", moment: "Dance floor" as const, status: "Play it" as const, suggestedBy: "" }];
    const songs = changeSongs(start, { op: "addMany", songs: [
      { title: "levels", artist: "avicii", moment: "Dance floor", suggestedBy: "ChatGPT" },
      { title: "Wagon Wheel", artist: "Darius Rucker", moment: "Dance floor", suggestedBy: "ChatGPT" },
    ] }, () => "b");
    expect(songs.map((s) => s.title)).toEqual(["Levels", "Wagon Wheel"]);
  });
});

