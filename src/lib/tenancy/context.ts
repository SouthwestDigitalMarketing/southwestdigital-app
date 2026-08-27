import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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

export async function withBrandDataTransaction<T>(
  context: BrandDataContext,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (context[authorizedBrandContext] !== true) {
    throw new Error("Brand data access requires an authorized context");
  }

  return prisma.$transaction(
    async (transaction) => {
      const [settings] = await transaction.$queryRaw<
        Array<{ brand_context: string; actor_context: string }>
      >`
        SELECT
          set_config('app.current_brand_id', ${context.brandId}, true) AS brand_context,
          set_config('app.current_actor_user_id', ${context.actorUserId}, true) AS actor_context,
          set_config('statement_timeout', '30000', true) AS statement_timeout,
          set_config('idle_in_transaction_session_timeout', '30000', true) AS idle_timeout
      `;
      if (
        settings?.brand_context !== context.brandId ||
        settings.actor_context !== context.actorUserId
      ) {
        throw new Error("Database brand context did not match the authorized request context");
      }
      return operation(transaction);
    },
    { maxWait: 5_000, timeout: 30_000 },
  );
}
