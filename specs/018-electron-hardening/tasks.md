---
description: "Task list for Electron hardening (security and performance)"
---

# Tasks: Electron Hardening (security and performance)

**Input**: `specs/018-electron-hardening/` (spec, plan, research, contracts, quickstart)

**Prerequisites**: feature 001 window, preload bridge, IPC handlers and packaging (built). Decisions D1 to D4 in `plan.md` answered before the task that needs them.

**Tests**: Included and written first (constitution VI; the sender check guards bill writes). Each policy is a pure function with a table-driven test.

**Rules for every task**: one PR of 400 changed lines or fewer (`pnpm pr:size`), titled `type(scope): summary`, using the PR template. Follow the `shopos-*` skills (names, size limits, control flow, folder per module with `constants.ts` and `types.ts`). Open items O1 to O15 are in `research.md`. Never flip fuses on the dev or test binary (FR-005).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency)
- **[Story]**: US1 sender check · US2 deny permissions · US3 exact navigation · US4 fuses and ASAR integrity · US5 signing (deferred) · US6 private protocol · US7 utility process (deferred)

---

## Phase 1: Setup and verification of assumptions

- [X] T001 Confirm the built renderer carries the CSP meta tag: run `pnpm build` in `apps/desktop`, check `apps/desktop/out/renderer/index.html` for `Content-Security-Policy`, and record the result in `specs/018-electron-hardening/research.md` O3 _(2026-11-17: the 15 Nov build output carries the CSP meta tag, and `electron.vite.config.ts` injects it. A fresh `pnpm build` failed here with `Cannot find module 'electron/package.json'`. 2026-11-18: a fresh `pnpm build` succeeded and `out/renderer/index.html` carries the `Content-Security-Policy` meta tag.)_
- [ ] T002 Owner action (D1 answered by default `INTERNAL`; D2 to D4 still open): answer D1 (refusal error code), D2 (main platform, O8), D3 (Linux exception, O12) and D4 (migrations outside the archive, O13) from `plan.md`; record each answer in `research.md`
- [ ] T003 [P] Record the performance baseline in `research.md` (SC-008) from a checkout or build of the target branch before PR #43 (PR A1) merges, so the baseline excludes PR A1. Time `apps/desktop/tests/integration/searchPerf.test.ts` and a bill save plus print in both `pnpm dev` and the packaged build (before fuses and the menu). Compare PR A1 and each later PR against that baseline using the same build mode for each measurement

**Checkpoint**: O3 closed, D1 to D4 answered, baseline recorded.

---

## Phase 2: User Story 1 - Only the shop's own screen can run commands (P1) - PR A1

**Goal**: a command from any other sender is refused with the normal error envelope and no service is called (FR-001, SC-001).

**Independent test**: fake event with a foreign page, a null frame, or a same-origin child frame; nothing is written.

- [X] T004 [US1] Spike (O11): in a throwaway Vitest-in-Electron test, create a real `BrowserWindow` loading a `file:` page and log `event.senderFrame.url`, `.origin` and `senderFrame === webContents.mainFrame` for the main frame and a child iframe; record the findings in `research.md` O11 _(2026-11-17: on a `file:` page `senderFrame.origin` is `file://` (not `null`), `.url` is the full file URL, and `senderFrame === webContents.mainFrame` is true for the main frame; a sandboxed child frame got no preload, so it had no bridge to call. Recorded in research O11.)_
- [X] T005 [P] [US1] Write the failing table-driven test for `isTrustedSender` in `apps/desktop/src/main/ipc/senderPolicy/senderPolicy.test.ts` covering every row of `contracts/hardening-policies.md` section 1 (own page, null frame, child frame, foreign page, dev-server page in a packaged build) _(placed in `apps/desktop/tests/unit/senderPolicy.test.ts`: the Vitest `main` project only includes `tests/unit` and `tests/integration`)_
- [X] T006 [US1] Implement the pure `isTrustedSender` in `apps/desktop/src/main/ipc/senderPolicy/senderPolicy.ts` with `types.ts` (`ISenderSummary`) and `constants.ts`; compare parsed scheme and location, never a serialized origin (FR-001) _(16 tests pass)_
- [X] T007 [US1] Write the failing integration case in `apps/desktop/tests/integration/ipcRegistration.test.ts`: a refused sender gets `{ ok: false, code, message }`, no handler or service is called, zero rows written, and a log line without customer data _(also updated `mainEntry.test.ts` and `appConfig.test.ts`)_
- [X] T008 [US1] Call the policy before dispatch in `apps/desktop/src/main/ipc/index.ts` (use `event.senderFrame` and the main window's `mainFrame`); refusal never throws across the bridge; error code per D1 _(D1: reused `INTERNAL` with message `Command refused`; trusted pages come from `listTrustedPageUrls` in `appConfig.ts`; the code is in PR #43 (`feat/018-ipc-sender-check`), so merge #43 before this tasks file)_

**Checkpoint**: SC-001 tests pass; own-page commands behave as before. Ship as PR A1.

---

## Phase 3: User Story 2 - The window can never ask for device access (P1) - PR A2

**Goal**: every permission request is denied and every check reports not granted (FR-002, SC-002).

**Independent test**: trigger a request and a check on the session; both deny.

- [ ] T009 [P] [US2] Write the failing test in `apps/desktop/tests/unit/permissionPolicy.test.ts` (the Vitest `main` project only includes `tests/unit` and `tests/integration`, as in T005): any permission name is denied for requests and not granted for checks; an empty named-exceptions list is the default
- [ ] T010 [US2] Implement `denyAllPermissions` and the empty `ALLOWED_PERMISSION_EXCEPTIONS` constant in `apps/desktop/src/main/app/permissionPolicy/permissionPolicy.ts`, `constants.ts` and `types.ts`
- [ ] T011 [US2] Register `setPermissionRequestHandler` and `setPermissionCheckHandler` on the default session from `apps/desktop/src/main/app/startApp.ts` (next to `installSecurityHeaders`); extend the fake session in `apps/desktop/tests/integration/startApp.test.ts`

**Checkpoint**: SC-002 passes.

---

## Phase 4: User Story 3 - Navigation limited to the app's own page, exactly (P1) - PR A2

**Goal**: only the app page (and the exact dev server in development) is navigable; redirects use the same check (FR-003, SC-003).

**Independent test**: the blocked-address table in `contracts/hardening-policies.md` section 3.

- [ ] T012 [US3] Extend `apps/desktop/tests/unit/mainWindow.test.ts` first with the failing table: own page, `file:///etc/hosts`, `localhost.evil.com` look-alike, extra path segments, unparsable text, dev server in dev and in packaged mode
- [ ] T013 [US3] Move `isNavigationAllowed` to `apps/desktop/src/main/app/navigationPolicy/navigationPolicy.ts` with `types.ts` and `constants.ts`; parse with `URL` and compare scheme, host, port and exact page path; remove `FILE_URL_PREFIX` and `startsWith` from `mainWindow.ts`
- [ ] T014 [US3] In `apps/desktop/src/main/app/mainWindow.ts` add a `will-redirect` listener that applies the same check; extend the `IMainWindow` fake in the test (redirect to a foreign address is prevented, US3 scenario 5)
- [ ] T015 [US3] Verify the offscreen print window (`data:` URL) still works after T011 and T014 (O6): run the print integration test `apps/desktop/tests/integration/print.test.ts` and a manual print in `pnpm dev`; record in `research.md` O6

---

## Phase 5: Regression guard for settings already in place (FR-010) - PR A2

- [ ] T016 [P] Add `apps/desktop/tests/unit/windowSecurityDefaults.test.ts`: fails if `buildMainWindowOptions` relaxes `contextIsolation`, `sandbox` or `nodeIntegration`, if `PACKAGED_POLICY` loses `default-src 'self'` or allows `connect-src` beyond `'none'`, if new windows are not denied, or if the preload exposes anything beyond the typed bridge
- [ ] T017 Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm pr:size`; compare bill save and print time with T003 (SC-008)

**Checkpoint (PR A done)**: US1 to US3 and FR-010 proven by tests.

---

## Phase 6: User Story 4 - A tampered or hijacked installed app refuses to run (P2) - PR B

**Goal**: the packaged app disables run-as-node, node-options and node-inspect, and enables ASAR integrity and load-only-from-ASAR; dev and test binaries are untouched (FR-004 to FR-006, SC-004, SC-005).

**Independent test**: package, read the fuse state, try `ELECTRON_RUN_AS_NODE=1`, alter the archive header.

- [ ] T018 [P] [US4] Write the failing test for the fuse-report parser in `apps/desktop/scripts/checkFuses.test.mjs` (expected set from `contracts/hardening-policies.md` section 4; any difference exits non-zero with the fuse name in the message)
- [ ] T019 [US4] Implement `apps/desktop/scripts/check-fuses.mjs`: read the packaged binary with `@electron/fuses` `getCurrentFuseWireConfig` (already a dependency of electron-builder; if it is not importable from the app, stop and ask the owner before adding a package) and compare with the expected set (FR-006)
- [ ] T020 [US4] Add the `electronFuses` block to `apps/desktop/electron-builder.yml`: `runAsNode: false`, `enableNodeOptionsEnvironmentVariable: false`, `enableNodeCliInspectArguments: false`, `enableEmbeddedAsarIntegrityValidation: true`, `onlyLoadAppFromAsar: true`; leave `loadBrowserProcessSpecificV8Snapshot` unset (research R4 and R5)
- [ ] T021 [US4] Verify O2 and O10 on a real packaged build (`pnpm --filter @shopos/desktop package`): Mac plist has `ElectronAsarIntegrity`; on Windows the integrity hash is embedded; record in `research.md`
- [ ] T022 [US4] Run `check-fuses.mjs` against the packaged app, then confirm `ELECTRON_RUN_AS_NODE=1` does not act as Node on the packaged app and that `pnpm test` still runs on the dev binary (US4 scenarios 1, 2, 4; SC-005)
- [ ] T023 [US4] Test O14 and US4 scenario 3: alter the `app.asar` header on Mac **and on a Windows build** (SC-004 promises both; O10) and confirm the app will not start; alter one packed file with an intact header and record whether it fails at launch or on read
- [ ] T024 [US4] Check O15: try launching the packaged app with Chromium's `--remote-debugging-port`; record the result and, if it attaches, add the smallest block (a startup switch check in `apps/desktop/src/main/app/startApp.ts`) or write the limit into `spec.md` US4 scope
- [ ] T025 [US4] Extend `apps/desktop/scripts/e2e-packaged.mjs` (or add `apps/desktop/tests/e2e/hardening.spec.ts`): packaged app opens the database, saves and prints a bill (US4 scenario 5)
- [ ] T026 [US4] Wire `check-fuses.mjs` as an npm script `check:fuses` in `apps/desktop/package.json` and add it to the release steps in `docs/` (and to the CI packaged smoke job once `017` has one) (FR-006)
- [ ] T027 [US4] Menu (FR-009, D2): add `apps/desktop/src/main/app/appMenu/appMenu.ts` (with test first) that keeps a minimal Edit menu on Mac and may drop the default menu on Windows and Linux; measure startup before and after and keep it only if it helps; call it from `startApp.ts`
- [ ] T028 [US4] Write the accepted gaps into `docs/` (Linux AppImage O12, migrations outside the archive O13) per D3 and D4; repeat T003's timing on the packaged build with fuses and the menu, compare it with T003's packaged baseline, and block PR B if bill save and print is more than 5% slower (SC-008)

**Checkpoint (PR B done)**: SC-004 and SC-005 proven; fuse check passes.

---

## Phase 7: User Story 6 - The screen is served without whole-disk file access (P3) - PR C

**Goal**: the screen loads from a private protocol that serves only files under the built renderer folder (FR-007, FR-008, SC-006).

**Independent test**: every screen renders in System, Light and Dark; a `../` request is refused.

- [ ] T029 [US6] Spike (O4, O5, O7): load the built renderer under a registered `shopos-app` scheme in a scratch branch; record whether module scripts, fonts and Radix assets load, whether `grantFileProtocolExtraPrivileges` can be off, and whether `localStorage` (theme) is lost; write a go or no-go in `research.md`. Stop here if no-go.
- [ ] T030 [P] [US6] Write the failing test for the path guard in `apps/desktop/tests/unit/pathGuard.test.ts` (Vitest discovery, as in T005): in-bundle file served; `../`, encoded `%2e%2e`, absolute paths and non-GET refused (contract section 5)
- [ ] T031 [US6] Implement the path guard and protocol handler in `apps/desktop/src/main/app/appProtocol/` (`pathGuard.ts`, `appProtocol.ts`, `constants.ts`, `types.ts`); register the scheme before app ready and serve with `protocol.handle`
- [ ] T032 [US6] Load the window from the private address in `apps/desktop/src/main/app/mainWindow.ts` and update the navigation policy (T013) and the sender policy (T006) to the new scheme and location; update their tests
- [ ] T033 [US6] Deliver the CSP by response header for the private protocol in `apps/desktop/src/main/app/securityHeaders.ts` (FR-008); update `securityHeaders.test.ts`
- [ ] T034 [US6] Turn the file-protocol extra-privileges fuse off in `electron-builder.yml` and add it to `check-fuses.mjs` expectations (FR-008)
- [ ] T035 [US6] **Ship before T032** (its own release, while the page is still on `file:`): the spec forbids losing the saved theme (edge case), and the new origin cannot read the old origin's `localStorage`. Move the theme preference into main-process storage (`shop_profile.theme`, `system` default, additive migration; read and written through the typed API by `src/renderer/shared/theme/themePreference.ts`), copying the existing `localStorage` theme once on the first load of the T035 `file:` page. Before shipping PR C, launch the installed T035 build, load that page, and verify the existing theme was copied to `shop_profile.theme`. Installing T035 alone is insufficient; document this prerequisite in the release notes and PR C checks. Then, after T032, check every screen in System, Light and Dark in the packaged app; run the Playwright e2e suite
- [ ] T036 [US6] Run the quickstart "Before shipping PR C" and "After PR C" checks and record SC-006 in `research.md`; repeat T003's timing (SC-008)

**Checkpoint (PR C done)**: SC-006 proven.

---

## Phase 8: Deferred (recorded intent, no build now)

- [ ] T037 [US5] Deferred until `010` or `012` adds auto-update or a stored secret (FR-011): at that point write a plan for signing, notarization and the async secret-storage API; resolve O9 first
- [ ] T038 [US7] Deferred until `011`, `012` or `010` handle large data (FR-012): at that point measure a 500 bills a day, 10 years report against a bill save (SC-007) and, if the save passes about 1 s only with a helper process, plan a utility process; never load the database in a worker thread

---

## Phase 9: Polish

- [ ] T039 [P] Update `specs/README.md` status for 018 and tick finished tasks here with a one-line result each
- [ ] T040 [P] Update `.claude/skills/shopos-electron-hardening/SKILL.md` and `docs/` if any rule changed during the spikes
- [ ] T041 Add FR-014 to the release checklist: each Electron upgrade rebuilds the native database module and re-runs `pnpm test`, `pnpm test:e2e`, `check:fuses` and the packaged-app check
- [ ] T042 Final `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test:e2e`; confirm SC-008 against the baseline in T003

---

## Dependencies and execution order

```
Phase 1 ─► Phase 2 (US1, PR A1) ─► Phase 3 + 4 + 5 (US2, US3, guard, PR A2)
                                          │
                                          ▼
                                  Phase 6 (US4, PR B) ─► Phase 7 (US6, PR C)
Deferred: Phase 8 (US5, US7)        Polish: Phase 9 after each PR
```

- US1, US2 and US3 touch different files and can be built in parallel, but ship as A1 (US1) and A2 (US2, US3, FR-010) to stay within 400 lines.
- US4 needs PR A merged (the print and permission behaviour must be stable before packaging checks) and D2 to D4 answered.
- US6 needs US4 (the fuse check), US1 and US3 (their policies change scheme), and a "go" from T029. The theme move in T035 ships in a release **before** T032 switches the scheme.

## Parallel examples

- T003, T005, T009 can start together (different files, no shared code).
- T018 and T030 are independent of the implementation tasks before them.

## Implementation strategy

1. **MVP**: Phase 1 and 2 (US1). A foreign sender can no longer reach a service.
2. Phases 3 to 5 (PR A2): finish the main-process checks.
3. Phase 6 (PR B): packaging protections.
4. Phase 7 (PR C): only after the spike says go.
5. US5 and US7 wait for their triggers.

## Format validation

Every task has a checkbox, an ID, a `[P]` only where parallel, a `[US]` label inside story phases, and a file path or named document.
