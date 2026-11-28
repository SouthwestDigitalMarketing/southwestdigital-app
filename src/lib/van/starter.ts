import { randomUUID } from "node:crypto";
import { emptyPlan, parseItem, type VanPlan } from "./plan";

/** Donna's 2026-11-28 shortlist. Listing facts are a dated snapshot, not live availability. */
export const SHORTLIST_DATE = "2026-11-28";
const CANDIDATES = [
  {
    year: 2018, make: "Ram", model: 'ProMaster 2500 159" high roof', price: 44000, miles: 78000, city: "Austin, TX",
    seller: "Private — Mariano Gru", contact: "Vanlife Trader message",
    link: "https://vanlifetrader.com/listing/2018-ram-promaster-off-grid-adventure-vans-camper-2d57da/",
    batteryAh: 400, solarW: 300, inverterW: 1000, power: "LiFePO4 battery",
    heat: "Webasto gas heater", ac: "Dometic roof AC (shore power)", water: "26 gal fresh", bathroom: "Composting toilet",
    notes: "Top 3. Ask battery age, service records, rust / roof leaks and title status.",
  },
  {
    year: 2016, make: "Mercedes-Benz", model: "Sprinter 144 4x4 high roof", price: 49990, miles: 98000, city: "Austin, TX",
    seller: "Private — RV Trader", contact: "RV Trader listing",
    link: "https://www.rvtrader.com/listing/2016-Mercedes-Benz-SPRINTER+144+4X4-5042481435",
    inverterW: 3000, power: "Solar: 4 panels; watts and battery capacity not listed",
    heat: "Diesel heater", ac: "DC roof AC", water: "25 gal", bathroom: "None",
    notes: "Top 3. Sink filter leak. Ask if fixed; confirm battery type / Ah and solar watts. Sprinter shop for chassis inspection.",
  },
  {
    year: 2014, make: "Ram", model: "ProMaster high roof (Master Overland)", price: 45000, miles: 70000, city: "Lindale, TX",
    seller: "Private — Da'Niel Beauchamp", contact: "Vanlife Trader message",
    link: "https://vanlifetrader.com/listing/brand-new-transmission-rebuilt-engine-2014-ram-promaster-2wd-5d07fc/",
    batteryAh: 200, solarW: 320, power: "LiFePO4 battery; Victron 2000VA inverter (watts not confirmed)",
    heat: "Gas heater", ac: "Zero Breeze AC", bathroom: "Indoor shower",
    notes: "Top 3. New transmission + rebuilt engine. Ask who did the work, receipts and warranty; confirm battery capacity (200Ah or 250Ah).",
  },
  {
    year: 2008, make: "Pleasure-Way", model: "Excel TS", price: 32995, miles: 126311, city: "Houston, TX",
    seller: "Dealer — Ppl Motor Homes", contact: "713-234-1176; stock M1542 / RV code 7959",
    link: "https://www.rvtrader.com/listing/2008-Pleasure-Way-Pleasure-Way+EXCEL+TS-5043058606",
    power: "Onan generator", ac: "Roof AC", water: "24 / 26 / 12 gal tanks",
    notes: "Backup. Ask generator hours, house battery age, furnace / water heater, water damage and Ford chassis service records.",
  },
  {
    year: 2019, make: "Ram", model: "ProMaster 1500 high roof (Wayfarer Vans)", price: 30500, miles: 152000, city: "McKinney, TX",
    seller: "Private — Chase Lucido", contact: "Vanlife Trader message",
    link: "https://vanlifetrader.com/listing/2019-ram-promaster-2wd-832e69/",
    power: "Portable power station + 800W EcoFlow alternator charger", water: "20 gal, gray tank", bathroom: "None",
    notes: "Backup. High miles; minor dents (front roof, driver door), windshield pebble marks. Heat / AC not listed; vent fan only listed.",
  },
];

/** A blank hunt still gets editable needs and unquoted planning lines. */
export function starterPlan(shortlist = true): VanPlan {
  const plan = emptyPlan();
  plan.sections.needs = ["No bathroom needed", "Pay cash", "Stealth / city parking", "Off-grid power: lithium + solar", "Heat without a plug", "Budget $30–50K"]
    .map((name) => parseItem("needs", { id: randomUUID(), name }));
  plan.sections.costs = ["Insurance", "Registration", "Inspection", "Maintenance", "Upgrades"]
    .map((name) => parseItem("costs", { id: randomUUID(), name, amount: null }));
  if (shortlist) plan.sections.candidates = CANDIDATES.map((item) => parseItem("candidates", { id: randomUUID(), ...item, status: "Watching" }));
  return plan;
}
