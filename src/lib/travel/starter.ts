import { randomUUID } from "node:crypto";
import { JAPAN_DESTINATION, parseItem, type SectionKey, type TripItem, type TripPlan, emptyPlan } from "./plan";

/**
 * The Japan trip (Tom, 2026-11-26): about 6 weeks based in Tokyo (Koenji or Shimokitazawa, near the
 * jam sessions), then about 2 weeks in Kyoto and Osaka. From web research on 2026-11-26 (sources:
 * ripley ~/Documents/travel/2026-11-26-tokyo-kansai-research.md); prices are snapshots, not live
 * fares. Earlier plans (five places, then Fukuoka) are in git history.
 */
export const REMOTE_MONTHS_TITLE = "Japan: Tokyo, then Kyoto & Osaka";
export const REMOTE_MONTHS_DESTINATION = JAPAN_DESTINATION;

const SUMMARY =
  "Bag, laptop and phone. About 6 weeks based in Tokyo near the jam sessions, then 2 weeks in Kyoto " +
  "and Osaka. Grow Bookkeeping Conroe by day, film all over for The Real Estate Bookkeeper, play blues " +
  "at night. No clients need us in person. Prices are web snapshots found 2026-11-26, not live fares.";

const SEED: Partial<Record<SectionKey, Array<Record<string, string | number | boolean | null>>>> = {
  options: [
    {
      place: "Japan: Tokyo, Kyoto & Osaka",
      photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Skyscrapers_of_Shinjuku_2009_January.jpg/960px-Skyscrapers_of_Shinjuku_2009_January.jpg",
      lat: 35.6897,
      lng: 139.6922,
      roundTrip: 1036,
      monthly: 1362,
      visaFree: "90 days",
      hoursAhead: 15,
      timeGap: "15 hours ahead: Conroe 8-5 is 11 PM-8 AM",
      safety: "Level 1 (confirm)",
      notes: "About 6 weeks based in Koenji or Shimokitazawa (Tokyo), then about 2 weeks in Kyoto and Osaka by Shinkansen (14,170 yen, about $89, each way). Per month blends Tokyo (rent ~$880, food ~$485, transit ~$57) and Kyoto/Osaka (rent ~$690, food ~$440, transit ~$50) at 159 yen per dollar. Flight: Air Canada sample $1,036 for Jan 12-29, 2027; a 60-day trip may cost more; ZIPAIR nonstop to Narita was $809 for early Dec.",
      gym: "Black Ships Yoyogi: weightlifting gym with platforms where you can drop the bar; drop-in 5,000 yen (book ahead), unlimited 38,000 yen a month (~$239). Also CrossFit Daikanyama; in Osaka, A Plus CrossFit Umeda.",
      shakes: 233,
      martialArts: "Carpe Diem BJJ (Setagaya and Shibuya; visitors welcome; ~13,200-17,600 yen a month). PHOENIX Muay Thai (Kanda): 3,300 yen a day or 13,200 yen a month.",
      internet: "Home fiber around 300 Mbps is typical. (tefu) lounge Shimokitazawa coworking ~26,180 yen a month; SHARE LOUNGE Shibuya by the hour; .andwork Kyoto from 15,000 yen a month. eSIM about $30-82 per 30 days.",
      music: "Tokyo: music bar rpm (Shimokitazawa) jams almost nightly, bring your guitar, 3,500 yen to play; Love, Peace and Soul open jams (blues/funk); open mic at Aja (Nakano); Jirokichi (Koenji) blues shows. Kyoto: Coffee House Jittoku, Taku Taku. Osaka: THE RAINCOAT blues jams (12-hour blues jam Dec 5).",
      source: "https://www.aircanada.com/en-us/flights-from-houston-to-japan",
    },
  ],
  budget: [
    { item: "Round trip flight", category: "Getting there", planned: 1036, actual: null, notes: "Houston-Tokyo. Air Canada sample $1,036 for Jan 12-29, 2027 (seen 2026-11-26); recheck for real dates." },
    { item: "Living, Tokyo (about 45 days)", category: "Lodging", planned: 2133, actual: null, notes: "Rent ~140,000 yen a month (Oak House / Hmlet Koenji furnished), food ~$485, transit ~$57 a month." },
    { item: "Living, Kyoto & Osaka (about 15 days)", category: "Lodging", planned: 590, actual: null, notes: "Rent ~110,000 yen a month, food ~$440, transit ~$50 a month." },
    { item: "Shinkansen Tokyo-Kyoto and back", category: "Local transit", planned: 178, actual: null, notes: "Nozomi reserved seat 14,170 yen each way." },
    { item: "Protein shakes, 60 days", category: "Food", planned: 466, actual: null, notes: "About $233 per 30 days in Tokyo (whey from Myprotein Japan; avocados ~200 yen)." },
    { item: "Black Ships weightlifting, 2 months", category: "Other", planned: 540, actual: null, notes: "38,000 yen a month plus 10,000 yen joining fee." },
    { item: "Carpe Diem BJJ, 2 months", category: "Other", planned: 166, actual: null, notes: "About 13,200 yen a month." },
    { item: "Phone data / eSIM", category: "Phone and internet", planned: 120, actual: null, notes: "About $30-82 per 30 days. Keep the US number working for login codes." },
    { item: "Passport renewal", category: "Fees and documents", planned: 130, actual: null, notes: "Routine book renewal fee; +$60 to expedite. See Documents." },
    { item: "Travel insurance", category: "Insurance", planned: null, actual: null, notes: "" },
  ],
  travel: [
    { route: "Houston to Tokyo and back", mode: "Flight", date: "", carrier: "", cost: 1036, booked: false, link: "", notes: "Book after the passport renewal is in." },
    { route: "Tokyo to Kyoto", mode: "Train", date: "", carrier: "Tokaido Shinkansen (Nozomi)", cost: 89, booked: false, link: "", notes: "About 2h15m. Suica (Welcome Suica Mobile) works for boarding." },
    { route: "Kyoto to Tokyo", mode: "Train", date: "", carrier: "Tokaido Shinkansen (Nozomi)", cost: 89, booked: false, link: "", notes: "Back for the flight home." },
  ],
  itinerary: [
    { date: "", title: "Tokyo: about 6 weeks", plan: "Base in Koenji or Shimokitazawa. Days: clients, Double, QuickBooks, filming around Shinjuku, Shibuya, Yanaka. Nights: jams at music bar rpm, open jams, Jirokichi shows. Train at Black Ships and Carpe Diem.", done: false },
    { date: "", title: "Kyoto and Osaka: about 2 weeks", plan: "Stay central Kyoto (Nakagyo) or Juso in Osaka. Film temples and old streets; blues at Coffee House Jittoku, Taku Taku and THE RAINCOAT.", done: false },
  ],
  documents: [
    {
      document: "US passport",
      who: "Tom",
      status: "Need it",
      expires: "",
      due: "",
      cost: 130,
      how: "The current one has expired. Renew online at opr.travel.state.gov (MyTravelGov / Login.gov account): 10-year book, issued at 25 or older, applying from inside the US, same name, no trip in the next 6 weeks. Upload a recent color photo (white background, no glasses), pay $130 by card. Routine only, about 4-6 weeks. Faster: mail form DS-82 with +$60 expedite (about 2-3 weeks plus mail). Houston Passport Agency only for travel within 14 days (free appointment). Book flights after applying.",
      link: "https://opr.travel.state.gov/",
    },
    {
      document: "Visit Japan Web",
      who: "Tom",
      status: "Need it",
      expires: "",
      due: "",
      cost: null,
      how: "Japan's online arrival form (immigration and customs QR codes). Fill it in before the flight.",
      link: "https://www.vjw.digital.go.jp/",
    },
  ],
  entry: [
    {
      rule: "90 days visa-free",
      detail: "US citizens can visit Japan visa-free for up to 90 days; a 60-day stay fits. Japan may ask for the return ticket.",
      source: "",
      checked: "2026-11-25",
    },
    {
      rule: "Remote work on a tourist entry",
      detail: "Unclear in Japan: one guide says it is not permitted, another cites a government paper allowing remote work for an overseas employer for up to 90 days. The digital nomad visa needs about ¥10M a year in income.",
      source: "https://guide.genki.world/digital-nomad-visa-japan/",
      checked: "2026-11-25",
    },
  ],
  home: [
    { task: "Receive Silver Wings parts", who: "Tom", due: "2026-11-28", done: false, notes: "Arriving Nov 25-28." },
    { task: "Anytime Fitness: freeze, or confirm the key works abroad", who: "Tom", due: "", done: false, notes: "Anytime says US members can use clubs worldwide (some sources: after 30 days). Most clubs do not allow drops, so Olympic lifts likely need a CrossFit gym there; freezing saves money." },
    { task: "Mail: hold or forward", who: "", due: "", done: false, notes: "USPS holds up to 30 days; 60 days needs forwarding, a scan service, or a person." },
    { task: "The car: where it stays, who has the keys", who: "Tom", due: "", done: false, notes: "" },
    { task: "Keep US phone number for login codes", who: "Tom", due: "", done: false, notes: "QuickBooks, banks and Double text codes. Quo works over Wi-Fi." },
  ],
  videos: [
    { title: "Leaving with one bag", idea: "Why we are going, what fits in the bag, the budget.", place: "", filmed: false, link: "" },
    { title: "Running a bookkeeping firm from abroad", idea: "A real work day: clients, Double, QuickBooks, the time zone.", place: "Tokyo", filmed: false, link: "" },
    { title: "Sitting in at a Tokyo jam session", idea: "Bookkeeper by day, blues guitar by night in Shimokitazawa.", place: "Tokyo", filmed: false, link: "" },
  ],
};

export function remoteMonthsPlan(): TripPlan {
  const plan = emptyPlan();
  plan.summary = SUMMARY;
  for (const [key, items] of Object.entries(SEED) as Array<[SectionKey, Array<Record<string, unknown>>]>) {
    plan.sections[key] = items.map((item): TripItem => parseItem(key, { id: randomUUID(), ...item }));
  }
  return plan;
}

/** Titles the earlier starters used; a switched trip gets the current title only if it still has one of these. */
export const OLD_REMOTE_MONTHS_TITLES = ["Two months abroad, no car", "Japan: two months, no car"];

/** Budget lines the old five-place starter created (2026-11-25), recognised by name. */
const OLD_BUDGET_LINES = new Set([
  // Fukuoka plan (2026-11-26)
  "Living, 60 days (rent, food, transit)",
  "CrossFit Hakata, 2 months",
  "Master Japan BJJ, 2 months",
  // five-place plan (2026-11-25)
  "Round trip flight",
  "Lodging, 60 days",
  "Food, 60 days",
  "Local transit",
  "Protein shakes, 60 days",
  "Gym and martial arts",
  "Phone data / eSIM",
  "Passport renewal",
  "Travel insurance",
]);
const OLD_ARRIVAL_FORM = "Arrival form for the place we pick";
const OLD_ENTRY_DETAIL = /everywhere on the list|Thailand wants 6 months/;

function sameText(a: unknown, b: unknown) {
  return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
}

/**
 * Turns a trip made from an earlier starter (five places, or Fukuoka) into the Japan trip (Tokyo,
 * then Kyoto and Osaka; Tom, 2026-11-26) without losing what Tom added: keeps ticks, his own budget lines and
 * any line with money spent; drops the earlier places and their spots; swaps in the Japan budget,
 * Visit Japan Web and Japan entry rules; adds the Japan legs and itinerary when the trip has none
 * and any missing video ideas. Stays, places, needs and home are untouched.
 */
export function switchToJapan(plan: TripPlan, japan: TripPlan = remoteMonthsPlan()): TripPlan {
  const isJapan = (name: unknown) => sameText(name, REMOTE_MONTHS_DESTINATION);
  // Earlier places (including Fukuoka) and their spots go; a current Japan option Tom edited stays.
  const options = plan.sections.options.filter((option) => isJapan(option.place));
  // Old starter lines with nothing spent are swapped in place for the Japan line of the same name
  // (or dropped when Japan has none); everything else stays where it is; new Japan lines go last.
  const budget = plan.sections.budget.flatMap((line) => {
    if (!OLD_BUDGET_LINES.has(String(line.item ?? "")) || typeof line.actual === "number") return [line];
    const replacement = japan.sections.budget.find((candidate) => sameText(candidate.item, line.item));
    return replacement ? [{ ...replacement, id: line.id }] : [];
  });
  budget.push(...japan.sections.budget.filter((line) => !budget.some((kept) => sameText(kept.item, line.item))));
  const keptDocs = plan.sections.documents.filter((doc) => !sameText(doc.document, OLD_ARRIVAL_FORM));
  const documents = [
    ...keptDocs,
    ...japan.sections.documents.filter((doc) => !keptDocs.some((kept) => sameText(kept.document, doc.document))),
  ];
  const keptEntry = plan.sections.entry.filter((rule) => !OLD_ENTRY_DETAIL.test(String(rule.detail ?? "")));
  const entry = [
    ...japan.sections.entry.filter((rule) => !keptEntry.some((kept) => sameText(kept.rule, rule.rule))),
    ...keptEntry,
  ];
  return {
    ...plan,
    // Only the old starter's wording is replaced; a summary Tom wrote himself stays.
    summary: plan.summary.startsWith("Bag, laptop and phone.") || !plan.summary ? japan.summary : plan.summary,
    days: plan.days === 30 ? 60 : plan.days,
    sections: {
      ...plan.sections,
      options: options.length ? options : japan.sections.options,
      spots: plan.sections.spots.filter((spot) => isJapan(spot.option)),
      budget,
      documents,
      entry,
      // Legs and itinerary only fill in when the trip has none; Tom's own stay as they are.
      travel: plan.sections.travel.length ? plan.sections.travel : japan.sections.travel,
      itinerary: plan.sections.itinerary.length ? plan.sections.itinerary : japan.sections.itinerary,
      videos: [
        ...plan.sections.videos,
        ...japan.sections.videos.filter((video) => !plan.sections.videos.some((own) => sameText(own.title, video.title))),
      ],
    },
  };
}
