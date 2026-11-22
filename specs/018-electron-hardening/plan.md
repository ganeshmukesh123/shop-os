# Implementation Plan: Electron Hardening (security and performance)

**Branch**: `018-electron-hardening` | **Date**: 2026-11-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/018-electron-hardening/spec.md`; audit and recommendations in [research.md](./research.md).

## Summary

Close the audit gaps in `apps/desktop` without changing any bill, stock or ledger behaviour. Three pull requests, in this order (spec "Delivery in three pull requests"):

- **PR A** (US1, US2, US3, FR-010): three small main-process checks, test-first: IPC sender check, deny-all permissions, exact navigation.
- **PR B** (US4, FR-009): fuses and ASAR integrity on the packaged output, a fuse-report check, and the menu decision.
- **PR C** (US6): serve the screen from a private protocol instead of `file://`, after a spike.

US5 (signing) and US7 (utility process) stay recorded intent; they get tasks only as "deferred, trigger" lines.

```
Renderer page ──► preload bridge ──► ipcMain.handle ──► handlers ──► services
                                         │ PR A: sender check (US1)
Session  ── permission request/check ── PR A: deny all (US2)
Window   ── will-navigate / will-redirect ── PR A: exact URL check (US3)
Package  ── electron-builder `electronFuses` ── PR B: fuses + ASAR integrity (US4)
Loader   ── file:// ──► shopos-app:// ── PR C: private protocol (US6)
Example: a foreign frame sends "bill:save" for C1/26-27/000123 (2 pcs x ₹120)
         ──► refused at the sender check, no service called, nothing written
```

## Technical Context

**Language/Version**: TypeScript 5.x strict, Node 22, Electron 43.8, electron-builder ~26.15.7

**Primary Dependencies**: existing only. electron-builder 26.15.7 has a built-in `electronFuses` option (found in its `scheme.json`; it passes the options to `@electron/fuses`, which it already depends on), so no new package is expected (research O1, resolved below). Ask the owner before adding any package (CLAUDE.md rule 6).

**Storage**: T035 adds a `theme` column (default `system`) to the existing `shop_profile` table through one additive migration before PR C. No new tables, no other migrations, and no change to bills, stock or ledger.

**Testing**: Vitest unit tests with fake Electron objects (pattern of `tests/unit/mainWindow.test.ts` and `securityHeaders.test.ts`), integration test for IPC registration (`tests/integration/ipcRegistration.test.ts`), Playwright packaged-app checks (`scripts/e2e-packaged.mjs`), and a fuse-report script run on the packaged output.

**Target Platform**: macOS first (NFR-013), Windows second, Linux AppImage accepted as an exception for ASAR integrity (research O12, decision D3 below).

**Project Type**: desktop-app (Electron main process, packaging config)

**Performance Goals**: bill save and print not slower by more than 5% after any PR (SC-008, against the `016` benchmark once it exists; until then time `searchPerf` and a bill save plus print by hand, as T003 records, in the same build mode before and after).

**Constraints**: fuses only on packaged output, never the dev or test binary (tests use `ELECTRON_RUN_AS_NODE`, FR-005); each PR within 400 changed lines (`pnpm pr:size`); lint limits (file 200, function 40, complexity 10, no single-letter names).

**Scale/Scope**: about 5 new small main-process modules, one config block, one check script, one protocol handler (PR C).

## Constitution Check

| Principle | How this plan satisfies it | Status |
|---|---|---|
| I, II (never alter a saved bill; immutable records) | No data path changes. The sender check only blocks writes from foreign senders (SC-001). | Pass |
| III (integer money) | Not touched | Pass |
| IV (offline-first) | The private protocol serves local files only; no network added | Pass |
| V (rules in core) | Security checks are Electron-specific, so they live in `src/main/app` and `src/main/ipc`; pure URL and sender decisions are plain functions with no Electron import so they stay unit-testable | Pass |
| VI (test-first) | Each task writes the failing table-driven test first; the IPC sender check writes bills' gatekeeping, so it is test-first by rule | Pass |
| VII (simplicity, scope) | Built-in `electronFuses`, no new package; US5 and US7 deferred; `loadBrowserProcessSpecificV8Snapshot` skipped | Pass |
| VIII, IX (names, small pure code) | Decision functions are pure; Electron wiring stays at the edge | Pass |
| X (design) | No UI change. PR C must re-check every screen in System, Light and Dark. | Pass (PR C gate) |
| Electron security (constitution constraints) | Only stricter; FR-010 adds a regression test | Pass |
| New packages need approval | None expected; if O2 or the Windows integrity check needs one, stop and ask | Pass |

**Post-design re-check**: unchanged. No violations, so Complexity Tracking stays empty.

## Phase 0 results (open items from research.md)

| Item | Result | Where it ends |
|---|---|---|
| O1 built-in fuse option | **Resolved**: `electronFuses` exists in electron-builder 26.15.7 (`scheme.json`, `platformPackager.js`) | Use it; no new package |
| O2 ASAR integrity wiring | **Partly resolved**: electron-builder computes the header hash (`integrity.computeData`) and writes `ElectronAsarIntegrity` into the Mac plist; Windows behaviour not read | Task T-B2 verifies on the packaged build |
| O3 CSP for `file://` | **Likely resolved**: `electron.vite.config.ts` replaces the `<!--CSP-->` marker in `index.html` (build-time meta tag). Not yet checked in the built file | Task T-A0 confirms in `out/` |
| O4, O5, O7 | Open, need the PR C spike | Task T-C1 |
| O6 print window | Open | Task T-A5 (run after PR A) |
| O8 main platform | Open, owner answer needed | Decides FR-009 in PR B |
| O9 to O10, O12 to O15 | Open | Each has a named task below |
| O11 `senderFrame` values | Open | Task T-A1 is a spike-first test against real Electron before the check is relied on |

## Decisions needing the owner (answer before the task that needs it)

| # | Decision | Recommendation | Needed by |
|---|---|---|---|
| D1 | Error code for a refused command. Existing codes have no "forbidden". Reuse `INTERNAL` with message "Command refused", or add `FORBIDDEN` to `packages/core/src/errors.ts` and the IPC contract | Reuse `INTERNAL` now (no contract change, no core change); the log records the real reason (US1 scenario 4) | PR A, T-A2 |
| D2 | Main platform: Mac or Windows (O8) | Mac, per NFR-013; keep a minimal Edit menu, do not null the menu | PR B, FR-009 |
| D3 | Linux AppImage exception for ASAR integrity (O12) | Accept as an exception and say so in `docs`; Linux is not a shop platform | PR B |
| D4 | Bundle `drizzle` migrations inside the archive (O13) | Defer: they are read-only SQL applied by hash-checked journal; record as a known gap | PR B |

## Project Structure

### Documentation

```text
specs/018-electron-hardening/
├── spec.md   plan.md   research.md   quickstart.md   tasks.md
├── checklists/requirements.md
└── contracts/hardening-policies.md     behaviour contract for the three checks and the fuse set
```

No `data-model.md`: T035 adds one preference column to an existing table, as described under Storage.

### Source (new and changed files)

```text
apps/desktop/
├── src/main/
│   ├── app/
│   │   ├── navigationPolicy/        isNavigationAllowed (moved out of mainWindow.ts), tests, types
│   │   ├── permissionPolicy/        denyAllPermissions + named exceptions list (empty), tests
│   │   ├── mainWindow.ts            wire will-navigate, will-redirect, permission handlers
│   │   ├── appMenu/                 PR B: minimal menu per platform, tests
│   │   └── appProtocol/             PR C: shopos-app:// handler, path guard, tests
│   └── ipc/
│       ├── senderPolicy/            isTrustedSender (pure), tests, constants
│       └── index.ts                 call the policy before dispatch
├── electron-builder.yml             PR B: `electronFuses` block; PR C: fuse for file protocol
├── scripts/
│   └── check-fuses.mjs              PR B: read fuse state of packaged app, fail on mismatch (FR-006)
└── tests/
    ├── unit/                        policy tests (pure)
    ├── integration/ipcRegistration.test.ts   sender cases
    └── e2e/hardening.spec.ts        packaged-app checks (PR B, PR C)
```

**Structure Decision**: each policy gets its own folder with code, tests, `constants.ts` and `types.ts` (CLAUDE.md placement rule). Policies are pure functions taking plain values (URL strings, a sender's frame summary), and `mainWindow.ts` and `ipc/index.ts` do the Electron wiring, so the decisions are testable without Electron.

## Milestones and pull requests

Estimates for one builder alongside the 001 work; PR C is gated on its spike.

| PR | Scope | Size target | Exit criteria |
|---|---|---|---|
| A1 | US1 sender check + O11 spike | about 200 lines | SC-001 tests pass; refusal logged without customer data |
| A2 | US2 permissions + US3 navigation + FR-010 regression test | about 300 lines | SC-002, SC-003 pass; print window still works (O6) |
| B | US4 fuses, ASAR integrity, `check-fuses`, menu | about 250 lines | Fuse report matches FR-004; `ELECTRON_RUN_AS_NODE` rejected on packaged app; `pnpm test` unchanged (SC-005) |
| C0 | Spike: built screen under a custom protocol (O4, O5, O7) | notes only, in `research.md` | Go or no-go recorded |
| C | US6 protocol, path guard, header CSP, fuse | about 350 lines | SC-006; all screens render in System, Light, Dark; theme preference kept |

```
A1 ─► A2 ─► B ─► C0 (spike) ─► C
                  └─ US5 signing, US7 utility process: deferred, trigger in spec
```

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `senderFrame` of a `file:` page behaves differently from expectation (O11) | Medium | High (could refuse every command) | Test against real Electron first; e2e packaged check saves a bill |
| Fuses flipped on the dev binary break `pnpm test` | Low | High | Flip only inside electron-builder's packaging step; SC-005 check |
| ASAR integrity refuses a valid build on Windows (O10) | Low | Medium | Verify on a Windows build before release; keep it behind the packaged-app check |
| Custom protocol loses saved theme (O7) | Medium | Low | Before shipping PR C, launch the installed T035 build, load its `file:` page and verify that the first-load copy saved the existing `localStorage` theme to `shop_profile.theme`. Installing T035 alone is insufficient; skipping the copy falls back to System |
| Navigation rule blocks the dev server | Medium | Low | Parse host and port exactly; dev server only when `isDev` |

## Complexity Tracking

No violations to justify.
