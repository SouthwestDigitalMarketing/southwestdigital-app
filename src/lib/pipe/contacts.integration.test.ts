import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Runs the pipe contacts functions against a real PostgreSQL database as the
 * restricted runtime role, with the CRM row-level security migration applied.
 * Skipped unless PIPE_TEST_DATABASE_URL is set; DATABASE_URL must point at the
 * same database as the swd_web_runtime role, e.g.
 *   PIPE_TEST_DATABASE_URL=1 DATABASE_URL=postgresql://swd_web_runtime:...@127.0.0.1:54329/swapp_test npx vitest run contacts.integration
 * It needs two brands, slugs `brand-one` and `brand-two`, and no contacts named below.
 */
const enabled = Boolean(process.env.PIPE_TEST_DATABASE_URL);

describe.skipIf(!enabled)("pipe contacts against a real database", () => {
  let lib: typeof import("./contacts");
  let prisma: typeof import("@/lib/prisma").prisma;
  const names = ["Integ Dana", "Integ Marcus"];

  beforeAll(async () => {
    lib = await import("./contacts");
    prisma = (await import("@/lib/prisma")).prisma;
  });
  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("creates once, then returns the same contact for the same phone or email", async () => {
    const input = { brand: "brand-one", name: names[0], email: "integ.dana@example.com", phone: "(936) 555-0142" };
    const first = await lib.upsertPipeContact({ actorUserId: "user-1", input });
    expect(first.created).toBe(true);
    expect(first.contact.phoneE164).toBe("+19365550142");
    const again = await lib.upsertPipeContact({ actorUserId: "user-1", input: { ...input, name: "Other Name", phone: "936.555.0142" } });
    expect(again.created).toBe(false);
    expect(again.contact.id).toBe(first.contact.id);
    const byEmail = await lib.upsertPipeContact({ actorUserId: "user-1", input: { brand: "brand-one", name: "x", email: "INTEG.DANA@example.com" } });
    expect(byEmail.contact.id).toBe(first.contact.id);
  });

  it("keeps the same person under two brands as two contacts", async () => {
    const a = await lib.upsertPipeContact({ actorUserId: "u", input: { brand: "brand-one", name: names[1], email: "integ.marcus@example.com" } });
    const b = await lib.upsertPipeContact({ actorUserId: "u", input: { brand: "brand-two", name: names[1], email: "integ.marcus@example.com" } });
    expect(b.created).toBe(true);
    expect(b.contact.id).not.toBe(a.contact.id);
  });

  it("lists only the brand's own contacts and searches them", async () => {
    const one = await lib.listPipeContacts({ actorUserId: "u", brand: "brand-one", query: "integ" });
    const two = await lib.listPipeContacts({ actorUserId: "u", brand: "brand-two", query: "integ" });
    expect(one.map((c) => c.name)).toContain(names[0]);
    expect(two.map((c) => c.name)).not.toContain(names[0]);
    expect(two.map((c) => c.name)).toContain(names[1]);
    const byDigits = await lib.listPipeContacts({ actorUserId: "u", brand: "brand-one", query: "555-0142" });
    expect(byDigits.map((c) => c.name)).toContain(names[0]);
  });

  it("is refused by row-level security if the brand context is missing", async () => {
    const rows = await prisma.contact.findMany({ where: { name: { startsWith: "Integ" } } });
    expect(rows).toEqual([]); // no transaction-local brand context: RLS hides everything
  });

  it("rejects an unknown brand", async () => {
    await expect(lib.listPipeContacts({ actorUserId: "u", brand: "nope" })).rejects.toBeInstanceOf(lib.PipeBrandError);
  });
});
