import { loadLocalSeoData, STORAGE_MISSING_NOTE } from "../data";
import { ScanTab } from "./ScanTab";

export const dynamic = "force-dynamic";

export default async function LocalSeoScanPage() {
  const { settings, scans, storageMissing } = await loadLocalSeoData();
  if (storageMissing) return <p className="m-4 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950 sm:m-6">{STORAGE_MISSING_NOTE}</p>;
  return <ScanTab initialSettings={settings} initialScans={scans} />;
}
