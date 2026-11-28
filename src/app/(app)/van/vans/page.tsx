import { loadVanPlan } from "../load";
import { VanClient } from "../VanClient";

export const dynamic = "force-dynamic";

export default async function VanVansPage() {
  return <VanClient plan={await loadVanPlan()} view="vans" />;
}
