import "server-only";

import { prisma } from "@/lib/prisma";

export type MrrGoals = {
  available: boolean;
  preview: boolean;
  monthlyMrrGoal: number | null;
  leadMrrGoal: number | null;
};

function developmentGoals(brandId: string): MrrGoals | null {
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.DEV_DASHBOARD_GOALS_BRAND_ID !== brandId
  ) return null;

  const monthlyMrrGoal = Number(process.env.DEV_DASHBOARD_MRR_GOAL);
  const leadMrrGoal = Number(process.env.DEV_DASHBOARD_LEAD_MRR_GOAL);
  if (
    !Number.isSafeInteger(monthlyMrrGoal) || monthlyMrrGoal <= 0 ||
    !Number.isSafeInteger(leadMrrGoal) || leadMrrGoal <= 0
  ) return null;

  return { available: false, preview: true, monthlyMrrGoal, leadMrrGoal };
}

export async function getMrrGoals(brandId: string): Promise<MrrGoals> {
  try {
    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'BrandTheme'
        AND column_name IN ('monthlyMrrGoal', 'leadMrrGoal')
    `;
    const available = new Set(columns.map(({ column_name }) => column_name));
    if (!available.has("monthlyMrrGoal") || !available.has("leadMrrGoal")) {
      return developmentGoals(brandId) ?? {
        available: false,
        preview: false,
        monthlyMrrGoal: null,
        leadMrrGoal: null,
      };
    }

    const rows = await prisma.$queryRaw<Array<{ monthlyMrrGoal: number | null; leadMrrGoal: number | null }>>`
      SELECT "monthlyMrrGoal", "leadMrrGoal"
      FROM public."BrandTheme"
      WHERE "brandId" = ${brandId}
      LIMIT 1
    `;
    return {
      available: true,
      preview: false,
      monthlyMrrGoal: rows[0]?.monthlyMrrGoal ?? null,
      leadMrrGoal: rows[0]?.leadMrrGoal ?? null,
    };
  } catch {
    return developmentGoals(brandId) ?? {
      available: false,
      preview: false,
      monthlyMrrGoal: null,
      leadMrrGoal: null,
    };
  }
}
