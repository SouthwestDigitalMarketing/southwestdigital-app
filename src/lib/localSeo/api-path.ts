const DATAFORSEO_API_ORIGIN = "https://api.dataforseo.com";
const MAPS_API_PREFIX = "/v3/serp/google/maps";

export function dataForSeoApiUrl(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const versionedPath = normalized.startsWith("/v3/")
    ? normalized
    : `${MAPS_API_PREFIX}${normalized}`;
  return `${DATAFORSEO_API_ORIGIN}${versionedPath}`;
}
