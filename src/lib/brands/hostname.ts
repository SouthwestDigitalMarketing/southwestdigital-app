const HOSTNAME_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Produces the canonical key stored in BrandDomain.hostname.
 *
 * This function normalizes a hostname; it does not decide whether a forwarding
 * header is trusted. That decision belongs at the deployment/request boundary.
 */
export function normalizeHostname(value: string | null | undefined): string | null {
  const candidate = value?.trim().toLowerCase();
  if (!candidate || candidate.includes(",") || candidate.includes("/") || candidate.includes("@")) {
    return null;
  }

  try {
    const hostname = new URL(`http://${candidate}`).hostname.replace(/\.$/, "");
    if (!hostname || hostname.length > 253 || !HOSTNAME_PATTERN.test(hostname)) {
      return null;
    }
    return hostname;
  } catch {
    return null;
  }
}

