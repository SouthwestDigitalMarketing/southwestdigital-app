export function safeOfferOptionsReturnPath(value: string | string[] | undefined) {
  const path = Array.isArray(value) ? value[0] : value;
  if (!path) return null;
  return path === "/offers/add-ons" || path.startsWith("/offers/add-ons?")
    ? path
    : null;
}
