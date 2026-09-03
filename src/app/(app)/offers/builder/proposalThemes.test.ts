import { describe, expect, it } from "vitest";
import { contrastRatio, readableForegroundColor } from "@/lib/brands/colors";
import { primaryActionCssVariables } from "@/lib/brands/themeTokens";
import {
  PROPOSAL_THEMES,
  getProposalAccentHeaderBackground,
  getProposalDarkSurfaceColors,
  getProposalInkColor,
  getProposalSectionHeaderBackground,
  getProposalSurfaceTextColor,
  getProposalUrgencySurfaceColors,
  type ProposalMode,
} from "./proposalThemes";

const DEFAULT_BRAND_LIGHT = "#17324d";
const DEFAULT_BRAND_DARK = "#17324d";
const DEFAULT_BRAND_ACCENT = "#d79b3b";
const MINIMUM_TEXT_CONTRAST = 4.5;

function expectReadable(foreground: string, background: string, label: string) {
  expect(contrastRatio(foreground, background), label).toBeGreaterThanOrEqual(
    MINIMUM_TEXT_CONTRAST,
  );
}

describe("proposal theme header contrast", () => {
  for (const theme of PROPOSAL_THEMES) {
    for (const mode of ["light", "dark"] satisfies ProposalMode[]) {
      it(`${theme.label} ${mode} keeps service-step headers readable`, () => {
        const lightColor = mode === "dark" && theme.darkLight
          ? theme.darkLight
          : theme.light ?? DEFAULT_BRAND_LIGHT;
        const accentColor = mode === "dark" && theme.darkAccent
          ? theme.darkAccent
          : theme.accent ?? DEFAULT_BRAND_ACCENT;
        const brandDark = theme.light === null ? DEFAULT_BRAND_DARK : lightColor;
        const ink = getProposalInkColor(mode, brandDark, theme.id);
        const cardSurface = mode === "dark"
          ? getProposalDarkSurfaceColors(theme.id, brandDark).surface
          : "#ffffff";
        const semanticHeaderColor = mode === "dark" ? "#d5d6da" : "#475569";
        const sectionHeader = getProposalSectionHeaderBackground(mode, brandDark);
        const accentHeader = getProposalAccentHeaderBackground(mode, accentColor);
        const urgencySurface = getProposalUrgencySurfaceColors(accentColor, ink);
        const lightSurfaceInk = getProposalSurfaceTextColor("#ffffff", brandDark);
        const action = primaryActionCssVariables(accentColor);

        expectReadable(ink, cardSurface, `${theme.id} package heading`);
        expectReadable(
          semanticHeaderColor,
          cardSurface,
          `${theme.id} supporting service heading`,
        );
        expectReadable(ink, sectionHeader, `${theme.id} one-time-services heading`);
        expectReadable(ink, accentHeader, `${theme.id} additional-options heading`);
        expectReadable(
          readableForegroundColor(brandDark),
          brandDark,
          `${theme.id} recurring-services heading`,
        );
        expectReadable(
          urgencySurface.ink,
          urgencySurface.background,
          `${theme.id} urgency banner heading`,
        );
        expectReadable(lightSurfaceInk, "#ffffff", `${theme.id} light document heading`);
        expectReadable(
          action["--action-primary-foreground"],
          action["--action-primary-background"],
          `${theme.id} primary action`,
        );
      });
    }
  }

  for (const brandColor of ["#ffffff", "#facc15", "#94a3b8"]) {
    it(`normalizes light custom brand color ${brandColor} for both surface modes`, () => {
      const lightInk = getProposalInkColor("light", brandColor);
      const darkInk = getProposalInkColor("dark", brandColor);
      const darkSurface = getProposalDarkSurfaceColors("brand", brandColor).surface;

      expectReadable(lightInk, "#ffffff", `${brandColor} on a light proposal`);
      expectReadable(darkInk, darkSurface, `${brandColor} on a dark proposal`);
    });
  }
});
