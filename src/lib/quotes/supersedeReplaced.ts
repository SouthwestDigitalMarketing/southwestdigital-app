import "server-only";

import { prisma } from "@/lib/prisma";
import {
  replacesQuoteIdFromSnapshot,
  supersedeReplacedQuote,
} from "./proposalValidity";

/**
 * After a replacement draft is published or sent, expire the quote it
 * replaces (snapshot `replacesQuoteId`). Silent: no email is sent by this
 * action. Frozen (accepted/signed/paid) old quotes are left alone.
 */
export async function supersedeReplacedQuoteOnWrite(
  brandId: string,
  snapshot: unknown,
  newQuoteId: string,
) {
  const oldQuoteId = replacesQuoteIdFromSnapshot(snapshot);
  if (!oldQuoteId || oldQuoteId === newQuoteId) return;
  await prisma.$transaction((tx) =>
    supersedeReplacedQuote(tx, brandId, { oldQuoteId, newQuoteId }),
  );
}
