// Report pipeline seats with no supporting tag (read-only drift check).
//
// A seat (active PipelineItem) is supported when at least one contact linked
// to its lead still holds a tag with an ACTIVE ContactTagAutomation pointing
// at that same pipeline. Seats with no supporting tag are drift: the tag that
// seated them was removed or deactivated without the mirror unseat, the tag
// was deleted, or the seat was created by hand / pipe sync outside the
// tag automation.
//
// Reads only. Never writes. Exit 0 when clean, 1 when drift is found.
// Usage: node scripts/report-pipeline-drift.mjs [--brand <brand-slug>]
//   dotenv -e .env -- node scripts/report-pipeline-drift.mjs --brand bookkeeping-conroe
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config({ path: new URL("../.env", import.meta.url) });

/**
 * A seat's support: the pipeline ids that the lead's currently-held tags
 * actively map to. Pure: tested in report-pipeline-drift.test.mjs.
 */
export function findDriftSeats(seats) {
  return seats.filter((seat) => !seat.supportingPipelineIds.includes(seat.pipelineId));
}

export function formatSeat(seat) {
  const who = seat.contactNames.length > 0 ? seat.contactNames.join(", ") : "no linked contact";
  return (
    `${seat.brandId} | ${seat.pipelineKey}/${seat.stageKey} | ` +
    `lead ${seat.leadName} (${seat.leadId}) | via ${who}`
  );
}

async function main() {
  const brandFlag = process.argv.indexOf("--brand");
  const brandSlug = brandFlag === -1 ? null : process.argv[brandFlag + 1] ?? null;
  const prisma = new PrismaClient();
  try {
    let brandId = null;
    if (brandSlug) {
      const brand = await prisma.brand.findUnique({
        where: { slug: brandSlug },
        select: { id: true },
      });
      if (!brand) {
        console.error(`unknown brand slug: ${brandSlug}`);
        process.exitCode = 2;
        return;
      }
      brandId = brand.id;
    }

    const items = await prisma.pipelineItem.findMany({
      where: {
        isActive: true,
        ...(brandId ? { pipeline: { is: { brandId } } } : {}),
      },
      select: {
        id: true,
        pipelineId: true,
        leadId: true,
        pipeline: { select: { key: true, brandId: true } },
        stage: { select: { key: true } },
        lead: {
          select: {
            name: true,
            contacts: {
              select: {
                contact: {
                  select: {
                    name: true,
                    tagLinks: {
                      select: {
                        tag: {
                          select: {
                            isActive: true,
                            automations: {
                              where: { isActive: true },
                              select: { pipelineId: true },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const seats = items.map((item) => {
      const supporting = new Set();
      const contactNames = [];
      for (const link of item.lead.contacts) {
        contactNames.push(link.contact.name);
        for (const tagLink of link.contact.tagLinks) {
          if (!tagLink.tag.isActive) continue;
          for (const automation of tagLink.tag.automations) {
            supporting.add(automation.pipelineId);
          }
        }
      }
      return {
        id: item.id,
        pipelineId: item.pipelineId,
        pipelineKey: item.pipeline.key,
        stageKey: item.stage.key,
        brandId: item.pipeline.brandId,
        leadId: item.leadId,
        leadName: item.lead.name,
        contactNames,
        supportingPipelineIds: [...supporting],
      };
    });

    const drift = findDriftSeats(seats);
    console.log(`checked ${seats.length} active seat(s), drift: ${drift.length}`);
    for (const seat of drift) console.log(`DRIFT ${formatSeat(seat)}`);
    if (drift.length > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (!process.env.VITEST_WORKER_ID) await main();
