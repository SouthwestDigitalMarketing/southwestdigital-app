import { redirect } from "next/navigation";
import { requireStaffBrand } from "@/lib/brands/staff";
import { sendPageLink } from "@/lib/phone-intake/ticket";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ folder?: string | string[] }> };

const FOLDER = /^[a-z0-9][a-z0-9_-]{0,80}$/;

/** Every client with PDFs, or one client's PDFs when ?folder= names its ripley folder (repeat to try several). */
function agreementsLink(folders: string[]) {
  const [first, ...rest] = folders;
  return sendPageLink({
    secret: process.env.PHONE_INTAKE_SECRET ?? "",
    publicUrl: process.env.PHONE_INTAKE_PUBLIC_URL ?? "",
    nowSeconds: Math.floor(Date.now() / 1000),
    path: first ? `/agreements/${first}` : "/agreements",
    extra: rest.length ? { alt: rest } : undefined,
  });
}

/**
 * Agreement PDFs live in each client's folder on ripley and never leave it. This
 * page checks the staff login, then signs a link to ripley's tailnet Agreements
 * page (same road as Reports) and goes straight there.
 */
export default async function AgreementPdfsPage({ searchParams }: PageProps) {
  await requireStaffBrand();
  const { folder } = await searchParams;
  const folders = (Array.isArray(folder) ? folder : folder ? [folder] : []).filter((f) => FOLDER.test(f)).slice(0, 3);
  const link = agreementsLink(folders);
  if (link.ok) redirect(link.url);

  return (
    <div className="p-4 sm:p-8">
      <h1 className="text-2xl font-semibold text-slate-900">Agreement PDFs</h1>
      <p className="mt-2 text-base text-rose-700">{link.error}</p>
    </div>
  );
}
