import { describe, expect, it } from "vitest";
import { changeSongs, parseSongs, starterSongs } from "./setList";

let n = 0;
const id = () => `s${++n}`;

describe("set list songs", () => {
  it("starts from the website draft, all suggested", () => {
    const songs = starterSongs(id);
    expect(songs).toHaveLength(26);
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
});
