# Shop OS Design Guidelines

**Status**: Draft 1, 2026-11-14. Rules marked **Open** are decisions still to confirm.
**Applies to**: every screen, dialog and printed output in Shop OS (counter app now; owner and godown phone apps later).
**Authority**: constitution principle X (design consistency) and this document. If this document conflicts with the constitution, the constitution wins. If it conflicts with a library default (Radix Themes), this document wins.
**Visual sample**: https://claude.ai/artifact/BVHiC7yxTdokTbZDbG6B2T (counter billing screen in the dense style, light and dark). Copy of the intent below; the sample is for discussion only.

## 1. Principles

1. **Fast at the counter.** Billing in a rush matters more than looks. Compact screens, everything reachable by keyboard, no needless clicks.
2. **One way to do each thing.** The same job looks and reads the same on every screen: same component, same words, same place.
3. **Meaning is never colour alone.** Every status has a word (Blocked, Pending, Saved) as well as a colour.
4. **Light and dark are both first-class.** Every screen works, reads well and passes contrast in both. Nothing is designed in one theme and patched in the other.
5. **Use the system, not one-offs.** Use theme tokens and the standard components. No hand-picked colours, sizes or inline styles.
6. **Plain, honest wording.** Say what happened and what to do next, in the shop's own words.

## 2. Foundations

### 2.1 Colour roles

Use roles, not colour names. Each role maps to a Radix colour through the component's `color` prop or Radix tokens. Never a hex value.

| Role | Radix colour | Used for | Always paired with |
|---|---|---|---|
| Primary | accent (indigo) | The one main action on a screen, selected state, links | A text label |
| Danger | `red` | Rule broken, destructive action, errors | The word "Blocked" or "Error" |
| Warning | `orange` (**Open**: `amber` if orange reads too red in dark mode) | Needs attention: negative stock, UPI pending, backup late | The word "Pending", "Negative" or "Late" |
| Success | `green` | Done: saved, backup OK | The word "Saved" or "OK" |
| Neutral | gray (slate) | Everything else | n/a |

Current theme baseline (`apps/desktop/src/renderer/main.tsx`): accent indigo, gray slate, radius medium, scaling 110%. **Open**: whether desktop scaling stays 110% or goes to 100% for the dense counter style; decide after trying both on the counter computer.

**Radix 12-step scale** (verified in the Radix Themes colour docs): steps 1 to 2 are backgrounds, 3 to 5 interactive states, 6 to 8 borders and separators, 9 to 10 solid colours, 11 to 12 text. Tokens are named `--accent-9`, `--gray-12`, `--red-9` and so on. Rules:

| Need | Token |
|---|---|
| Page and panel background | `--color-background`, `--color-panel-solid` (or `--gray-1`, `--gray-2`) |
| Normal text | `--gray-12` |
| Secondary text | `--gray-11` (never lighter than step 11) |
| Border or divider | `--gray-6` to `--gray-7` |
| Primary action fill | `--accent-9` (use the component's `color` and `variant` props, not the variable) |
| Status text on a tinted background | step 11 of the status colour (`--red-11`, `--green-11`) |

Prefer the component's `color` prop (`<Button color="red">`) and `highContrast` over custom CSS.

### 2.2 Typography

- One UI typeface (system or Inter). No second display face.
- Scale uses Radix `size` steps. Counter on desktop: body and controls `size="2"`, section headings `size="3"`, screen titles `size="4"`, the bill total `size="6"` with bold weight. Tablet and phone: controls `size="3"`.
- Digits that line up in columns (money, quantity, dates) use tabular figures: `font-variant-numeric: tabular-nums`. Money and quantity are right-aligned in tables.
- Running text never exceeds about 70 characters per line.

### 2.3 Spacing, radius, size

- Spacing uses the Radix space scale (`--space-1` to `--space-9`); no pixel values in screens.
- Radius: medium everywhere; no mixed radii.
- Touch targets: at least 32 px high on desktop, at least 44 px on tablet and phone.
- **Density**: counter on desktop is dense (many rows visible); tablet and the owner and godown phone apps use larger controls. **Open**: confirm dense for the counter and decide the phone apps' density when feature 010 starts.

## 3. Light and dark mode (required)

Both modes are supported on every screen, and neither is an afterthought.

### 3.1 Behaviour

- Three choices in Settings: **System** (default), **Light**, **Dark**. The choice is remembered on this device.
- System follows the operating system's light or dark setting and updates live when it changes.
- The choice applies at once with no restart and no flash of the wrong theme on launch.

### 3.2 How it is built

Verified in the Radix Themes docs: `Theme` accepts `appearance="light"` or `"dark"` and has no built-in "follow the system" option, so we add one small piece of our own.

- A single `shared/theme` module holds the preference type, the stored value, and a hook that resolves System to Light or Dark using `window.matchMedia("(prefers-color-scheme: dark)")` and listens for changes.
- The root of the renderer passes the resolved value to `Theme appearance`. The stored preference is read before the first render so the first paint is already correct (this is a local app, so there is no server rendering to worry about).
- Optional: also set Electron's native theme so window chrome (title bar, scrollbars, native dialogs) matches.
- Components never read the theme themselves; they use tokens, which change with the theme.

### 3.3 Rules for every screen

1. Colours come from Radix tokens or component `color` props only. No hex, `rgb()` or named colours anywhere.
2. Never assume a white or dark background. Use `--color-background` and panel tokens.
3. Text and icons use steps 11 or 12; status backgrounds use step 3 with step 11 text, which Radix designs to work in both modes.
4. Icons use `currentColor`. Images that are not photos (logos, diagrams) need a version that works on both backgrounds.
5. Shadows and borders come from tokens; check that borders are still visible in dark mode.
6. **Printed and PDF output is always light**: black text on white paper in the receipt and A4/A5 layouts, whatever theme the screen uses (the bill layout contract, `specs/001-shop-os-mvp/contracts/bill-layout.md`, stays as is).
7. Every status keeps its word in both modes, so nothing depends on how a colour looks in either.

### 3.4 Contrast and testing

- Text and meaningful icons meet WCAG AA: at least 4.5:1 for normal text, 3:1 for large text and for UI parts such as borders of inputs and focus rings, in **both** themes.
- Each new screen is checked in light and dark, at desktop and tablet size, before it is marked done (checklist in section 9).
- Status colours (danger, warning, success) are checked on both backgrounds. **Open**: measure the actual ratios with a contrast tool when the first screens are rebuilt and record them here.

## 4. Layout and components

### 4.1 App shell

Left navigation (Items, New bill, Bills, Settings), a main area, an optional right-hand summary panel on the billing screen, a shortcut hint bar at the bottom of the counter screens. The shell is one component used by every screen.

### 4.2 Which component for which job

| Job | Use | Notes |
|---|---|---|
| Main action | `Button` solid, accent | One per screen area |
| Secondary action | `Button` soft or outline, gray | |
| Destructive action | `Button` `color="red"` | Always asks for a reason or confirmation where data is affected |
| Text input, number input | `TextField` | Label above, never placeholder-only; error text below |
| Choice of a few | `SegmentedControl` or `RadioGroup` | Payment mode, discount type |
| Choice of many | `Select` | Unit, print target |
| Dialog | `Dialog` | Title, one sentence of body, actions at bottom right |
| Notice | `Callout` or the shared message pattern (section 5.1) | |
| Toast | Radix `Toast` through the shared toast helper | Saved, copied; auto-hide; never the only record of an error |
| Table | `Table` | Compact rows on the counter; sticky header for long lists |
| Status | `Badge` with a word | Never a coloured dot alone |

### 4.3 Screens and dialogs

- Each screen has one title, one primary action, a predictable place for secondary actions.
- Dialogs trap focus, close with Esc, and name their action ("Cancel bill", not "OK").
- Long forms are split into labelled groups; short forms are single column.
- No horizontal page scroll; only tables may scroll sideways inside their own container.

## 5. Counter behaviour

### 5.1 Messages: one pattern

Label first, a plain sentence second, one action last. Same wording and position on every screen.

| Kind | Role | Example |
|---|---|---|
| Blocked | Danger | **Blocked** Above MRP ₹450.00. Lower the rate to continue. |
| Approval | Primary | **Approval** Below cost ₹300.00. Owner approval needed. [Ask owner] |
| Pending | Warning | **Pending** UPI payment not confirmed yet. [Enter reference] |
| Saved | Success | **Saved** Bill C1/26-27/000123 saved. [Print] |
| Negative stock | Warning | **Negative stock** Elbow 1" will go to −3 pcs. The bill still saves; count the shelf later. |

### 5.2 Standard states

| State | What it shows |
|---|---|
| Loading | A skeleton or spinner after 300 ms; never a blank screen |
| Empty | What goes here and the first action: "No items yet. [Add your first item]" |
| Error | What went wrong, what to do next, a Retry where it helps; never only a code |
| Success | The result and the next step ("Saved. [Print] [New bill]") |
| Offline | Billing continues silently; a small sync indicator shows pending changes |

### 5.3 Keyboard first

| Key | Action |
|---|---|
| `/` | Focus search |
| `Enter` | Add the top match / confirm |
| `Ctrl or Cmd + N` | New bill |
| `Ctrl or Cmd + S` | Save the bill |
| `Ctrl or Cmd + P` | Print |
| `Esc` | Close dialog or clear search |
| Arrow keys | Move in lists and the variant grid |

One shortcut table is the source of truth; screens show a hint bar from it. Focus is always visible (Radix focus ring, step 8) in both themes. Tab order follows reading order.

### 5.4 Formats

| Thing | Format | Source |
|---|---|---|
| Money | `₹1,00,000.00` (Indian grouping) | shared core formatter |
| Quantity | `2.5 metre`, `2 pcs` (trailing zeros trimmed) | shared core formatter |
| Date and time | `07/12/2026 14:05` | shared formatter |

Screens never format these by hand.

## 6. Content

- English at launch; **all** user-facing text lives in one text module so Hindi can be added (PRD NFR-012).
- Name things by what staff recognise: "Save and print", not "Commit".
- Buttons say what happens ("Cancel bill", "Print"). Errors say what to do. No apologies, no jargon, no exclamation marks.
- Item names, units and trade names are shown exactly as stored.

## 7. Accessibility

- Contrast: section 3.4. Focus visible: section 5.3.
- Every input has a visible label. Icon-only buttons have an accessible name.
- Status uses a word plus colour, never colour alone (PRD NFR-011).
- Large touch targets on tablet and phone (section 2.3).
- Respect the operating system's reduced-motion setting; keep motion short and rare.
- Dialogs, menus and selects use Radix components so keyboard and screen-reader behaviour comes built in.

## 8. How design shows up in code

Rules for the renderer (they extend the naming and structure rules in the constitution, principles VIII and IX):

1. **Tokens and props, not values.** Use Radix props (`size`, `color`, `variant`, `radius`) and tokens (`var(--gray-12)`). No hex or `rgb()` colours, no pixel font sizes.
2. **No inline `style={{ }}`.** Allowed only for a value computed at run time that no token expresses (for example a column width from data). Put it in a small, named style object in the component's folder with a comment saying why.
3. **One folder per component**, holding the component, its constants (`<name>.constants.ts`), its types and interfaces (`<name>.types.ts`) and its tests. Anything used by more than one folder lives in `shared/`.
4. **Components are pure** and small: props and state in, markup out. Data fetching, formatting and business rules live elsewhere.
5. **Constants** are `UPPER_SNAKE_CASE`, interfaces `I`-prefixed, enums `PascalCase` (constitution VIII).
6. **Shared building blocks** (message, status badge, page header, empty state, money and quantity text, theme provider) live in `apps/desktop/src/renderer/shared/` and are used by every screen.

Example of what is and is not allowed:

```tsx
// Not allowed: hard-coded colour and size, inline style, hand-typed money
<div style={{ color: "#d33", fontSize: 14 }}>Above MRP</div>
<span>₹{amount}</span>

// Allowed: shared components and tokens
<StatusMessage role="danger" label="Blocked">
  Above MRP <MoneyText paise={mrpPaise} />. Lower the rate to continue.
</StatusMessage>
```

Enforcement: ESLint warns on inline `style` and on hard-coded colour strings. Everything else is a review check against the checklist below.

## 9. New-screen checklist

Before a screen is marked done:

- [ ] Uses only standard components and tokens; no hex colours, no inline styles
- [ ] Looks right and passes contrast in **light and dark**
- [ ] Every status has a word as well as a colour
- [ ] Whole task works by keyboard; focus visible; tab order sensible
- [ ] Money, quantity and dates use the shared formatters
- [ ] All text is in the text module; wording follows section 6
- [ ] Loading, empty, error and success states are handled
- [ ] Works at tablet width without horizontal page scroll
- [ ] Components are small and pure; constants and types sit in the component folder or `shared/`

## 10. Open decisions and assumptions

| # | Item | Status |
|---|---|---|
| D1 | Dense style for the counter; density for phone apps | Proposed; confirm after the first rebuilt screen |
| D2 | Desktop scaling 110% or 100% | Open |
| D3 | Warning colour `orange` or `amber` in dark mode | Open |
| D4 | Contrast ratios measured and recorded | Not done |
| D5 | Brand colour from the shop's logo, if any | None given; keeping indigo and slate |
| D6 | Theme preference stored in local storage or in the database settings | Open (a per-device local setting is assumed) |
| D7 | Existing screens brought in line (5 screens, 3 components, 32 inline styles at 2026-11-14) | Not started |
