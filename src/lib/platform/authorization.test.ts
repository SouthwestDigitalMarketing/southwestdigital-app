import { PlatformRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { isPlatformAdministrator } from "./access";

describe("platform authorization", () => {
  it("allows only platform administrators and owners", () => {
    expect(isPlatformAdministrator(PlatformRole.ADMIN)).toBe(true);
    expect(isPlatformAdministrator(PlatformRole.OWNER)).toBe(true);
    expect(isPlatformAdministrator(PlatformRole.NONE)).toBe(false);
  });
});
