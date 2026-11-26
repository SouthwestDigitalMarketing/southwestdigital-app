import type { SPOT_KINDS } from "./plan";

/**
 * Suggested day-to-day spots for the Japan trip (Fukuoka), from web research on 2026-11-25
 * (sources: ripley ~/Documents/travel/2026-11-25-spots-research.md). Japan only since Tom's
 * 2026-11-26 focus; the other four places' spots are in git history. "(unverified)" in an area
 * means the branch or address was not confirmed. An option's page offers these with "Add
 * suggested spots"; photos and pins are looked up when they are added.
 */
type Suggestion = { option: string; kind: (typeof SPOT_KINDS)[number]; name: string; area: string; why: string; link: string };

const FUK = "Fukuoka, Japan";

export const SUGGESTED_SPOTS: readonly Suggestion[] = [
  { option: FUK, kind: "Neighborhood to stay", name: "Tenjin", area: "Chūō-ku, next to Daimyo", why: "Downtown subway hub with the coworking, cafés and jazz club on this list.", link: "https://en.wikipedia.org/wiki/Tenjin,_Fukuoka" },
  { option: FUK, kind: "Neighborhood to stay", name: "Hakata", area: "Hakata-ku", why: "Around the main station: cheapest central rents, close to CrossFit Hakata and Master Japan.", link: "https://en.wikipedia.org/wiki/Hakata-ku,_Fukuoka" },
  { option: FUK, kind: "Work spot", name: "Engineer Cafe", area: "Tenjin (1-15-30 Tenjin)", why: "Free city-run workspace with booths and meeting rooms.", link: "https://engineercafe.jp" },
  { option: FUK, kind: "Work spot", name: "Manu Coffee Daimyo", area: "Daimyo", why: "Roomy local coffee shop, open 10am to 1am, work-friendly with Wi-Fi.", link: "https://manucoffee.com" },
  { option: FUK, kind: "Work spot", name: "WeWork Daimyo", area: "Daimyo (1-1-29 Daimyo)", why: "Full coworking with a lounge; all-access 42,900 yen a month.", link: "https://www.wework.com/l/fukuoka" },
  { option: FUK, kind: "Gym", name: "CrossFit Hakata", area: "Hakata-ku (18-30 Hiemachi)", why: "Kyushu's first CrossFit box, coached in English and Japanese; drop-ins and a one-week trial.", link: "https://crossfit-hakata.com" },
  { option: FUK, kind: "Martial arts", name: "Master Japan Fukuoka", area: "Hakata-ku (Commercial Mall Hakata 2F)", why: "BJJ, kickboxing and MMA; visitors welcome, one instructor teaches in English.", link: "https://masterjapan.jp" },
  { option: FUK, kind: "Getting around", name: "Fukuoka City Subway", area: "Tenjin and Hakata are 5 minutes apart", why: "From 210 yen; tap a contactless bank card (640 yen daily cap) or a Hayakaken card.", link: "https://en.wikipedia.org/wiki/Fukuoka_City_Subway" },
  { option: FUK, kind: "Getting around", name: "Nishitetsu bus", area: "Citywide", why: "Dense bus network; the downtown loop is a flat fare. Same IC card.", link: "https://www.nishitetsu.jp/en/" },
  { option: FUK, kind: "Music", name: "Jazz Club Kingfish", area: "Daimyo (1-1-10 Daimyo, 2F)", why: "Live jazz most nights from 8:30pm, plus sessions you can join.", link: "https://www.instagram.com/jazzclubkingfish/" },
  { option: FUK, kind: "Music", name: "Back to Back (music bar)", area: "Nakasu (2-1-11 Nakasu, 5F)", why: "Small soul, rock'n'roll and funk bar; the closest thing to a blues bar found.", link: "https://www.instagram.com/back_to_back_nakasu/" },
  { option: FUK, kind: "Groceries", name: "Bon Repas", area: "Hakata Station and Yakuin", why: "Bigger supermarket with produce and dairy, open until 9-10pm.", link: "https://www.bonrepas.jp" },
];

/** Suggestions for an option that it does not already have (matched by name, ignoring case). */
export function suggestionsFor(option: string, existingNames: Iterable<string>): Suggestion[] {
  const have = new Set([...existingNames].map((name) => name.trim().toLowerCase()));
  const key = option.trim().toLowerCase();
  return SUGGESTED_SPOTS.filter((spot) => spot.option.toLowerCase() === key && !have.has(spot.name.toLowerCase()));
}
