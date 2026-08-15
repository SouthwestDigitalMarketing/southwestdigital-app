import { signOutOfPortal } from "@/app/portal/actions";
import { BrandShell } from "@/components/brand-shell";

export default function AccessDeniedPage() {
  return (
    <BrandShell brand={null}>
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Access denied</h1>
        <p className="mt-3 leading-6 text-slate-600">
          This account cannot use the Southwest operator portal. Sign out, then use a brand portal
          connected to your account.
        </p>
        <form action={signOutOfPortal} className="mt-6">
          <button
            type="submit"
            className="cursor-pointer rounded-full bg-slate-950 px-5 py-3 font-semibold text-white"
          >
            Sign out
          </button>
        </form>
      </section>
    </BrandShell>
  );
}
