import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BrandShell } from "@/components/brand-shell";
import { prisma } from "@/lib/prisma";
import { resolveAppBrandByHostname } from "@/lib/brands/repository";
import { currentRequestHostname } from "@/lib/tenancy/request-host";
import { getAppLockState, pinResetAllowed, relyingParty } from "@/lib/app-lock/server";
import { UnlockForm } from "./UnlockForm";

export const dynamic = "force-dynamic";

export default async function UnlockPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { next = "/dashboard" } = await searchParams;
  const lock = await getAppLockState(session.user.id);
  if (lock.unlocked) redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");

  const resetting = lock.hasPin && (await pinResetAllowed(session.user.id, session.user.signedInAt ?? 0));
  const mode = lock.hasPin && !resetting ? "unlock" : "create";
  const brand = await resolveAppBrandByHostname(await currentRequestHostname());
  const { rpId } = await relyingParty();
  const passkeys = mode === "unlock"
    ? await prisma.userPasskey.count({ where: { userId: session.user.id, rpId } })
    : 0;

  return (
    <BrandShell brand={brand}>
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight">
          {mode === "unlock" ? "Unlock" : resetting ? "Choose a new PIN" : "Create your PIN"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {resetting
            ? "You signed in again, so you can set a new 6-digit PIN."
            : mode === "unlock"
            ? `Signed in as ${session.user.email}. Enter your 6-digit PIN${passkeys > 0 ? " or use Face ID / fingerprint" : ""}.`
            : "SWapp now asks for a 6-digit PIN before it opens. Choose one you will remember; you can add Face ID or fingerprint next."}
        </p>
        <UnlockForm mode={mode} next={next} passkeys={passkeys > 0} />
      </section>
    </BrandShell>
  );
}
