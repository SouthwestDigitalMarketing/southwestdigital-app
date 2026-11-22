import { z } from "zod";
import { answersSchema, beatSchema, episodeSchema, makeDraft, type Answers, type Episode } from "./studio";
import type { Storyline } from "./storylines";

export type Beat = z.infer<typeof beatSchema>;

const outlineSchema = z.object({
  title: z.string().trim().min(1).max(90),
  question: z.string().trim().min(1).max(220),
  payoff: z.string().trim().min(1).max(300),
  hook: z.string().trim().min(1).max(220),
  beats: z.array(beatSchema).min(4).max(6),
});

const outlineJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "question", "payoff", "hook", "beats"],
  properties: {
    title: { type: "string" },
    question: { type: "string" },
    payoff: { type: "string" },
    hook: { type: "string" },
    beats: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "talk", "show"],
        properties: {
          name: { type: "string" },
          talk: { type: "array", items: { type: "string" } },
          show: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

const INSTRUCTIONS = `You are Johnny, planning a weekly episode of The $10K Month for real estate investors and landlords who may hire the firm. The season asks whether the firm can climb to $10,000 per month. Help Tom pick a true story about serving clients and show how easy it is to work with the firm.

Return an episode outline, never a script. Make 4 to 6 beats in this order: what came up, how we handled it, what happened, the scoreboard (mountain and one FIRM-WIDE service number), and a hook for next week. Give each beat 2 to 4 short talking topics and 1 to 3 things to show. One beat is one clip, filmed in order. The first beat picks up last week's hook when present; the last beat tees up next week. Use Tom's answers for specific substance and chronology.

Privacy is absolute: no client name, company, person, identifying detail, client payment, client-specific financial figure, or real client screen. Do not copy a name from the notes. Use generic phrases such as “a landlord” or “a client”. Only firm-wide numbers may appear, and only if Tom explicitly supplied them as firm-wide. Do not invent facts, outcomes, numbers, a service metric, or a screen that is safe to show. If a fact is missing, use a talking topic such as “Confirm the result before filming” or “Tom to supply a firm-wide reply time”. Never say or imply Thomas answers the phone; a callback can be mentioned only when true in the answers. If the input includes a previousHook, repeat it VERBATIM in the first beat's first talking point and answer it in this episode. The next hook must be an open question, not a promised outcome. Return only the requested JSON.`;

export type DraftResult = {
  episode: Episode;
  source: "openai" | "guided";
  warning?: string;
};

function outputText(response: unknown): string | null {
  if (!response || typeof response !== "object") return null;
  const value = response as { status?: unknown; output_text?: unknown; output?: unknown };
  if (value.status !== "completed") return null;
  if (typeof value.output_text === "string") return value.output_text;
  if (!Array.isArray(value.output)) return null;
  for (const item of value.output) {
    if (!item || typeof item !== "object" || !("content" in item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (content && typeof content === "object" && "type" in content && content.type === "output_text" && "text" in content && typeof content.text === "string") return content.text;
    }
  }
  return null;
}

function privateNameCandidates(answers: Answers): string[] {
  const words = Object.values(answers).join("\n");
  const candidates = words.match(/\b(?:[A-Z][a-z]+|[A-Z]{2,})(?:\s+(?:[A-Z][a-z]+|[A-Z]{2,})){1,3}\b/g) ?? [];
  const companySuffixes = [...words.matchAll(/\b([A-Za-z][A-Za-z0-9-]+)\s+(LLC|Inc|Corp|Ltd)\b/gi)].map((match) => `${match[1]} ${match[2]}`);
  const namedPeople = [...words.matchAll(/\b(?:client|customer|named|called)\s+([a-z]{3,})\b/gi)].map((match) => match[1]);
  const commonWords = /^(?:the|this|that|our|tom|firm|one|name|situation|had|has|was|were|did|does|is|needs|needed|sent|signed|wants|called|with|for|and|who|what|when|where|why|how|which|will|would|can|could|should|shall|may|might|must|names|their|they|got|gets|asked|received|records|books)$/i;
  return [...candidates.filter((candidate) => !/^(?:The|This|That|Our|We|A|An|One|Tom|Client|Firm)\b/i.test(candidate)), ...companySuffixes, ...namedPeople.filter((name) => !commonWords.test(name))];
}

/** Catches echoed names and client figures before model text reaches the storyboard. */
export function hasPrivacyLeak(outline: unknown, answers: Answers): boolean {
  const text = JSON.stringify(outline);
  if (/\$\s*(?!10(?:,?000|K)\b)\d[\d,.]*(?:\s*[kKmM])?\b/.test(text)) return true;
  if (/\b(?:client|customer)\s+(?:name|paid|pays|fee|rate)\s*:/i.test(text)) return true;
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text)) return true;
  if (/\b(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/.test(text)) return true;
  return privateNameCandidates(answers).some((name) => text.toLowerCase().includes(name.toLowerCase()));
}

/** Draft with the configured OpenAI key. A safe local outline remains available if AI fails. */
export async function draftWithAI(rawAnswers: Answers, previousHook: string): Promise<DraftResult> {
  const answers = answersSchema.parse(rawAnswers);
  const fallback = (warning: string): DraftResult => ({ episode: makeDraft(answers, previousHook), source: "guided", warning });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return fallback("AI is not configured here. A guided outline is ready to edit.");

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.SHOWRUNNER_OPENAI_MODEL || "gpt-4.1-mini",
        store: false,
        max_output_tokens: 2200,
        instructions: INSTRUCTIONS,
        input: JSON.stringify({ previousHook: previousHook.trim().slice(0, 220), answers }),
        text: { format: { type: "json_schema", name: "episode_outline", strict: true, schema: outlineJsonSchema } },
      }),
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    return fallback("AI could not be reached. A guided outline is ready to edit.");
  }
  if (!response.ok) return fallback("AI could not be reached. A guided outline is ready to edit.");

  try {
    const text = outputText(await response.json());
    if (!text) return fallback("AI returned no usable outline. A guided outline is ready to edit.");
    const outline = outlineSchema.parse(JSON.parse(text));
    const hook = previousHook.trim().slice(0, 220);
    if (hook && !outline.question.includes(hook) && !outline.beats[0].talk.some((point) => point.includes(hook))) {
      if (hook.length <= 180) outline.beats[0].talk[0] = hook;
      else outline.question = hook;
    }
    if (hasPrivacyLeak(outline, answers)) return fallback("AI included a private detail. A guided outline is ready to edit.");
    const base = makeDraft(answers, previousHook);
    const episode = episodeSchema.parse({ ...base, ...outline, done: outline.beats.map(() => false) });
    return { episode, source: "openai" };
  } catch {
    return fallback("AI returned an invalid outline. A guided outline is ready to edit.");
  }
}

/** A storyline's firm-wide numbers become the draft's answers. Nothing else goes in. */
export function storylineAnswers(storyline: Storyline, colorLine: string): Answers {
  return answersSchema.parse({
    happened: `${storyline.headline} ${storyline.metrics.join(". ")}.`,
    handled: "Built from firm-wide numbers. No client names or prices.",
    outcome: colorLine.trim() || storyline.confirm,
    service: storyline.serviceLine,
    next: storyline.hook,
  });
}

/** Drafts a storyboard from a picked storyline plus Tom's optional color line. */
export async function draftFromStoryline(
  storyline: Storyline,
  colorLine: string,
  previousHook: string,
): Promise<DraftResult> {
  return draftWithAI(storylineAnswers(storyline, colorLine), previousHook);
}

export type BeatResult = { beat: Beat; source: "openai" | "guided"; warning?: string };

/** Reworks one beat while leaving the rest of a draft in Tom's chosen order. */
export async function regenerateBeat(episode: Episode, index: number): Promise<BeatResult> {
  const current = episodeSchema.parse(episode);
  if (current.status !== "draft" || !Number.isInteger(index) || index < 0 || index >= current.beats.length) {
    throw new Error("Choose a beat from the current draft.");
  }
  const guidedBeat: Beat = {
    name: "Another angle",
    talk: index === 0 && current.carriedHook.length <= 180 && current.carriedHook
      ? [current.carriedHook, "Explain why this question matters to a landlord"]
      : ["Tell the real part of this story in your own words", "Say what you still need to confirm"],
    show: ["Tom to camera", "A safe example with no real client details"],
  };
  const fallback = (warning: string): BeatResult => ({ beat: guidedBeat, source: "guided", warning });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return fallback("AI is not configured here. A guided beat is ready to edit.");

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.SHOWRUNNER_OPENAI_MODEL || "gpt-4.1-mini",
        store: false,
        max_output_tokens: 700,
        instructions: `You are Johnny, planning one clip of The $10K Month for real estate investors and landlords. Regenerate exactly ONE storyboard beat, never a script. Return 2 to 4 short talking topics and 1 to 3 things to show. Keep this beat's job in the episode, but find a fresh, concrete angle using only Tom's answers. Never invent facts, outcomes, numbers, people or safe screens. No client name, company, people, identifying detail, client payment or client-specific figure. A firm-wide number is allowed only if explicitly marked firm-wide in Tom's answers. Never promise Thomas answers the phone. For beat 1, include the previous hook verbatim in a talking point when provided. Return only the requested JSON.`,
        input: JSON.stringify({
          title: current.title,
          question: current.question,
          payoff: current.payoff,
          nextHook: current.hook,
          previousHook: current.carriedHook,
          answers: current.answers,
          beatNumber: index + 1,
          beatToReplace: current.beats[index],
          precedingBeat: current.beats[index - 1] ?? null,
          followingBeat: current.beats[index + 1] ?? null,
        }),
        text: { format: { type: "json_schema", name: "episode_beat", strict: true, schema: outlineJsonSchema.properties.beats.items } },
      }),
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    return fallback("AI could not be reached. A guided beat is ready to edit.");
  }
  if (!response.ok) return fallback("AI could not be reached. A guided beat is ready to edit.");

  try {
    const text = outputText(await response.json());
    if (!text) return fallback("AI returned no usable beat. A guided beat is ready to edit.");
    const beat = beatSchema.parse(JSON.parse(text));
    if (index === 0 && current.carriedHook && !beat.talk.some((point) => point.includes(current.carriedHook))) {
      if (current.carriedHook.length <= 180) beat.talk[0] = current.carriedHook;
    }
    if (hasPrivacyLeak(beat, current.answers)) return fallback("AI included a private detail. A guided beat is ready to edit.");
    return { beat, source: "openai" };
  } catch {
    return fallback("AI returned an invalid beat. A guided beat is ready to edit.");
  }
}
