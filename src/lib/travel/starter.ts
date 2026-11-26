import { randomUUID } from "node:crypto";
import { parseItem, type SectionKey, type TripItem, type TripPlan, emptyPlan } from "./plan";

/**
 * The Japan trip (Tom, 2026-11-26: "let's just focus on japan"), from the 2026-11-25 research
 * (prices are web snapshots found that day, not live fares): 60 days in Fukuoka without a car,
 * running Bookkeeping Conroe and filming. Earlier comparison of five places: git history and ripley
 * ~/Documents/travel/2026-11-25-remote-month-comparison.md.
 */
export const REMOTE_MONTHS_TITLE = "Japan: two months, no car";
export const REMOTE_MONTHS_DESTINATION = "Fukuoka, Japan";

const SUMMARY =
  "Bag, laptop and phone. Two months in Fukuoka with good Wi-Fi, run Bookkeeping Conroe remotely, " +
  "and film it for The Real Estate Bookkeeper. No clients need us in person. " +
  "Prices are web snapshots found 2026-11-25, not live fares.";

const SEED: Partial<Record<SectionKey, Array<Record<string, string | number | boolean | null>>>> = {
  options: [
    {
      place: "Fukuoka, Japan",
      roundTrip: 809,
      monthly: 1400,
      visaFree: "90 days",
      hoursAhead: 15,
      timeGap: "15 hours ahead: Conroe 8-5 is 11 PM-8 AM",
      safety: "Level 1 (confirm)",
      notes: "ZIPAIR nonstop IAH-Narita $669-850; $809 Nov 30-Dec 14 on Google Flights. ¥160k-250k/mo. Best transit, best video. Remote work on a tourist entry is unclear.",
      gym: "CrossFit Hakata (15 min walk from Hakata Station): ¥33,000/month drop-in (about $220), weightlifting-certified coach, needs 2+ months CrossFit experience. Anytime Fitness Hakata-ekimae ¥7,920/month; US key may work, but assume no drops.",
      shakes: 270,
      martialArts: "Master Japan Fukuoka (BJJ, no-gi, kickboxing; English instructor): ¥11,000 for 2 weeks, ¥15,400/month (about $103). Axis BJJ wants 2 months up front.",
      internet: "Fiber about 300 Mbps typical; some buildings VDSL capped at 100 Mbps. Engineer Cafe in Tenjin is free coworking. eSIM about $30-82 for 30 days.",
      music: "Used guitars: Shimamura Music, Amu Plaza Hakata 7F. Blues: BB Kenchan Sunday blues session (date unknown), Tribe open jam, jazz jams. Confirm on Instagram.",
      source: "https://www.google.com/travel/flights/flights-from-houston-to-tokyo.html",
    },
  ],
  budget: [
    { item: "Round trip flight", category: "Getting there", planned: 809, actual: null, notes: "ZIPAIR nonstop Houston-Narita; $809 on Google Flights for Nov 30-Dec 14 (seen 2026-11-25). Recheck for real dates." },
    { item: "Living, 60 days (rent, food, transit)", category: "Lodging", planned: 2800, actual: null, notes: "About ¥160k-250k a month in Fukuoka; $1,400/month used." },
    { item: "Protein shakes, 60 days", category: "Food", planned: 540, actual: null, notes: "Two a day, about ¥670 (~$4.50) each. Order whey from Myprotein Japan; Costco is out of town." },
    { item: "CrossFit Hakata, 2 months", category: "Other", planned: 440, actual: null, notes: "¥33,000/month drop-in plan (about $220)." },
    { item: "Master Japan BJJ, 2 months", category: "Other", planned: 206, actual: null, notes: "¥15,400/month unlimited (about $103)." },
    { item: "Phone data / eSIM", category: "Phone and internet", planned: 120, actual: null, notes: "About $30-82 per 30 days. Keep the US number working for login codes." },
    { item: "Passport renewal", category: "Fees and documents", planned: 130, actual: null, notes: "Routine book renewal fee; +$60 to expedite. See Documents." },
    { item: "Travel insurance", category: "Insurance", planned: null, actual: null, notes: "" },
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
    { title: "Running a bookkeeping firm from abroad", idea: "A real work day: clients, Double, QuickBooks, the time zone.", place: "", filmed: false, link: "" },
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
