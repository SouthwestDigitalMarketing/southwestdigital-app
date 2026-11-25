import { parseItem, type TripItem } from "./plan";

/**
 * What Tom needs on any trip (Tom, 2026-11-25). Every new trip starts with these in Daily needs;
 * each trip then says how that place covers them.
 */
export const SHAKE_RECIPE =
  "Twice a day. Per shake: 1 avocado, 2 scoops whey protein, 2 heaping tbsp peanut butter, " +
  "a small bottle of whole milk, a squirt of olive oil, 1 cup oats. Needs a blender in the rental.";

const STANDING_NEEDS: Array<{ need: string; plan: string }> = [
  {
    need: "Gym with Olympic lifting",
    plan: "Bumper plates, a platform and Olympic bars for cleans and snatches. Anytime Fitness: home membership works at clubs worldwide (check with the home club), but most Anytime clubs do not allow drops, so a weightlifting or CrossFit gym may be needed. Otherwise freeze the Anytime membership.",
  },
  { need: "Protein shakes, 2 a day", plan: SHAKE_RECIPE },
  { need: "BJJ or Muay Thai", plan: "A gym that takes drop-ins or a monthly plan." },
  { need: "Fast, reliable internet", plan: "Fiber in the rental (ask the host for a speed test) plus a phone data plan as backup; coworking if the rental is weak." },
  { need: "Guitar and blues gigs", plan: "Bring a guitar or buy a used one there; find blues jams or open mics at night." },
];

export function standingNeeds(newId: () => string): TripItem[] {
  return STANDING_NEEDS.map((item) => parseItem("needs", { id: newId(), ...item }));
}
