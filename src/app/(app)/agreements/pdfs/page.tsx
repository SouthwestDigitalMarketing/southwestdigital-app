import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireStaffBrand } from "@/lib/brands/staff";
import { sendPageLink } from "@/lib/phone-intake/ticket";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ folder?: string | string[]; doc?: string; ret?: string }> };

/** GSA shortcuts on ripley: the newest unsigned draft, or the signed copy. */
const GSA_DOCS = new Set(["draft", "signed"]);

const FOLDER = /^[a-z0-9][a-z0-9_-]{0,80}$/;

/**
 * Every client with PDFs, or one client's PDFs when ?folder= names its ripley
 * folder (repeat to try several); add ?doc=draft|signed to open that GSA PDF.
 */
function agreementsLink(folders: string[], doc: string | null, ret: string | null) {
  const [first, ...rest] = folders;
  const extra: Record<string, string | string[]> = {};
  if (rest.length) extra.alt = rest;
  if (ret) extra.ret = ret;
  return sendPageLink({
    secret: process.env.PHONE_INTAKE_SECRET ?? "",
    publicUrl: process.env.PHONE_INTAKE_PUBLIC_URL ?? "",
    nowSeconds: Math.floor(Date.now() / 1000),
    path: first ? `/agreements/${first}${doc ? `/gsa/${doc}/view` : ""}` : "/agreements",
    extra,
  });
}

/** The SWapp page to come back to from ripley's viewer: a same-site path made absolute (https only). */
async function returnAddress(ret: string | undefined) {
  if (!ret || !ret.startsWith("/") || ret.startsWith("//")) return null;
  const host = (await headers()).get("host");
  return host ? `https://${host}${ret}` : null;
}

/**
 * Agreement PDFs live in each client's folder on ripley and never leave it. This
 * page checks the staff login, then signs a link to ripley's tailnet Agreements
 * page (same road as Reports) and goes straight there.
 */
export default async function AgreementPdfsPage({ searchParams }: PageProps) {
  await requireStaffBrand();
  const { folder, doc, ret } = await searchParams;
  const folders = (Array.isArray(folder) ? folder : folder ? [folder] : []).filter((f) => FOLDER.test(f)).slice(0, 3);
  const link = agreementsLink(folders, doc && GSA_DOCS.has(doc) ? doc : null, await returnAddress(ret));
  if (link.ok) redirect(link.url);

  return (
    <div className="p-4 sm:p-8">
      <h1 className="text-2xl font-semibold text-slate-900">Agreement PDFs</h1>
      <p className="mt-2 text-base text-rose-700">{link.error}</p>
    </div>
  );
}
