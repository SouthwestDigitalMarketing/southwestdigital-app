import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { resolveBrand } from "@/lib/brands/resolve";
import { BrandProvider } from "@/lib/brands/context";
import { AppShell } from "./AppShell";
import { MembershipStatus } from "@prisma/client";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const headersList = await headers();
  const hostname = headersList.get("x-hostname");

  const resolved = await resolveBrand(hostname, session.user.id);

  if (!resolved?.brand) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        No brand found for this domain.
      </div>
    );
  }

  const { brand, membership } = resolved;

  if (!membership || membership.status !== MembershipStatus.ACTIVE) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        You don&apos;t have access to {brand.name}.
      </div>
    );
  }

  return (
    <BrandProvider value={{ brand, membership }}>
      <AppShell user={{ name: session.user.name, email: session.user.email }}>
        {children}
      </AppShell>
    </BrandProvider>
  );
}
