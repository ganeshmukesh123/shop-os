---
name: shopos-radix-design-system
description: "Use when building or restyling any Shop OS screen, dialog or component with Radix UI. Applies the design guidelines: Radix Themes tokens and props, colour roles, light and dark mode, shared message and status components, keyboard-first counter rules, and the new-screen checklist."
---

# Radix design system in Shop OS

Source of truth: `docs/design/design-guidelines.md` (constitution X). This skill is the short working version. Visual sample: https://claude.ai/artifact/BVHiC7yxTdokTbZDbG6B2T

**Current state (2026-11-15)**: the shared `StatusMessage`, `StatusBadge` (`renderer/shared/components/`) and the theme module (`renderer/shared/theme/`: `ThemeProvider`, `ThemePicker`, `useThemePreference`) exist (spec 001 T085, T086). Use them; never hand-build an alert or a badge. There is no inline `style` in the renderer: use Radix props, sizes from `renderer/shared/constants/layout.ts`, or a token-only class in `renderer/app/app.css` (`tests/unit/rendererStyleRules.test.ts` fails on an inline style, a hex colour or a pixel font size).

## Rules

1. **Radix Themes first.** Use Radix components and props (`size`, `color`, `variant`, `radius`, `highContrast`). Use Radix primitives only where a custom behaviour is needed. Do not write CSS for what a prop already does.
2. **Tokens, not values.** Colours and spacing come from Radix tokens (`--gray-12`, `--red-11`, `--space-3`). No hex, `rgb()`, named colours or pixel font sizes. No inline `style={{ }}` except a run-time value no token expresses, in a named style object with a comment.
3. **Colour roles**: Primary (accent indigo), Danger (`red`), Warning (`orange`; open: `amber`), Success (`green`), Neutral (slate). Every status shows a word as well as colour (Blocked, Pending, Saved).
4. **Light and dark are both required.** The user chooses System (default), Light or Dark. `Theme appearance` takes `light` or `dark` only, so the shared theme module resolves System with `matchMedia("(prefers-color-scheme: dark)")` and applies the result before first paint. Never assume a white or dark background; never hard-code a colour that works in one mode only. Printed bills and PDFs are always black on white.
5. **Density.** Counter on desktop is dense (`size="2"`); tablet and phone use larger controls and 44 px targets. Open: desktop scaling 110% or 100%.
6. **One pattern for messages**: label, plain sentence, one action. Use the shared `StatusMessage` and `StatusBadge`; do not hand-build alerts.
7. **Standard states**: loading (skeleton after 300 ms), empty (what goes here plus the first action), error (what happened plus what to do), success (result plus next step).
8. **Keyboard first.** One shortcut table (`/` search, `Enter` add, `Ctrl or Cmd N/S/P`, `Esc`), visible focus ring, sensible tab order.
9. **Formats** from shared formatters only: `₹1,00,000.00`, `2.5 metre`, `07/12/2026 14:05`.
10. **Text** from `uiText`; plain wording; buttons say what happens ("Cancel bill").

## Component map

| Job | Component |
|---|---|
| Main action | `Button` solid accent (one per area) |
| Secondary | `Button` soft or outline gray |
| Destructive | `Button color="red"`, asks for a reason where data is affected |
| Text or number input | `TextField` with a label above and error text below |
| Few choices | `SegmentedControl` or `RadioGroup` |
| Many choices | `Select` |
| Dialog | `Dialog` (title, one sentence, actions bottom right, Esc closes) |
| Notice | `Callout` or shared `StatusMessage` |
| Toast | Radix `Toast` through the shared helper; never the only record of an error |
| Table | `Table` (compact on the counter) |
| Status | `Badge` with a word |

## Verify, do not assume

Radix token and prop names are taken from the Radix Themes docs (12-step colour scale: 1 to 2 backgrounds, 3 to 5 interactive, 6 to 8 borders, 9 to 10 solid, 11 to 12 text; `--accent-N`, `--gray-N`). Check a name in the docs or in `node_modules/@radix-ui/themes` before relying on it. Contrast ratios are not yet measured: measure them in both modes when a screen is rebuilt.

## Checklist (new screen)

- [ ] Only standard components and tokens; no hex colours; no inline styles
- [ ] Right in light **and** dark; contrast at least 4.5:1 for text, 3:1 for UI parts
- [ ] Every status has a word; whole task works by keyboard; focus visible
- [ ] Money, quantity and dates from shared formatters; text from `uiText`
- [ ] Loading, empty, error and success states handled
- [ ] Works at tablet width; no horizontal page scroll
