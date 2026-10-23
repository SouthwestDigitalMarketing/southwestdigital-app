import "server-only";

import { ContactTagKind } from "@prisma/client";
import { applyTagPipelineAutomation } from "@/lib/contacts/automation";
import { PipeBrandError, resolveBrand } from "@/lib/pipe/contacts";
import { createBrandDataContext, withBrandDataTransaction } from "@/lib/tenancy/context";

/**
 * Contact tags written by the `pipe` terminal tool (LochsideLLC/sales).
 *
 * Tags sit on the contact, not on a deal. Adding a tag runs the same
 * tag-to-pipeline automation the SWapp screens run, so automations live in
 * one place. Removing a tag only removes the link; it undoes nothing.
 */

export type PipeTagInput = {
  brand: string;
  /** datastore contact id. */
  contactId: string;
  /** tag key, e.g. "reviews". Lowercased, [a-z0-9-]. */
  tag: string;
  action: "add" | "remove";
  /** used only when the tag does not exist yet. */
  label?: string | null;
  kind?: ContactTagKind | null;
};

export type PipeTagResult = {
  contactId: string;
  tag: string;
  action: "add" | "remove";
  /** false when the tag was already there (add) or not there (remove). */
  changed: boolean;
  /** true when the tag had to be created for this brand. */
  tagCreated: boolean;
};

export class PipeTagNotFoundError extends Error {}

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

export function parsePipeTagInput(body: unknown): PipeTagInput {
  const raw = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const brand = clean(raw.brand, 80);
  const contactId = clean(raw.contactId ?? raw.contact_id ?? raw.id, 64);
  const tag = clean(raw.tag ?? raw.key, 64)?.toLowerCase() ?? null;
  const action = raw.action;
  if (!brand) throw new RangeError("brand is required");
  if (!contactId) throw new RangeError("contactId is required");
  if (!tag || !/^[a-z0-9][a-z0-9-]*$/.test(tag)) throw new RangeError("tag must be letters, digits and dashes");
  if (action !== "add" && action !== "remove") throw new RangeError("action must be add or remove");
  const kindRaw = clean(raw.kind, 32)?.toUpperCase() ?? null;
  if (kindRaw && !(kindRaw in ContactTagKind)) throw new RangeError("kind is not valid");
  return {
    brand,
    contactId,
    tag,
    action,
    label: clean(raw.label, 80),
    kind: kindRaw ? (kindRaw as ContactTagKind) : null,
  };
}

export async function applyPipeTag(args: { actorUserId: string; input: PipeTagInput }): Promise<PipeTagResult> {
  const { input } = args;
  const brand = await resolveBrand(input.brand);
  const context = createBrandDataContext({ brandId: brand.id, actorUserId: args.actorUserId });

  const outcome = await withBrandDataTransaction(context, async (transaction) => {
    const contact = await transaction.contact.findFirst({
      where: { id: input.contactId, brandId: brand.id },
      select: { id: true },
    });
    if (!contact) throw new PipeTagNotFoundError(`unknown contact ${input.contactId}`);

    let tag = await transaction.contactTag.findUnique({
      where: { brandId_key: { brandId: brand.id, key: input.tag } },
      select: { id: true, isActive: true },
    });

    if (input.action === "remove") {
      if (!tag) return { tagId: null, changed: false, tagCreated: false };
      const removed = await transaction.contactTagLink.deleteMany({
        where: { contactId: contact.id, tagId: tag.id },
      });
      return { tagId: tag.id, changed: removed.count > 0, tagCreated: false };
    }

    let tagCreated = false;
    if (!tag) {
      tag = await transaction.contactTag.create({
        data: {
          brandId: brand.id,
          key: input.tag,
          label: input.label ?? input.tag,
          kind: input.kind ?? ContactTagKind.CUSTOM,
        },
        select: { id: true, isActive: true },
      });
      tagCreated = true;
    } else if (!tag.isActive) {
      tag = await transaction.contactTag.update({
        where: { id: tag.id },
        data: { isActive: true },
        select: { id: true, isActive: true },
      });
    }

    const existing = await transaction.contactTagLink.findUnique({
      where: { contactId_tagId: { contactId: contact.id, tagId: tag.id } },
      select: { id: true },
    });
    if (!existing) {
      await transaction.contactTagLink.create({ data: { contactId: contact.id, tagId: tag.id } });
    }
    return { tagId: tag.id, changed: !existing, tagCreated };
  });

  // The automation is idempotent, so it also runs when the tag was already
  // there: a retry after a failed first run still lands the pipeline item.
  if (input.action === "add" && outcome.tagId) {
    await applyTagPipelineAutomation({
      brandId: brand.id,
      actorUserId: args.actorUserId,
      contactId: input.contactId,
      tagId: outcome.tagId,
    });
  }

  return {
    contactId: input.contactId,
    tag: input.tag,
    action: input.action,
    changed: outcome.changed,
    tagCreated: outcome.tagCreated,
  };
}

export async function listPipeContactTags(args: {
  actorUserId: string;
  brand: string;
  contactId: string;
}): Promise<string[]> {
  const brand = await resolveBrand(args.brand);
  const context = createBrandDataContext({ brandId: brand.id, actorUserId: args.actorUserId });
  return withBrandDataTransaction(context, async (transaction) => {
    const links = await transaction.contactTagLink.findMany({
      where: { contactId: args.contactId, contact: { brandId: brand.id }, tag: { isActive: true } },
      select: { tag: { select: { key: true } } },
      orderBy: { createdAt: "asc" },
    });
    return links.map((link) => link.tag.key);
  });
}

export { PipeBrandError };
