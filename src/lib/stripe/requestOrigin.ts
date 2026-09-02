import { safeRequestOrigin } from "@/lib/brands/request";

const LOCAL_FALLBACK_ORIGIN = "http://localhost:3000";

export function requestOrigin(headersList: Headers): string {
  const forwardedProto = headersList.get("x-forwarded-proto");
  const hostOrigin = safeRequestOrigin({
    hostHeader: headersList.get("host"),
    forwardedProto,
    fallbackOrigin: LOCAL_FALLBACK_ORIGIN,
  });

  return safeRequestOrigin({
    hostHeader:
      headersList.get("x-forwarded-host") ??
      headersList.get("host") ??
      headersList.get("x-hostname"),
    forwardedProto,
    fallbackOrigin: hostOrigin,
  });
}
