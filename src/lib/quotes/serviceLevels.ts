// What each support level means, in plain words. Keyed by the catalog's support service name;
// a name not listed here falls back to the service's own name and description.
export const SERVICE_LEVEL_COPY: Record<string, { title: string; meaning: string }> = {
  "Standard Client Support": { title: "Steady Support", meaning: "Ask us anything about your books. We reply within 1–2 business days." },
  "Priority Client Support": { title: "Fast-Lane Support", meaning: "Skip the wait. We reply to your questions and requests the same business day." },
  "Concierge Client Support": { title: "White-Glove Concierge", meaning: "We're on call for you, 24/7, for bookkeeping questions and anything time-sensitive." },
};

// The name a client sees. Used everywhere the support level is listed (service level box,
// included list, agreement) so one level never appears under two names.
export function serviceLevelTitle(serviceName: string) {
  return SERVICE_LEVEL_COPY[serviceName]?.title ?? serviceName;
}
