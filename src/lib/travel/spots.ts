import type { SPOT_KINDS } from "./plan";

/**
 * Suggested day-to-day spots for the five options in the starter trip, from web research on
 * 2026-11-25 (sources: ripley ~/Documents/travel/2026-11-25-spots-research.md). "(unverified)" in
 * an area means the exact branch or address was not confirmed. An option's page offers these with
 * "Add suggested spots"; photos and pins are looked up when they are added.
 */
type Suggestion = { option: string; kind: (typeof SPOT_KINDS)[number]; name: string; area: string; why: string; link: string };

const MX = "Mexico City";
const MID = "Mérida, Mexico";
const MDE = "Medellín, Colombia";
const FUK = "Fukuoka, Japan";
const CNX = "Chiang Mai, Thailand";

export const SUGGESTED_SPOTS: readonly Suggestion[] = [
  { option: MX, kind: "Neighborhood to stay", name: "Roma Norte", area: "Cuauhtémoc", why: "Leafy, walkable streets full of cafés and coworking; the area most often recommended to remote workers.", link: "https://en.wikipedia.org/wiki/Roma,_Mexico_City" },
  { option: MX, kind: "Neighborhood to stay", name: "Condesa", area: "Cuauhtémoc", why: "Quiet, tree-lined streets and parks next to Roma, with the gyms and music on this list in walking distance.", link: "https://en.wikipedia.org/wiki/Condesa" },
  { option: MX, kind: "Work spot", name: "Blend Station", area: "Condesa (Tamaulipas 60)", why: "Large, lively café with strong Wi-Fi, open 8am to 8pm every day.", link: "https://blendstation.com.mx" },
  { option: MX, kind: "Work spot", name: "BUNA (Roma)", area: "Roma Norte (Orizaba 42)", why: "Specialty coffee open 8am to 9pm every day; guides list stable Wi-Fi and outlets.", link: "https://buna.mx/pages/cafeterias" },
  { option: MX, kind: "Work spot", name: "WeWork Mexico City", area: "Juárez (Varsovia 36) and other sites", why: "Fallback coworking with desks and quiet rooms for calls.", link: "https://www.wework.com/l/mexico-city" },
  { option: MX, kind: "Gym", name: "CrossFit Condesa", area: "Condesa", why: "Affiliated box with about 800 m² of training space, close to Roma and Condesa.", link: "https://www.crossfit.com/gym/14502/crossfit-condesa" },
  { option: MX, kind: "Gym", name: "CrossFit Barrio", area: "Narvarte Poniente (unverified)", why: "Official CrossFit affiliate; WhatsApp contact on the listing.", link: "https://www.crossfit.com/gym/35925/crossfit-barrio" },
  { option: MX, kind: "Martial arts", name: "KIN Muay Thai", area: "Roma Norte (Guanajuato 202)", why: "Small Muay Thai studio for all levels: technique, pads, bags and sparring.", link: "https://wellhub.com/es-mx/search/partners/kin-muay-thai-roma-norte/" },
  { option: MX, kind: "Martial arts", name: "Atlas Grappling México", area: "Narvarte Poniente (Xola 1113)", why: "BJJ, Muay Thai and MMA with early, midday and evening classes.", link: "https://wellhub.com/es-mx/search/partners/atlas-grappling-mexico-narvarte-poniente/" },
  { option: MX, kind: "Getting around", name: "Mexico City Metro", area: "Insurgentes, Sevilla and Chilpancingo stations ring Roma and Condesa", why: "5 MXN a ride, flat. The rechargeable MI card also works on Metrobús.", link: "https://en.wikipedia.org/wiki/Mexico_City_Metro" },
  { option: MX, kind: "Getting around", name: "Ecobici", area: "Roma, Condesa, Narvarte and central areas", why: "Bike share: 588 MXN a year for unlimited 45-minute rides (2026).", link: "https://en.wikipedia.org/wiki/Ecobici_(Mexico_City)" },
  { option: MX, kind: "Music", name: "Pata Negra (Condesa)", area: "Condesa (Tamaulipas)", why: "Long-running bar with live jazz, blues or son jarocho some nights from about 9pm.", link: "https://www.facebook.com/BarPataNegraMX/" },
  { option: MX, kind: "Music", name: "Casa Franca", area: "Roma Norte (Mérida 109)", why: "Jazz and blues bar in an old mansion; bands Tuesday to Saturday.", link: "https://www.instagram.com/casafrancajazz/" },
  { option: MX, kind: "Groceries", name: "Chedraui Selecto", area: "Branch near Roma/Condesa (unverified)", why: "Premium supermarket chain for produce, dairy and protein, with Rappi delivery.", link: "https://www.chedraui.com.mx" },

  { option: MID, kind: "Neighborhood to stay", name: "Centro Histórico (Santa Ana / Santiago)", area: "Centro", why: "The most walkable part of the city, with cafés, English speakers and the music on this list.", link: "https://en.wikipedia.org/wiki/M%C3%A9rida,_Yucat%C3%A1n" },
  { option: MID, kind: "Neighborhood to stay", name: "García Ginerés", area: "Just west of Centro", why: "Quiet, safe and residential with good Wi-Fi; a short walk or ride to Centro.", link: "https://www.google.com/maps/search/?api=1&query=Garc%C3%ADa+Giner%C3%A9s+M%C3%A9rida+Yucat%C3%A1n" },
  { option: MID, kind: "Work spot", name: "Márago Coffee", area: "Paseo de Montejo and Centro (Calle 60)", why: "Specialty café with roomy tables, some outlets and decent Wi-Fi, open 7:30am to 10pm.", link: "https://www.instagram.com/maragocoffee.mx/" },
  { option: MID, kind: "Work spot", name: "El Apapacho", area: "Centro (Calle 62 #354)", why: "Café and restaurant that welcomes remote workers and has Wi-Fi.", link: "https://www.facebook.com/ElApapacho/" },
  { option: MID, kind: "Work spot", name: "Conexión60 Coworking", area: "Centro (Calle 60 #346)", why: "Coworking with desks, meeting rooms and 24/7 access (prices unconfirmed).", link: "https://www.coworkingcafe.com/coworking-property/mx/yuc/merida/conexion60/" },
  { option: MID, kind: "Gym", name: "CrossFit Cupra", area: "Buenavista (Calle 60 Norte x37d #261)", why: "Mérida's CrossFit and Hyrox affiliate, open since 2015.", link: "https://www.instagram.com/crossfitcupra/" },
  { option: MID, kind: "Gym", name: "Badass Athletics", area: "Felipe Carrillo Puerto, plus a branch in Centro", why: "Cross-training gym with weightlifting classes; the Centro branch is near where we would stay.", link: "https://www.instagram.com/badass.athletic/" },
  { option: MID, kind: "Martial arts", name: "Henosis Jiu Jitsu Academy", area: "Felipe Carrillo Puerto", why: "BJJ school that also teaches judo, wrestling and MMA.", link: "https://wellhub.com/es-mx/search/partners/henosis-jiu-jitsu-academy-felipe-carrillo-puerto/" },
  { option: MID, kind: "Getting around", name: "Va y Ven bus system", area: "Citywide", why: "12 MXN a ride with the Va y Ven card; transfers are discounted.", link: "https://vayven.yucatan.gob.mx" },
  { option: MID, kind: "Getting around", name: "IE-TRAM", area: "Electric bus lines across the city", why: "Electric 'tram' buses, 14 MXN a ride on the same card; airport route 45 MXN.", link: "https://en.wikipedia.org/wiki/Ie-Tram_Yucat%C3%A1n" },
  { option: MID, kind: "Music", name: "Cantina El Dzalbay", area: "Centro (Calle 64 x 53)", why: "Old cantina run by expat musicians: live jazz, blues and rock on a rooftop stage.", link: "https://www.instagram.com/dzalbaycantina/" },
  { option: MID, kind: "Groceries", name: "Súper Akí", area: "Branch near Centro (unverified)", why: "Local supermarket chain for milk, oats, fruit and protein.", link: "https://www.superaki.mx" },

  { option: MDE, kind: "Neighborhood to stay", name: "Laureles", area: "Laureles-Estadio", why: "Flat, leafy and walkable, more local and cheaper than Poblado, and on the Metro.", link: "https://es.wikipedia.org/wiki/Laureles-Estadio" },
  { option: MDE, kind: "Neighborhood to stay", name: "El Poblado", area: "Comuna 14", why: "Most cafés and coworking, and home to both CrossFit boxes on this list.", link: "https://en.wikipedia.org/wiki/El_Poblado" },
  { option: MDE, kind: "Work spot", name: "Pergamino Café", area: "El Poblado (Carrera 37 #8A-37), also Laureles", why: "The café guides recommend most for work: solid Wi-Fi and many outlets.", link: "https://pergamino.co" },
  { option: MDE, kind: "Work spot", name: "Semilla Café Coworking", area: "Laureles", why: "Café-coworking; a day pass includes unlimited coffee and a desk.", link: "https://www.facebook.com/semillacafecoworking/" },
  { option: MDE, kind: "Work spot", name: "Café Revolución", area: "Laureles (Carrera 73 #4-6)", why: "Nomad-hub café with outlets and solid Wi-Fi, breakfast all day from 7am.", link: "https://www.instagram.com/caferevolucion/" },
  { option: MDE, kind: "Gym", name: "CrossFit DLX", area: "El Poblado (Carrera 32 #2 Sur-127)", why: "Long-running affiliate that welcomes drop-ins.", link: "https://www.crossfit.com/gym/8217/crossfit-dlx" },
  { option: MDE, kind: "Gym", name: "BullBox Mde CrossFit", area: "Laureles (unverified)", why: "Official CrossFit affiliate; a second option for barbell work.", link: "https://www.crossfit.com/gym/29712/bullbox-mde-crossfit" },
  { option: MDE, kind: "Martial arts", name: "Zona de Combate MMA", area: "El Poblado (Carrera 49 #16-16)", why: "Boxing, Muay Thai, wrestling and jiu-jitsu, with private lessons.", link: "https://www.instagram.com/zonadecombate_/" },
  { option: MDE, kind: "Martial arts", name: "Evolution Fight Club", area: "Laureles-Estadio (unverified)", why: "Muay Thai with English-speaking owners.", link: "https://www.instagram.com/evolution_fight_club/" },
  { option: MDE, kind: "Getting around", name: "Metro de Medellín", area: "Line A through Poblado; Line B to Estadio and Laureles", why: "About 3,430-3,820 COP a ride with a personalized Cívica card; get it at a station.", link: "https://www.metrodemedellin.gov.co" },
  { option: MDE, kind: "Getting around", name: "Metrocable", area: "Cable-car lines linked to Metro stations", why: "Gondolas included in the Metro system, on the same Cívica card.", link: "https://en.wikipedia.org/wiki/Metrocable_(Medell%C3%ADn)" },
  { option: MDE, kind: "Music", name: "El Club del Jazz", area: "San Ignacio, Centro (Calle 54 #45-11)", why: "Jazz club with a Thursday jam session; bring your instrument (about 25,000 COP cover).", link: "https://elclubdeljazz.com/" },
  { option: MDE, kind: "Groceries", name: "Carulla Laureles", area: "Laureles (address unverified)", why: "Full supermarket with bakery and deli, near Estadio station.", link: "https://www.carulla.com" },

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

  { option: CNX, kind: "Neighborhood to stay", name: "Nimmanhaemin", area: "West of the Old City, by Maya mall", why: "The main nomad area: coworking, cafés and a big supermarket a short walk apart.", link: "https://www.google.com/maps/search/?api=1&query=Nimmanhaemin+Road+Chiang+Mai" },
  { option: CNX, kind: "Neighborhood to stay", name: "Chiang Mai Old City", area: "Inside the moat", why: "Walkable, flat and quieter, close to the jazz and blues bars and Urban Leopard BJJ.", link: "https://www.google.com/maps/search/?api=1&query=Old+City+Chiang+Mai" },
  { option: CNX, kind: "Work spot", name: "Yellow Coworking", area: "Nimman (Soi 5)", why: "Desks, phone booths and a café; day pass 429 THB, monthly 5,990 THB with 24/7 access.", link: "https://www.timeout.com/chiang-mai/things-to-do/yellow-coworking" },
  { option: CNX, kind: "Work spot", name: "Punspace", area: "Nimman, Tha Phae Gate and Old City", why: "Long-running coworking; one pass covers all three sites.", link: "https://www.punspace.com" },
  { option: CNX, kind: "Work spot", name: "Alt_ Chiang Mai", area: "Old City / Wat Ket", why: "Coworking plus coliving; day pass from 220 THB, monthly from 4,000 THB.", link: "https://www.facebook.com/altcolivingCM/" },
  { option: CNX, kind: "Gym", name: "CrossFit Chiang Mai (CFCNX)", area: "Chang Phueak (47 Chotana Rd)", why: "Thailand's first CrossFit affiliate (2010), long known for Olympic lifting.", link: "https://cfcnxfitness.com" },
  { option: CNX, kind: "Gym", name: "CrossFit Pulmo", area: "Mae Hia (unverified)", why: "CrossFit, Hyrox and dedicated weightlifting sessions.", link: "https://www.instagram.com/pulmo.cnx/" },
  { option: CNX, kind: "Martial arts", name: "Krudam Gym Chiangmai", area: "Suthep (2/1 Bunrueangrit Rd)", why: "Run by SEA Games champion Dam Srichan; classes for all levels, open daily.", link: "https://www.instagram.com/krudamgym_chiangmai/" },
  { option: CNX, kind: "Martial arts", name: "Lazy Leopard BJJ / Urban Leopard", area: "World Club and Old City", why: "Black-belt-led BJJ with a new branch inside the Old City walls.", link: "https://lazyleopardbjj.com" },
  { option: CNX, kind: "Getting around", name: "Songthaew (red trucks)", area: "Citywide", why: "Shared red pickups, about 30-60 THB a person; agree the price before you get in.", link: "https://en.wikipedia.org/wiki/Songthaew" },
  { option: CNX, kind: "Getting around", name: "Grab", area: "Citywide", why: "Cars and motorbike taxis with the price fixed upfront.", link: "https://www.grab.com/th/en/" },
  { option: CNX, kind: "Music", name: "Soi Dog Blues Bar", area: "Old City (95/4 Sitthiwong Rd)", why: "Live blues, soul, jazz and funk Friday to Sunday; Sunday blues jam.", link: "https://www.instagram.com/soidogblues/" },
  { option: CNX, kind: "Music", name: "North Gate Jazz Co-op", area: "Chang Phueak Gate, Old City", why: "Live music every night from 7:30pm; sets often turn into open jams.", link: "https://www.facebook.com/northgate.jazzcoop/" },
  { option: CNX, kind: "Groceries", name: "Rimping Supermarket (Maya)", area: "Nimman (Maya mall, B1)", why: "Widest range of imported and local food in town, open 10am to 10pm.", link: "https://www.rimping.com" },
];

/** Suggestions for an option that it does not already have (matched by name, ignoring case). */
export function suggestionsFor(option: string, existingNames: Iterable<string>): Suggestion[] {
  const have = new Set([...existingNames].map((name) => name.trim().toLowerCase()));
  const key = option.trim().toLowerCase();
  return SUGGESTED_SPOTS.filter((spot) => spot.option.toLowerCase() === key && !have.has(spot.name.toLowerCase()));
}
