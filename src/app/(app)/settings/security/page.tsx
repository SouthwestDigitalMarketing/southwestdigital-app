import { requireAppBrand } from "@/lib/brands/staff";
import { prisma } from "@/lib/prisma";
import { relyingParty } from "@/lib/app-lock/server";
import { ChangePinForm, AddPasskeyButton } from "./SecurityForms";
import { removePasskey } from "./actions";

export const dynamic = "force-dynamic";

function fmt(date: Date | null) {
  return date
    ? date.toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" })
    : "never";
}

export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const { session, appLock } = await requireAppBrand();
  const { new: isNew } = await searchParams;
  const { rpId } = await relyingParty();
  const passkeys = await prisma.userPasskey.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });
  const onThisSite = passkeys.some((p) => p.rpId === rpId);

  return (
    <div className="w-full max-w-2xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Security</h1>
        <p className="mt-2 text-sm text-slate-500">
          SWapp asks for your PIN or Face ID / fingerprint before it opens, and again after 8 hours.
        </p>
      </div>

      {isNew ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          PIN saved. Add Face ID or fingerprint below so you rarely need to type it.
        </p>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">Face ID / fingerprint</h2>
        <p className="mt-1 text-sm text-slate-500">
          Set up once on each phone or computer, and again for each SWapp address you use ({rpId} here).
        </p>
        {passkeys.length > 0 ? (
          <ul className="mt-4 divide-y divide-slate-100 text-sm">
            {passkeys.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="font-medium text-slate-900">{p.name}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {p.rpId} · added {fmt(p.createdAt)} · last used {fmt(p.lastUsedAt)}
                  </span>
                </span>
                <form action={removePasskey}>
                  <input type="hidden" name="id" value={p.id} />
                  <button type="submit" className="text-xs font-semibold text-rose-700 hover:underline">
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-4">
          <AddPasskeyButton already={onThisSite} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">Change PIN</h2>
        <p className="mt-1 text-sm text-slate-500">
          Last changed {fmt(appLock.pinChangedAt)}. SWapp reminds you to change it on the 1st of each month.
        </p>
        <ChangePinForm />
      </section>
    </div>
  );
}
