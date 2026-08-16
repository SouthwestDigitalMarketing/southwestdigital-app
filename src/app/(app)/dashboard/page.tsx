import { auth } from "@/auth";

export default async function DashboardPage() {
  const session = await auth();
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
      <p className="mt-2 text-slate-600">
        Welcome, {session?.user?.name ?? session?.user?.email}
      </p>
    </main>
  );
}
