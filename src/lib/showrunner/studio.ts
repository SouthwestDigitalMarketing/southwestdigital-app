import { z } from "zod";
import canon from "./canon.json";

export const SERIES = {
  title: canon.title,
  target: canon.goal.target,
  waypoints: canon.mountain.waypoints,
  starter: canon.pilot.title,
} as const;

/** Said the same way at the top of every episode. Always clip 1. */
export const LOGLINE: string = canon.logline;

const short = (max: number) => z.string().trim().min(1).max(max);
export const answersSchema = z.object({
  happened: short(1500),
  handled: short(1500),
  outcome: short(1500),
  service: short(500),
  next: short(500),
});
export type Answers = z.infer<typeof answersSchema>;

export const beatSchema = z.object({
  name: short(80),
  talk: z.array(short(180)).min(2).max(4),
  show: z.array(short(180)).min(1).max(3),
});
export const episodeSchema = z.object({
  id: z.string().uuid(),
  title: short(90),
  question: short(220),
  payoff: short(300),
  hook: short(220),
  // Older saved drafts predate the explicit scoreboard field. Keep them readable.
  serviceNumber: short(180).default("Tom to supply a firm-wide service number"),
  carriedHook: z.string().max(220),
  answers: answersSchema,
  beats: z.array(beatSchema).min(4).max(6),
  status: z.enum(["draft", "locked", "published"]),
  done: z.array(z.boolean()),
  publishedUrl: z.string().url().nullable(),
  createdAt: z.string().datetime(),
  draftSource: z.enum(["openai", "guided"]).optional(),
  draftWarning: z.string().max(240).optional(),
  mountainAtPublish: z.number().int().nullable().optional(),
  showDollarsAtPublish: z.boolean().optional(),
  serviceAtPublish: z.string().max(500).optional(),
}).superRefine((episode, context) => {
  if (episode.done.length !== episode.beats.length) {
    context.addIssue({ code: "custom", message: "Clip progress does not match storyboard." });
  }
});
export type Episode = z.infer<typeof episodeSchema>;

export function parseEpisodes(value: unknown): Episode[] {
  return z.array(episodeSchema).parse(value);
}

export function lastHook(episodes: Episode[]): string {
  return [...episodes].reverse().find((episode) => episode.status === "published")?.hook ?? "";
}

// Only the high-level subject of an answer reaches the public storyboard. Raw
// answers are private planning notes: names and client figures cannot leak by echo.
export function makeDraft(answers: Answers, previousHook: string, id = crypto.randomUUID()): Episode {
  const a = answersSchema.parse(answers);
  const carriedHook = previousHook.trim().slice(0, 220);
  return episodeSchema.parse({
    id,
    title: "This week on the climb",
    question: carriedHook || "What came up for our clients this week?",
    payoff: "Show what changed and what the client could do next.",
    hook: "What changes next week?",
    serviceNumber: a.service.slice(0, 180),
    carriedHook,
    answers: a,
    beats: [
      { name: "The logline", talk: [LOGLINE, carriedHook ? "Pick up last week's question" : "Say why this week's story matters"], show: ["Tom to camera"] },
      { name: "What came up", talk: ["Describe the problem without naming a client", "Explain what the client needed"], show: ["Tom to camera", "A safe, made-up example if a screen helps"] },
      { name: "How we helped", talk: ["Walk through the steps we took", "Show how easy the process was for the client"], show: ["Anonymized process or example screen", "Tom to camera"] },
      { name: "The result", talk: ["Say what actually happened", "Say what is still unknown"], show: ["Tom to camera", "A result graphic with no client figures"] },
      { name: "Scoreboard and next week", talk: ["Show the mountain and one firm-wide service number", "Give the honest current position", "Tease next week's question"], show: ["Mountain graphic", "Firm-wide service number", "Tom to camera"] },
    ],
    status: "draft",
    done: [false, false, false, false, false],
    publishedUrl: null,
    createdAt: new Date().toISOString(),
    draftSource: "guided",
  });
}

function privateTermsFromAnswers(answers: Answers): string[] {
  const source = Object.values(answers).join("\n");
  const properNames = source.match(/\b(?:[A-Z][a-z]+|[A-Z]{2,})(?:\s+(?:[A-Z][a-z]+|[A-Z]{2,})){1,3}\b/g) ?? [];
  const organizations = source.match(/\b[a-z][a-z0-9 &'-]{2,50}\s+(?:llc|inc|ltd|corp)\b/gi) ?? [];
  const namedPeople = [...source.matchAll(/\b(?:client|customer|named|called)\s+([a-z]{3,})\b/gi)].map((match) => match[1]);
  const generic = /^(?:The|This|That|Our|We|A|An|One|Tom|Client|Firm)\b/i;
  const commonWords = /^(?:name|situation|had|has|was|were|did|does|is|needs|needed|sent|signed|wants|called|with|for|and|who|what|when|where|why|how|which|will|would|can|could|should|shall|may|might|must|names|their|they|got|gets|asked|received|records|books)$/i;
  return [...properNames.filter((name) => !generic.test(name)), ...organizations, ...namedPeople.filter((name) => !commonWords.test(name))];
}

export function validateForLock(episode: Episode, previousHook: string, knownPrivateTerms: string[] = []): Episode {
  const parsed = episodeSchema.parse(episode);
  if (parsed.status !== "draft") throw new Error("Only a draft can be locked.");
  if (!/\d/.test(parsed.serviceNumber) || !/\b(?:firm-wide|our|average|median)\b/i.test(parsed.serviceNumber)) {
    throw new Error("Add one real firm-wide service number before locking.");
  }
  if (previousHook && parsed.carriedHook !== previousHook) throw new Error("Last week's hook changed. Start a fresh plan.");
  if (!parsed.beats[0].talk.some((line) => line.includes(LOGLINE))) {
    throw new Error("Clip 1 is the logline, said the same way every time.");
  }
  if (previousHook && ![parsed.question, ...parsed.beats[0].talk].some((line) => line.includes(previousHook))) {
    throw new Error("Put last week's hook in the question or first clip.");
  }
  const serialized = JSON.stringify({ title: parsed.title, question: parsed.question, payoff: parsed.payoff, hook: parsed.hook, serviceNumber: parsed.serviceNumber, beats: parsed.beats });
  const terms = [...privateTermsFromAnswers(parsed.answers), ...knownPrivateTerms].filter((term) => term.trim().length >= 4);
  if (terms.some((term) => serialized.toLowerCase().includes(term.trim().toLowerCase())) || /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(serialized) || /\b(?:\+?1[-. ]?)?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}\b/.test(serialized)) {
    throw new Error("Remove names, email addresses, and phone numbers before locking.");
  }
  if (/\b(?:client|customer)\s+(?:name|paid|pays|fee|rate)\s*:/i.test(serialized) || /\$\s*(?!10(?:,?000|K)\b)\d[\d,]*(?:\.\d\d)?/i.test(serialized)) {
    throw new Error("Remove client names and what a client pays before locking.");
  }
  return parsed;
}

export function mountainPosition(current: number | null): { name: string; percent: number } {
  const amount = Math.min(SERIES.target, Math.max(0, current ?? 0));
  const waypoint = [...SERIES.waypoints].reverse().find((point) => amount >= point.at)!;
  return { name: waypoint.name, percent: Math.round((amount / SERIES.target) * 100) };
}
