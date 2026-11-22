"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { withBrandDataTransaction } from "@/lib/tenancy/context";
import { checkRateLimit } from "@/lib/simpleRateLimit";
import { draftFromStoryline, regenerateBeat } from "@/lib/showrunner/studio-ai";
import { episodeSchema, lastHook, parseEpisodes, validateForLock } from "@/lib/showrunner/studio";
import {
  buildStorylines,
  collectWeekSignals,
  parseStorylineDrafts,
  signalMetrics,
  wordsForBusinessSeconds,
  type Storyline,
} from "@/lib/showrunner/storylines";

type Change =
  | { kind: "refresh" }
  | { kind: "pick"; id: string; color: string }
  | { kind: "custom"; color: string }
  | { kind: "edit"; episode: unknown }
  | { kind: "lock"; episode: unknown; privacyChecked: boolean }
  | { kind: "regenerate"; episode: unknown; index: number }
  | { kind: "clip"; id: string; index: number; done: boolean }
  | { kind: "publish"; id: string; url: string }
  | { kind: "mountain"; current: number | null; showDollars: boolean };

function limitTells(userId: string) {
  if (!checkRateLimit(`showrunner-tells:${userId}`, 10, 60 * 60_000).allowed) {
    throw new Error("Too many story builds this hour. Pick a story or try later.");
  }
}

export async function changeStudio(change: Change) {
  const { dataContext } = await requireStaffBrandOrThrow();
  let regenerated: Awaited<ReturnType<typeof regenerateBeat>> | null = null;
  if (change.kind === "regenerate") {
    if (!checkRateLimit(`showrunner-beat:${dataContext.actorUserId}`, 15, 60 * 60_000).allowed) {
      throw new Error("Too many beat drafts this hour. Edit this beat or try later.");
    }
    regenerated = await regenerateBeat(episodeSchema.parse(change.episode), change.index);
  }
  const result = await withBrandDataTransaction(dataContext, async (tx) => {
    await tx.showrunnerStudio.upsert({
      where: { brandId: dataContext.brandId },
      create: { brandId: dataContext.brandId },
      update: {},
    });
    await tx.$queryRaw`SELECT "id" FROM "ShowrunnerStudio" WHERE "brandId" = ${dataContext.brandId} FOR UPDATE`;
    const row = await tx.showrunnerStudio.findUniqueOrThrow({ where: { brandId: dataContext.brandId } });
    let episodes = parseEpisodes(row.episodes);
    let storylines = parseStorylineDrafts(row.storylines);
    let mountainCurrent = row.mountainCurrent;
    let showDollars = row.showDollars;
    if (change.kind === "refresh") {
      limitTells(dataContext.actorUserId);
      if (episodes.some((episode) => episode.status === "locked")) throw new Error("Finish the locked episode first.");
      const signals = await collectWeekSignals(tx, dataContext.brandId);
      const hook = lastHook(episodes);
      const picked = buildStorylines(signals, hook);
      storylines = await Promise.all(
        picked.map(async (storyline) => {
          const drafted = await draftFromStoryline(storyline, "", hook);
          return {
            storyline,
            episode: drafted.episode,
            source: drafted.source,
            ...(drafted.warning ? { warning: drafted.warning } : {}),
          };
        }),
      );
    } else if (change.kind === "pick") {
      limitTells(dataContext.actorUserId);
      const found = storylines.find((item) => item.storyline.id === change.id);
      if (!found) throw new Error("That story is no longer available. Refresh the week.");
      if (episodes.some((episode) => episode.status === "locked")) throw new Error("Finish the locked episode first.");
      const color = change.color.trim().slice(0, 500);
      const drafted = color ? await draftFromStoryline(found.storyline, color, lastHook(episodes)) : null;
      const episode = drafted
        ? { ...drafted.episode, draftSource: drafted.source, ...(drafted.warning ? { draftWarning: drafted.warning } : {}) }
        : found.episode;
      episodes = [...episodes.filter((item) => item.status !== "draft"), episode];
      storylines = [];
    } else if (change.kind === "custom") {
      limitTells(dataContext.actorUserId);
      const color = change.color.trim();
      if (!color) throw new Error("Add one line about the story first.");
      if (episodes.some((episode) => episode.status === "locked")) throw new Error("Finish the locked episode first.");
      const signals = await collectWeekSignals(tx, dataContext.brandId);
      const storyline: Storyline = {
        id: "custom",
        kind: "custom",
        headline: color.slice(0, 220),
        metrics: signalMetrics(signals).length > 0 ? signalMetrics(signals) : ["A quiet week in the numbers"],
        hook: lastHook(episodes) || "What happens next?",
        confirm: "Confirm every fact on screen before filming.",
        serviceLine:
          signals.replyMedianBusinessSeconds !== null
            ? `Our firm-wide median reply was ${wordsForBusinessSeconds(signals.replyMedianBusinessSeconds)} of business time.`
            : "Our week in numbers is above; add 1 firm-wide service number before locking.",
      };
      const drafted = await draftFromStoryline(storyline, color, lastHook(episodes));
      episodes = [
        ...episodes.filter((item) => item.status !== "draft"),
        { ...drafted.episode, draftSource: drafted.source, ...(drafted.warning ? { draftWarning: drafted.warning } : {}) },
      ];
      storylines = [];
    } else if (change.kind === "edit" || change.kind === "lock" || change.kind === "regenerate") {
      const edited = episodeSchema.parse(change.episode);
      const index = episodes.findIndex((episode) => episode.id === edited.id && episode.status === "draft");
      if (index < 0) throw new Error("This draft is no longer available.");
      if (edited.status !== "draft" || edited.publishedUrl !== null || edited.createdAt !== episodes[index].createdAt) {
        throw new Error("This draft was changed outside the editor.");
      }
      if (change.kind === "regenerate") {
        if (!regenerated || !Number.isInteger(change.index) || change.index < 0 || change.index >= edited.beats.length) throw new Error("Beat not found.");
        edited.beats[change.index] = regenerated.beat;
        edited.draftSource = regenerated.source;
        edited.draftWarning = regenerated.warning;
      }
      if (change.kind === "lock") {
        if (!change.privacyChecked) throw new Error("Check the privacy note before locking.");
        const [contacts, accounts, clients] = await Promise.all([
          tx.contact.findMany({ where: { brandId: dataContext.brandId }, select: { name: true, firstName: true, lastName: true, company: true }, take: 2000 }),
          tx.customerAccount.findMany({ where: { brandId: dataContext.brandId }, select: { name: true, legalName: true }, take: 2000 }),
          tx.operationsClient.findMany({ where: { brandId: dataContext.brandId }, select: { name: true }, take: 2000 }),
        ]);
        const knownNames = [
          ...contacts.flatMap((contact) => [contact.name, contact.firstName, contact.lastName, contact.company]),
          ...accounts.flatMap((account) => [account.name, account.legalName]),
          ...clients.map((client) => client.name),
        ].filter((value): value is string => Boolean(value));
        validateForLock(edited, lastHook(episodes), knownNames);
        edited.status = "locked";
      }
      episodes[index] = edited;
    } else if (change.kind === "clip") {
      const index = episodes.findIndex((episode) => episode.id === change.id && episode.status === "locked");
      if (index < 0 || !Number.isInteger(change.index) || change.index < 0 || change.index >= episodes[index].beats.length) throw new Error("Clip not found.");
      episodes[index].done[change.index] = change.done;
    } else if (change.kind === "publish") {
      const index = episodes.findIndex((episode) => episode.id === change.id && episode.status === "locked");
      if (index < 0) throw new Error("Locked episode not found.");
      const url = new URL(change.url);
      if (!["youtube.com", "www.youtube.com", "youtu.be"].includes(url.hostname) || url.protocol !== "https:") throw new Error("Use a YouTube link.");
      episodes[index].status = "published";
      episodes[index].publishedUrl = url.toString();
      episodes[index].mountainAtPublish = mountainCurrent;
      episodes[index].showDollarsAtPublish = showDollars;
      episodes[index].serviceAtPublish = episodes[index].serviceNumber;
      storylines = [];
    } else {
      if (change.current !== null && (!Number.isInteger(change.current) || change.current < 0 || change.current > 1000000)) throw new Error("Enter a whole-dollar number.");
      mountainCurrent = change.current;
      showDollars = change.showDollars;
    }
    await tx.showrunnerStudio.update({
      where: { brandId: dataContext.brandId },
      data: {
        episodes: episodes as unknown as Prisma.InputJsonValue,
        storylines: storylines as unknown as Prisma.InputJsonValue,
        mountainCurrent,
        showDollars,
      },
    });
    return change.kind === "regenerate" ? episodes.find((episode) => episode.id === episodeSchema.parse(change.episode).id) : undefined;
  });
  revalidatePath("/showrunner/studio");
  revalidatePath("/showrunner/series");
  return result;
}
