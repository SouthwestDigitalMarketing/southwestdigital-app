"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { withBrandDataTransaction } from "@/lib/tenancy/context";
import { checkRateLimit } from "@/lib/simpleRateLimit";
import { draftWithAI, regenerateBeat } from "@/lib/showrunner/studio-ai";
import { answersSchema, episodeSchema, lastHook, makePilotDraft, parseEpisodes, validateForLock } from "@/lib/showrunner/studio";

type Change =
  | { kind: "draft"; answers: unknown }
  | { kind: "pilot" }
  | { kind: "edit"; episode: unknown }
  | { kind: "lock"; episode: unknown; privacyChecked: boolean }
  | { kind: "regenerate"; episode: unknown; index: number }
  | { kind: "clip"; id: string; index: number; done: boolean }
  | { kind: "publish"; id: string; url: string }
  | { kind: "mountain"; current: number | null; showDollars: boolean };

export async function changeStudio(change: Change) {
  const { dataContext } = await requireStaffBrandOrThrow();
  let drafted: Awaited<ReturnType<typeof draftWithAI>> | null = null;
  let regenerated: Awaited<ReturnType<typeof regenerateBeat>> | null = null;
  let draftedAfterHook = "";
  if (change.kind === "draft") {
    if (!checkRateLimit(`showrunner-draft:${dataContext.actorUserId}`, 5, 60 * 60_000).allowed) {
      throw new Error("Too many drafts this hour. Edit the current plan or try later.");
    }
    const answers = answersSchema.parse(change.answers);
    const existing = await withBrandDataTransaction(dataContext, (tx) =>
      tx.showrunnerStudio.findUnique({ where: { brandId: dataContext.brandId }, select: { episodes: true } }),
    );
    const episodes = parseEpisodes(existing?.episodes ?? []);
    if (episodes.some((episode) => episode.status === "locked")) throw new Error("Finish the locked episode first.");
    draftedAfterHook = lastHook(episodes);
    // The network request happens outside the database transaction.
    drafted = await draftWithAI(answers, draftedAfterHook);
  } else if (change.kind === "regenerate") {
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
    let mountainCurrent = row.mountainCurrent;
    let showDollars = row.showDollars;
    if (change.kind === "draft") {
      if (episodes.some((episode) => episode.status === "locked")) throw new Error("Finish the locked episode first.");
      if (lastHook(episodes) !== draftedAfterHook || !drafted) throw new Error("The series changed while drafting. Try again.");
      const episode = { ...drafted.episode, draftSource: drafted.source, ...(drafted.warning ? { draftWarning: drafted.warning } : {}) };
      episodes = [...episodes.filter((item) => item.status !== "draft"), episode];
    } else if (change.kind === "pilot") {
      if (episodes.some((episode) => episode.status === "locked")) throw new Error("Finish the locked episode first.");
      episodes = [...episodes.filter((item) => item.status !== "draft"), makePilotDraft(lastHook(episodes))];
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
    } else {
      if (change.current !== null && (!Number.isInteger(change.current) || change.current < 0 || change.current > 1000000)) throw new Error("Enter a whole-dollar number.");
      mountainCurrent = change.current;
      showDollars = change.showDollars;
    }
    await tx.showrunnerStudio.update({
      where: { brandId: dataContext.brandId },
      data: { episodes: episodes as unknown as Prisma.InputJsonValue, mountainCurrent, showDollars },
    });
    return change.kind === "regenerate" ? episodes.find((episode) => episode.id === episodeSchema.parse(change.episode).id) : undefined;
  });
  revalidatePath("/showrunner/studio");
  revalidatePath("/showrunner/series");
  return result;
}
