# UI theme and action system

Buttons and action links use semantic roles. A component chooses the role; the
active theme owns the background/foreground pairing.

## Primary-action tokens

- `--action-primary-background`
- `--action-primary-foreground`

`AppShell` supplies these variables for authenticated app pages through
`appPrimaryActionCssVariables()` in `src/lib/brands/themeTokens.ts`:

- Light mode uses the brand's dark accent with white text as a guaranteed pair.
- Dark mode uses the brand's regular accent.
- Dark-mode and proposal foreground colors are selected centrally from the background's contrast.

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
the proposal theme selected in the offer builder. This applies equally to the
embedded preview and the published client proposal.

## Action variants

Use the shared classes in `src/app/globals.css`:

- `ui-action-primary` for the page's main action.
- `ui-action-secondary` for neutral supporting actions.
- `ui-action-danger` for destructive actions.
- `ui-action-ghost` for low-emphasis icon or text actions.

Add only layout, sizing, typography, and disabled-state utilities alongside a
semantic action class. Do not add local background or foreground color utilities
to the same control.

Selected filters, checkboxes, tags, tooltips, and status badges are not primary
actions; they consume their own documented semantic roles instead. Provider-owned
controls such as PayPal buttons retain the provider's required treatment.
