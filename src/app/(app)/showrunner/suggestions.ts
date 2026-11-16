export type Episode = { title: string; what: string; where: string; who: string };

export type SeriesSuggestion = {
  slug: string;
  title: string;
  pitch: string;
  finale: string;
  next: string;
  why: string[];
  episodes: Episode[];
  pick?: boolean;
};

// Showrunner's drafts (2026-11-15), built from the channel numbers, the business notes in the All Thing, and the CTA decision.
// Numbers are as of 2026-11-15 and go stale. Clients appear only with their agreement; shoot plans are not scripts.
export const SUGGESTIONS: SeriesSuggestion[] = [
  {
    slug: "one-man-ai-team",
    title: "One Man, an AI Team",
    pitch: "One bookkeeper. An AI team. Can they run a real firm?",
    finale: "The month closes, the AI did the work, and a new client signs.",
    next: "Season 2: from 5 clients to a $10k month. Season 3: toward $100k a month.",
    pick: true,
    why: [
      "Your goal is a one-man firm doing $100k a month, with AI doing the routine work.",
      "Nobody else is filming this. It is your edge.",
      "You can make it happen: it does not wait on someone else.",
      "Retention is 24.9% against a 30% goal. A story with a finale keeps people watching.",
    ],
    episodes: [
      { title: "The bet", what: "Say the goal. Introduce the AI team and what each one does.", where: "Your desk, with the screens behind you.", who: "You." },
      { title: "Day one", what: "Give the team a messy set of books. Let it break.", where: "Your desk.", who: "You and the AI team on screen." },
      { title: "The AI gets it wrong", what: "Show a real mistake. Show how you catch it.", where: "Your desk.", who: "You." },
      { title: "A real landlord", what: "One client's month, start to finish.", where: "Your desk, and on a call.", who: "You and a client who agreed to be on camera." },
      { title: "Stranger to client", what: "A prospect calls. Follow it to a yes or a no.", where: "Office, phone.", who: "You and a prospect who agreed." },
      { title: "Close the month", what: "Everything closes with you only approving. Count the clients.", where: "Your desk.", who: "You." },
    ],
  },
  {
    slug: "first-five-clients",
    title: "First 5 Clients From YouTube",
    pitch: "Can a YouTube channel bring in five real clients?",
    finale: "Client number 5 signs.",
    next: "Season 2: 5 clients to 25.",
    why: [
      "Every video already sends people to realestatebookkeeper.com.",
      "It ties straight to money.",
      "You cannot force a client to sign. That makes the suspense real.",
    ],
    episodes: [
      { title: "Zero", what: "State the goal and where you are today.", where: "Your desk.", who: "You." },
      { title: "The first call", what: "A stranger from the channel calls. Walk through it.", where: "Phone, office.", who: "You and a caller who agreed." },
      { title: "The no", what: "A prospect passes. What you learn.", where: "Office.", who: "You." },
      { title: "The yes", what: "Client 1 or 2 signs. How it happened.", where: "Office.", who: "You and the client, if they agree." },
      { title: "Fix the funnel", what: "Change what is not working, using the numbers.", where: "Your desk.", who: "You." },
      { title: "Number five", what: "Client 5 signs. Count it.", where: "Office.", who: "You." },
    ],
  },
  {
    slug: "messy-landlord-books",
    title: "A Landlord's Messy Books",
    pitch: "Take a real landlord's books from a mess to clean.",
    finale: "The CPA gets clean books, and the landlord sees the real profit per property.",
    next: "Season 2: a landlord with ten properties.",
    why: [
      "Your best older videos are practical how-tos and lead-getting ideas.",
      "Landlords and short-term rental hosts are who you serve.",
      "Before and after is easy to follow and easy to watch.",
    ],
    episodes: [
      { title: "The mess", what: "Open the books. Show what is wrong.", where: "Your desk.", who: "You and the landlord, with permission." },
      { title: "Sort it out", what: "Categorize a year of transactions.", where: "Your desk.", who: "You." },
      { title: "The accounts do not match", what: "Reconcile the bank and card accounts.", where: "Your desk.", who: "You." },
      { title: "Property by property", what: "Split profit and loss per property.", where: "Your desk.", who: "You." },
      { title: "Hand it to the CPA", what: "Give the CPA what they need.", where: "Your desk.", who: "You and the CPA, if they agree." },
      { title: "The real profit", what: "Show the landlord the real numbers per property.", where: "A call or in person.", who: "You and the landlord." },
    ],
  },
];

export function findSuggestion(slug: string) {
  return SUGGESTIONS.find((s) => s.slug === slug);
}
