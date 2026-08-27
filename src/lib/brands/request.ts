import { normalizeHostname } from "./hostname";

function hostnameFromDevelopmentOverride(value: string | null | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
    try {
      return normalizeHostname(new URL(candidate).hostname);
    } catch {
      return null;
    }
  }

  return normalizeHostname(candidate);
}

export function effectiveRequestHostname(input: {
  requestHostname: string | null | undefined;
  developmentOverride?: string | null;
  nodeEnv?: string;
}): string | null {
  if (input.nodeEnv === "development") {
    const override = hostnameFromDevelopmentOverride(input.developmentOverride);
    if (override) return override;
  }
  return normalizeHostname(input.requestHostname);
}

export function safeRequestOrigin(input: {
  hostHeader: string | null | undefined;
  forwardedProto: string | null | undefined;
  fallbackOrigin: string;
  nodeEnv?: string;
  developmentOverride?: string | null;
}): string {
  if (input.nodeEnv === "development" && input.developmentOverride) return input.fallbackOrigin;

  const hostname = normalizeHostname(input.hostHeader);
  if (!hostname) return input.fallbackOrigin;

  try {
    const parsedHost = new URL(`http://${input.hostHeader?.trim()}`);
    const forwardedProto = input.forwardedProto?.split(",", 1)[0]?.trim().toLowerCase();
    const protocol = forwardedProto === "http" || forwardedProto === "https"
      ? forwardedProto
      : new URL(input.fallbackOrigin).protocol.replace(":", "");
    const port = parsedHost.port ? `:${parsedHost.port}` : "";
    return `${protocol}://${hostname}${port}`;
  } catch {
    return input.fallbackOrigin;
  }
}
