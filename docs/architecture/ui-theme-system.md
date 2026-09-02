# UI theme and action system

Buttons and action links use semantic roles. A component chooses the role; the
active theme owns the background/foreground pairing.

## Primary-action tokens

- `--action-primary-background`
- `--action-primary-foreground`
- `--action-primary-border`

`AppShell` supplies these variables for authenticated app pages through
`appPrimaryActionCssVariables()` in `src/lib/brands/themeTokens.ts`. On light
surfaces, Primary uses the active theme's exact Dark color. In dark mode, it uses
a 35% lift of Dark toward white so the action remains visibly distinct from its
card while retaining the theme hue. The active sidebar item consumes the same
mode-aware token. Secondary actions are quieter blends of Primary and the
current surface.

The app canvas retains a subtle bottom-right-to-top-left gradient in both modes.
In dark mode, the gradient is anchored to a near-black tone made from 55% of the
active theme's Dark color and 45% black rather than a fixed neutral canvas.
The dark-mode sidebar keeps that canvas tone as a solid background. The main
panel blends 18% of a neutral near-black into the same base before applying its
subtle gradient, reducing saturation without materially changing its depth and
creating a quiet separation from the sidebar.

Dark-mode cards and their nested surfaces also derive from that Dark color. The
base card surface retains 72% of Dark and blends the remainder with a neutral
near-black, making it slightly darker and less saturated while keeping it above
the deeper page canvas. Rows, controls, borders, and alternating sections derive
from that neutralized card base and use progressively lifted tones for depth.

Brand Color settings preview the intended foreground on every swatch and show
its WCAG ordinary-text rating: AAA at 7:1 or greater, AA at 4.5:1 or greater,
and Fails below 4.5:1. Hovering or focusing the rating explains the tested
foreground/background pairing and its exact ratio.

Overlay components use centralized semantic roles: `--surface-overlay`,
`--text-on-overlay`, and `--border-on-overlay`. The app derives these from the
selected brand's Dark color. Dark mode uses a slightly lifted brand tone so an
overlay remains distinct from the dark canvas. If either tone would miss AAA
with white text, the resolver darkens that same brand tone only as much as
needed; it does not substitute an unrelated neutral color.

The AAA, AA, and Fails badge pairs each exceed 7:1. Status colors communicate
meaning, while brand colors provide identity and mode-aware neutral surface
tokens provide structure. Components select a semantic role and never choose
their own foreground/background pair.

`OfferProposalPreview` overrides the same variables at the proposal root using
the proposal theme selected in the offer builder. Accent-backed proposal actions
continue to use the configured Accent Text choice. This applies equally to the
embedded preview and the published client proposal.

## Action variants

Use the shared classes in `src/app/globals.css`:

- `ui-action-primary` for the page's main action.
- `ui-action-secondary` for lower-intensity supporting actions derived from Primary.
- `ui-action-danger` for destructive actions.
- `ui-action-ghost` for low-emphasis, transparent icon or text actions with a
  theme-aware outline.

Add only layout, sizing, typography, and disabled-state utilities alongside a
semantic action class. Do not add local background or foreground color utilities
to the same control.

Selected filters, checkboxes, tags, tooltips, and status badges are not primary
actions; they consume their own documented semantic roles instead. Provider-owned
controls such as PayPal buttons retain the provider's required treatment.

The selected sidebar item uses `ui-nav-active`. It shares Primary's mode-aware,
Dark-derived background and readable foreground but has no persistent border.
It remains a navigation state rather than masquerading as a button.

## Chart palette

Charts use related series tokens generated from the active theme. In both modes,
the ramp runs from the exact Dark color at the bottom toward the exact Accent
color at the top, with direct interpolations between them. The offer funnel uses
an 11-tone ramp; intermediate tones are adjusted against the current chart-card
surface when needed for separation, while the two brand endpoints remain exact.
`--chart-other` and `--chart-muted` provide quieter comparison tones from the
same system.

Use only as many series tones as the data structure needs. Every offer-funnel
stage receives its own tone; YouTube series and goal pace use the five broader
series tones. Comparison data remains neutral. Reserve semantic status colors
for values where positive, caution, or negative meaning is actually part of the
data rather than using them as decorative chart categories.
