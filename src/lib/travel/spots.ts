import { JAPAN_DESTINATION, type SPOT_KINDS } from "./plan";

/**
 * Suggested day-to-day spots for the Japan trip (Tokyo, then Kyoto and Osaka), from web research on
 * 2026-11-26 (sources: ripley ~/Documents/travel/2026-11-26-tokyo-kansai-research.md). The area
 * names the city. "(unverified)" means the branch, address or price was not confirmed. The Japan
 * card's page offers these with "Add suggested spots"; photos and pins are looked up when added.
 * Earlier plans' spots (five places, Fukuoka) are in git history.
 */
/** lat/lng are approximate (the neighbourhood or nearest station, from Wikipedia), so pins never depend on a lookup. */
type Suggestion = {
  option: string;
  kind: (typeof SPOT_KINDS)[number];
  name: string;
  area: string;
  why: string;
  link: string;
  lat?: number;
  lng?: number;
  /** Set when the spot's page has no usable preview image of its own. */
  photo?: string;
};

const JP = JAPAN_DESTINATION;

export const SUGGESTED_SPOTS: readonly Suggestion[] = [
  { option: JP, kind: "Neighborhood to stay", name: "Koenji", area: "Koenji, Suginami, Tokyo", why: "Live-music and secondhand-shop area on the JR Chuo line, 6 minutes to Shinjuku; furnished monthly rooms from about 95,000 yen; Jirokichi and two cheap supermarkets nearby.", link: "https://en.wikipedia.org/wiki/K%C5%8Denji", lat: 35.7053, lng: 139.6511 },
  { option: JP, kind: "Neighborhood to stay", name: "Shimokitazawa", area: "Shimokitazawa, Setagaya, Tokyo", why: "Small-venue music area; music bar rpm's nightly jams and Carpe Diem Setagaya are close; furnished monthly rents list higher, about 200,000 yen and up.", link: "https://en.wikipedia.org/wiki/Shimokitazawa", lat: 35.6616, lng: 139.6666 },
  { option: JP, kind: "Work spot", name: "(tefu) lounge Shimokitazawa", area: "Shimokitazawa, Tokyo (unverified)", why: "Coworking lounge over the station with laptop tables and outlets; weekday membership about 26,180 yen a month (2023 price).", link: "https://www.timeout.jp/tokyo/ja/news/tefu-lounge-a-town-lounge-in-shimokitazawa-opens-for-business-012122", lat: 35.6614, lng: 139.6675 },
  { option: JP, kind: "Work spot", name: "SHARE LOUNGE Shibuya", area: "Shibuya Sakura Stage, Tokyo (unverified)", why: "Large paid work lounge with free drinks, open 8:00-23:00; about 1,650 yen an hour at its 2024 opening.", link: "https://www.ccc.co.jp/en/news/press/20240417_002157.html", lat: 35.6562, lng: 139.701 },
  { option: JP, kind: "Work spot", name: "Ii Office Koenji", area: "Koenji, Tokyo (unverified)", why: "Private booths and small rooms by the half hour (about 330 yen), handy for client calls and filming.", link: "https://www.instabase.jp/tokyo-s1131215-workspace", lat: 35.705, lng: 139.6494 },
  { option: JP, kind: "Gym", name: "Black Ships Yoyogi", area: "Yoyogi, Shibuya, Tokyo (5-57-6 Yoyogi, B1)", why: "Weightlifting gym with platforms where you can drop the bar; drop-in 5,000 yen (book ahead), unlimited 38,000 yen a month.", link: "https://www.black-ships.com/", lat: 35.6787, lng: 139.6936 },
  { option: JP, kind: "Gym", name: "CrossFit Daikanyama", area: "Daikanyama, Shibuya, Tokyo (24-1 Sarugakucho, B1) (unverified)", why: "CrossFit box with bilingual coaches; about 33,000 yen unlimited (2023); ask about drop-ins first.", link: "https://crossfit.com/gym/17256/crossfit-daikanyama", lat: 35.6517, lng: 139.7056 },
  { option: JP, kind: "Martial arts", name: "Carpe Diem BJJ", area: "Kyodo, Setagaya, Tokyo (also Shibuya)", why: "Big BJJ network that welcomes visitors and has an English phone line; about 13,200-17,600 yen a month; message before dropping in.", link: "https://carpediembjj.com/", lat: 35.6513, lng: 139.6365 },
  { option: JP, kind: "Martial arts", name: "PHOENIX Muay Thai", area: "Kanda / Akihabara, Tokyo (3-7-2 Iwamotocho, B1)", why: "Muay Thai open 7:00-22:00; first trial free, then 3,300 yen a day or 13,200 yen a month.", link: "https://phoenix-kick.com/en/", lat: 35.6948, lng: 139.776 },
  { option: JP, kind: "Getting around", name: "Welcome Suica Mobile", area: "Tokyo trains, subway and buses", why: "Free iPhone app for visitors; top up with Apple Pay, and it works for Shinkansen boarding.", link: "https://www.jreast.co.jp/multi/en/wsmlp/" },
  { option: JP, kind: "Getting around", name: "JR Chuo line and Tokyo Metro", area: "Koenji / Shimokitazawa to Shinjuku and Shibuya, Tokyo", why: "No car needed; IC fares from 155 yen, and Koenji to Shinjuku is about 6 minutes.", link: "https://en.wikipedia.org/wiki/Ch%C5%AB%C5%8D_Line_(Rapid)" },
  { option: JP, kind: "Music", name: "music bar rpm", area: "Shimokitazawa, Tokyo (2-7-5 Kitazawa, B1)", why: "Jam session almost every night 19:00-22:30; bring your guitar, 3,500 yen to play with 2 drinks, cash only.", link: "https://www.rpmshimokita.com/", lat: 35.661, lng: 139.668, photo: "https://www.rpmshimokita.com/wp-content/themes/rpmshimokita/images/ogp.jpg" },
  { option: JP, kind: "Music", name: "Love, Peace and Soul Live Cafe", area: "Kyodo, Setagaya, Tokyo", why: "Open jams tagged blues, funk and soul, all instruments welcome, 2,000 yen plus 2 drinks; dates change.", link: "https://www.tokyogigguide.com/en/gigs/event/40396-open-jam-session", lat: 35.651, lng: 139.637 },
  { option: JP, kind: "Music", name: "Groove Party open mic at Aja", area: "Nakano, Tokyo (one stop from Koenji)", why: "Open mic and jam with blues and funk, 2,000 yen plus 2 drinks; dates on the host's Facebook group.", link: "https://tokyogigguide.com/en/gigs/event/40724", lat: 35.7074, lng: 139.6638 },
  { option: JP, kind: "Music", name: "Jirokichi", area: "Koenji, Tokyo (2-3-4 Koenji-kita, B1)", why: "Long-running blues, jazz and funk live house with shows most nights at 19:30, about 3,000-5,000 yen; shows rather than open jams.", link: "https://jirokichi.net/", lat: 35.7058, lng: 139.6495, photo: "https://jirokichi.net/2014/wp-content/uploads/2025/08/68223b0ca9b06c52d116d64c07841956-1800x450.jpg" },
  { option: JP, kind: "Groceries", name: "OK Store and Gyomu Super Koenji", area: "Koenji-minami, Tokyo", why: "Two cheap supermarkets: milk, avocados and olive oil at OK; bulk peanut butter, oats and frozen avocado at Gyomu Super.", link: "https://www.gyomusuper.jp/", lat: 35.703, lng: 139.65 },
  { option: JP, kind: "Neighborhood to stay", name: "Nakagyo, Kyoto", area: "Shijo-Karasuma / Kawaramachi, Kyoto", why: "Central and walkable, near the subway and coworking; furnished monthly units about 72,000-135,000 yen.", link: "https://en.wikipedia.org/wiki/Nakagy%C5%8D-ku,_Kyoto", lat: 35.01, lng: 135.7514 },
  { option: JP, kind: "Work spot", name: ".andwork Kyoto", area: "Kawaramachi, Kyoto", why: "Coworking at 600 yen an hour or from 15,000 yen a month.", link: "https://www.xandwork.com/kyoto/", lat: 35.0037, lng: 135.769 },
  { option: JP, kind: "Music", name: "Coffee House Jittoku", area: "Kamigyo, Kyoto", why: "Live house in a 1970s sake storehouse with folk, blues and rock shows from about 1,000 yen.", link: "https://jittoku.com/", lat: 35.0297, lng: 135.7567 },
  { option: JP, kind: "Music", name: "Taku Taku", area: "Shimogyo, Kyoto", why: "Historic blues and rock club; Chicago guitarist Carlos Johnson played there in Nov 2026.", link: "https://takutaku.jp/", lat: 34.999, lng: 135.76 },
  { option: JP, kind: "Getting around", name: "Tokaido Shinkansen", area: "Tokyo to Kyoto, about 2h15m", why: "Nozomi reserved seat 14,170 yen; Kyoto subway plus bus day pass 1,100 yen.", link: "https://en.wikipedia.org/wiki/T%C5%8Dkaid%C5%8D_Shinkansen" },
  { option: JP, kind: "Neighborhood to stay", name: "Juso, Osaka", area: "Juso, Yodogawa, Osaka", why: "Cheaper, lively area one stop from Umeda; THE RAINCOAT is a minute from the station.", link: "https://en.wikipedia.org/wiki/J%C5%ABs%C5%8D_Station", lat: 34.7199, lng: 135.4828 },
  { option: JP, kind: "Music", name: "THE RAINCOAT", area: "Juso, Osaka (2-9-19 Juso-Higashi, 5F)", why: "Blues bar with many jams: a 12-hour blues jam (Dec 5, 1,000 yen), a monthly showcase jam, jump-blues and New Year's Eve jams.", link: "https://bar-raincoat.com/en/", lat: 34.7196, lng: 135.4835 },
  { option: JP, kind: "Gym", name: "A Plus CrossFit Umeda West", area: "Umeda, Osaka (unverified)", why: "CrossFit box near Umeda; drop-in about 3,000 yen (2026 guide); check the rules first.", link: "https://www.crossfit.com/gym/18430/a-plus-crossfit-umeda-west", lat: 34.7, lng: 135.497 },
];

/** Suggestions for an option that it does not already have (matched by name, ignoring case). */
export function suggestionsFor(option: string, existingNames: Iterable<string>): Suggestion[] {
  const have = new Set([...existingNames].map((name) => name.trim().toLowerCase()));
  const key = option.trim().toLowerCase();
  return SUGGESTED_SPOTS.filter((spot) => spot.option.toLowerCase() === key && !have.has(spot.name.toLowerCase()));
}
