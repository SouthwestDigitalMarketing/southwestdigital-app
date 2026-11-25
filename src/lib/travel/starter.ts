import { randomUUID } from "node:crypto";
import { parseItem, type SectionKey, type TripItem, type TripPlan, emptyPlan } from "./plan";

/**
 * The first trip, from Donna's 2026-11-25 research (prices are web snapshots found that day,
 * not live fares): 60 days abroad without a car, running Bookkeeping Conroe and filming.
 */
export const REMOTE_MONTHS_TITLE = "Two months abroad, no car";

const SUMMARY =
  "Bag, laptop and phone. A cheap long stay with good Wi-Fi, run Bookkeeping Conroe remotely, " +
  "and film it for The Real Estate Bookkeeper. 60 days. No clients need us in person. " +
  "Prices in Options are web snapshots found 2026-11-25, not live fares.";

const SEED: Partial<Record<SectionKey, Array<Record<string, string | number | boolean | null>>>> = {
  options: [
    {
      place: "Mexico City",
      roundTrip: 214,
      oneWay: 78,
      monthly: 1500,
      visaFree: "Up to 180 days; the officer decides",
      timeGap: "Same time (1 hour behind from 2027-03-14)",
      safety: "Mexico Level 2 (confirm)",
      notes: "Round trip $214-350 Volaris/Viva early Dec; one way $78-109 Viva. Rent $1,300-1,800/mo all-in living in Narvarte. Metro, Uber, walkable.",
      gym: "Anytime Fitness Cuauhtémoc (north of Reforma; no platform listed). For cleans and snatches: CrossFit Condesa, CrossFit Barrio (Narvarte), Inpeak Insurgentes; drop-ins about $10-16.",
      shakes: 260,
      martialArts: "Muay Thai: KIN Muay Thai (Roma Norte), Muy Muay Thai (Hipódromo). BJJ: Atlas Grappling (Narvarte), Zenith BJJ about $30-60/month, coaches explain in English.",
      internet: "Median home speed about 100 Mbps; 50-200 Mbps in Roma/Condesa. Storm power cuts happen. Impact Hub day pass about $18. Unlimited eSIM $62-83 for 30 days.",
      music: "Buy: Calle Bolívar music shops (Casa Veerkamp); new acoustic $74-232. Blues: El 61 / Ruta 61 Thursday jam (2018 info), Pata Negra blues Tuesdays, Casa Franca. Confirm on Instagram.",
      source: "https://www.vivaaerobus.com/en-us/flights-from-houston-to-mexico-city",
    },
    {
      place: "Mérida, Mexico",
      roundTrip: 300,
      oneWay: 142,
      monthly: 1200,
      visaFree: "Up to 180 days; the officer decides",
      timeGap: "Same time",
      safety: "Yucatán Level 1",
      notes: "United nonstop from IAH (fares thin: ~$300-375 round trip). $1,100-1,300/mo. Buses ~$0.50, rides $3-5. Hot.",
      gym: "3 Anytime Fitness clubs, none near Centro. CrossFit Cupra (Buenavista, near Itzimná) and Badass Athletics (weightlifting classes). Bumper plates not confirmed; ask on WhatsApp.",
      shakes: 260,
      martialArts: "BJJ: Henosis Jiu Jitsu (near Itzimná, mornings), Gracie Allegiance, Dream Jiujitsu. No men's Muay Thai found. No prices posted.",
      internet: "Average about 55 Mbps; fiber up to 300 Mbps, but not in every old Centro building. Storm power cuts. 24/7 coworking about $100-200/month.",
      music: "Shops (unconfirmed): Casa Musical de Mérida, Centro Musical del Sureste. Blues: Cantina El Dzalbay (jazz and blues nightly), El Cardenal. No confirmed sit-in night.",
      source: "https://meridaliving.com/digital-nomad-merida/",
    },
    {
      place: "Medellín, Colombia",
      roundTrip: 492,
      oneWay: null,
      monthly: 1200,
      visaFree: "90 days, extendable to 180",
      timeGap: "1 hour ahead",
      safety: "Colombia Level 3: reconsider travel",
      notes: "Frontier 1-stop Jan 4-Feb 2, 2027 ~$492 (checked 2026-10-13). $1,000-1,600/mo. Metro ~$1 a ride.",
      gym: "No Anytime Fitness in Medellín. CrossFit DLX (El Poblado, drop-ins welcome), Forja CrossFit (Laureles, about $90/month, unverified), BullBox CrossFit (Laureles).",
      shakes: 340,
      martialArts: "Zona de Combate (El Poblado: BJJ, Muay Thai, MMA), MMA Factory BJJ drop-in about $8, Evolution Fight Club Muay Thai (English-speaking owners). Monthly prices by WhatsApp.",
      internet: "Fiber 100-300 Mbps; short outages, keep phone data. Atom House coworking $10/day. Local SIM $10-25/month.",
      music: "Shops: Más Musical, Pasaje Junín arcade; beginner guitar $60-180. Jam: El Club del Jazz, Thursdays 8 pm, bring your instrument (about $10 cover). No blues jam found.",
      source: "https://helloaxel.com/en/flights/from-houston-to-medellin-mde",
    },
    {
      place: "Fukuoka, Japan",
      roundTrip: 809,
      oneWay: 460,
      monthly: 1400,
      visaFree: "90 days",
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
    {
      place: "Chiang Mai, Thailand",
      roundTrip: 1000,
      oneWay: 453,
      monthly: 900,
      visaFree: "30 days (since 2026-09-15), +30 for about $57",
      timeGap: "13 hours ahead: Conroe 8-5 is 9 PM-6 AM",
      safety: "Level 1 (confirm)",
      notes: "Round trip to Bangkok $990-1,100, then a short flight. $850-1,000/mo. Needs passport valid 6 months and a ticket out.",
      gym: "Anytime Fitness only in Mae Rim (outside the city). CFCNX CrossFit: 300 THB drop-in (about $9), Olympic lifting needs experience. Pulmo Weightlifting sessions Mon/Wed 6 pm.",
      shakes: 350,
      martialArts: "Muay Thai capital: Kru Dam unlimited 6,399 THB/month (about $190), Hongthong 8,000 THB. BJJ: Lazy Leopard (two gyms, one in the Old City), price not found.",
      internet: "Nimman condos 200-500 Mbps fiber; AIS most stable. Burning season Feb-Apr: bad air for training. Coworking about $90-180/month. AIS tourist SIM about $36 for 30 days.",
      music: "Buy: Patr Music near North Gate, Cin Guitars; Yamaha F310 about $145. Jams: North Gate Jazz Co-op Tuesdays, Soi Dog Blues Bar Sunday blues jam, Boy Blues Bar. Avocados are off season in January.",
      source: "https://nomadbriefing.com/visa/us-citizens/thailand/",
    },
  ],
  budget: [
    { item: "Round trip flight", category: "Getting there", planned: null, actual: null, notes: "Fill in when the place is picked." },
    { item: "Lodging, 60 days", category: "Lodging", planned: null, actual: null, notes: "" },
    { item: "Food, 60 days", category: "Food", planned: null, actual: null, notes: "" },
    { item: "Local transit", category: "Local transit", planned: null, actual: null, notes: "" },
    { item: "Protein shakes, 60 days", category: "Food", planned: null, actual: null, notes: "Two a day. About $260-350 per 30 days depending on the place (whey is half the cost). See Options." },
    { item: "Gym and martial arts", category: "Other", planned: null, actual: null, notes: "CrossFit or weightlifting gym plus BJJ or Muay Thai. See Options." },
    { item: "Phone data / eSIM", category: "Phone and internet", planned: null, actual: null, notes: "Keep the US number working for login codes." },
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
      document: "Arrival form for the place we pick",
      who: "Tom",
      status: "Need it",
      expires: "",
      due: "",
      cost: null,
      how: "Mexico: digital entry at Mexico City airport (paper FMM elsewhere). Japan: Visit Japan Web. Thailand: TDAC arrival card plus a ticket out. Colombia: Check-MIG. Fill in once the place is picked.",
      link: "",
    },
  ],
  entry: [
    {
      rule: "Remote work on a tourist entry",
      detail: "A gray area everywhere on the list. Mexico usually tolerates it; Japan sources conflict; Colombia and Thailand entries are for tourism.",
      source: "",
      checked: "2026-11-25",
    },
    {
      rule: "Passport validity",
      detail: "Thailand wants 6 months left on the passport and proof of a ticket out. Check the others once the place is picked.",
      source: "https://nomadbriefing.com/visa/us-citizens/thailand/",
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
