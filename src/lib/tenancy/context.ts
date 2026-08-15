import "server-only";

const authorizedBrandContext = Symbol("authorized-brand-context");

export type BrandDataContext = Readonly<{
  brandId: string;
  actorUserId: string;
  [authorizedBrandContext]: true;
}>;

/** Call only after current session and brand access have been verified. */
export function createBrandDataContext(input: {
  brandId: string;
  actorUserId: string;
}): BrandDataContext {
  if (!input.brandId || !input.actorUserId) {
    throw new Error("Authorized brand context requires both brand and actor identifiers");
  }
  return Object.freeze({ ...input, [authorizedBrandContext]: true as const });
}

