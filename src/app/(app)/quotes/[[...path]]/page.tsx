import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function QuotesToOffersRedirect({ params, searchParams }: PageProps) {
  const { path } = await params;
  const query = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const item of value) qs.append(key, item);
    } else if (typeof value === "string") {
      qs.set(key, value);
    }
  }
  const suffix = path?.length ? `/${path.join("/")}` : "";
  const encoded = qs.toString();
  redirect(`/offers${suffix}${encoded ? `?${encoded}` : ""}`);
}
