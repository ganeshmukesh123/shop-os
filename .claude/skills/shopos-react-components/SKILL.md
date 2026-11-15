---
name: shopos-react-components
description: "Use when creating, changing or splitting any React screen, component or hook in the Shop OS renderer (apps/desktop/src/renderer). Defines component folders, pure presentational components, hooks for logic, props and state rules, and where constants and types live."
---

# React components in Shop OS

Authority: constitution IX (small, pure, placed), VIII (names), X (design). Read `shopos-engineering-standards` first.

## 1. Folder layout (target)

One folder per component. Screens are compositions of small components. Cross-folder code goes in `shared/`.

```
apps/desktop/src/renderer/
  app/                     App shell, providers (theme, toast), routes
  features/
    billing/
      NewBillScreen/
        NewBillScreen.tsx          composition only, 120 lines or less
        NewBillScreen.constants.ts
        NewBillScreen.types.ts     IBillFormValues, IBillLineValues
        NewBillScreen.test.tsx
        components/
          BillSearchBox/           BillSearchBox.tsx, .constants.ts, .types.ts
          BillLinesTable/
          BillSummaryPanel/
          PaymentModePicker/
          RecoverDraftDialog/
        hooks/
          useBillForm.ts           state and updates (no JSX)
          useBillSave.ts           calls the typed API, handles errors
    inventory/  settings/  bills/
  shared/
    components/   StatusMessage, StatusBadge, PageHeader, EmptyState, MoneyText, QuantityText
    hooks/
    theme/        theme preference + provider (System, Light, Dark)
    constants/
    api/          typed command client (call("bills.save", ...))
    text/         uiText (all user-facing strings)
```

This is the **target** layout. Today the renderer still has `screens/`, `components/`, `state/` and `strings.ts` (which holds `uiText`); they move into this layout when next touched, one folder per PR (spec 001 tasks T088 to T090), not all at once.

## 2. Rules

1. **Pure presentational components.** Props in, markup out. No data fetching, no `window.shopos`, no formatting by hand, no business rules.
2. **Logic in hooks.** A hook owns state, calls the typed API and returns plain values and handlers. The component only renders. A hook has one purpose (`useBillForm`, not `useEverything`).
3. **Small.** A component is 120 lines or less; a hook 60 or less. Over that, split by responsibility.
4. **Props.** At most about 6; if more, group into one typed object or split the component. Props are typed with an `I` interface in `<name>.types.ts`. Prefer passing values and callbacks over passing whole state setters.
5. **Composition over configuration.** Use `children` and small parts instead of a component with many boolean props (`<Dialog><Dialog.Title/>...`).
6. **State.** Keep state as low as possible; derive instead of storing (`const isEmpty = lines.length === 0`). No duplicated state. Server data (items, bills) comes from the typed API, not copies in many places.
7. **Effects.** Only for syncing with the outside world (subscriptions, timers, keyboard listeners). Never to compute values or to react to a click. Always clean up.
8. **Keys and lists.** Stable ids as keys, never the array index for reorderable lists.
9. **Memoisation.** Do not add `useMemo`/`useCallback`/`memo` by habit. Add one only for a measured problem, and write why.
10. **Constants and types** beside the component (`<name>.constants.ts`, `<name>.types.ts`). Used by two folders, they go in `shared/`.
11. **Text** comes from `shared/text` (`uiText`), money, quantity and dates from the shared formatters.
12. **Styling** follows `shopos-radix-design-system`: tokens and Radix props, no inline `style`.
13. **Accessibility.** Every input has a label, every icon button an accessible name, whole task works by keyboard, status has a word.

## 3. Control flow in JSX

```tsx
// Conditional output: &&
{hasNegativeStock && <StatusMessage role="warning" label="Negative stock">{warningText}</StatusMessage>}

// Two-way choice: one ternary
{isCancelled ? <CancelledBanner reason={cancelReason} /> : <PrintButton billId={billId} />}

// More than two: a lookup, never nested ternaries
const STATUS_COMPONENT_BY_STATE = { loading: LoadingState, empty: EmptyState, ready: ReadyState };
```

## 4. Worked example: splitting `NewBillScreen.tsx` (472 lines today)

| New part | Responsibility |
|---|---|
| `useBillForm` | Form state, add/change/remove line, discount mode, derived totals through `@shopos/core` |
| `useBillDraftAutosave` | Autosave and recover draft (exists as `useDraftAutosave`) |
| `useBillSave` | Build the `bills.save` input (with `clientBillId`), call the API, show errors, reset |
| `BillSearchBox` | Search input, suggestions, keyboard highlight (pure; receives matches and callbacks) |
| `BillLinesTable` + `BillLineRow` | Render lines; report changes |
| `BillSummaryPanel` | Customer, payment mode, totals, Save button |
| `RecoverDraftDialog` | Recovered-draft prompt |
| `NewBillScreen` | Compose the above; 120 lines or less |

Do this split with the tests green before and after each step, one extracted part per commit.

## 5. Checklist

- [ ] Component is pure and under 120 lines; hook under 60
- [ ] Props typed with an `I` interface; no more than about 6
- [ ] No `useEffect` used for derived values
- [ ] No inline `style`, no hex colours, no hand-formatted money or dates
- [ ] Text from `uiText`; keyboard and screen-reader behaviour checked
- [ ] Looks right in light and dark mode
