# Feature Specification: Electron Hardening (security and performance)

**Feature Branch**: `018-electron-hardening`

**Created**: 2026-11-15

**Status**: Draft

**Input**: User description: "Harden the Electron desktop app using the official Electron security and performance guidance. Close the audit gaps: IPC sender check, permission denial, strict navigation, fuses, ASAR integrity, custom protocol instead of file://, signing, menu, and long database work off the main process."

**PRD source**: `docs/reference/PRD.md` NFR-008 (security), NFR-002 (bill save and print about 1 s), NFR-007 (counter never stalls), NFR-013 (devices).

**Depends on**: `001-shop-os-mvp` (the window, preload bridge, IPC handlers and packaging it builds). This is a LATER feature: nothing here changes MVP scope. Signing (US5) waits for `010-owner-app-sync` or any feature that stores secrets or auto-updates.

**Sources** (all from the official Electron documentation, read 2026-11-15): [Security](https://www.electronjs.org/docs/latest/tutorial/security), [Performance](https://www.electronjs.org/docs/latest/tutorial/performance), [Context isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation), [Sandbox](https://www.electronjs.org/docs/latest/tutorial/sandbox), [Fuses](https://www.electronjs.org/docs/latest/tutorial/fuses), [ASAR integrity](https://www.electronjs.org/docs/latest/tutorial/asar-integrity), [Code signing](https://www.electronjs.org/docs/latest/tutorial/code-signing), [protocol](https://www.electronjs.org/docs/latest/api/protocol), [Utility process](https://www.electronjs.org/docs/latest/api/utility-process), [IPC](https://www.electronjs.org/docs/latest/tutorial/ipc), [safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage), [Native modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules).

## Already in place (must not regress)

`contextIsolation`, `sandbox`, `nodeIntegration` off, a restrictive Content-Security-Policy, new windows denied, a typed bridge with no raw `ipcRenderer`, no remote content, no `webview`. These stay, and a test fails if any is relaxed (FR-010).

## Delivery in three pull requests

```
PR A (US1 + US2 + US3)   main-process checks, small, test-first
PR B (US4 + menu)        packaging: fuses + ASAR integrity
PR C (US6)               custom protocol instead of file://  (needs spike)
Later:  US5 signing (waits for auto-update), US7 utility process (waits for heavy reports/imports)
```

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Only the shop's own screen can run commands (Priority: P1)

Every command from the screen to the database layer is accepted only when it comes from the app's own page. A command from any other frame, page or an unknown sender is refused with a safe error and never reaches a service.

**Why this priority**: If a flaw ever let foreign content run inside the window, this check is what stops it from saving or cancelling bills (constitution I, NFR-008). It is a few lines, and the docs list it as baseline (Security item 17).

**Independent Test**: Call the command handler with a fake event whose sender origin is wrong, missing or null, and confirm nothing is written.

**Acceptance Scenarios**:

1. **Given** a command from the app's own page, **When** it is sent, **Then** it runs as today.
2. **Given** a command whose sender origin is not the app's own, **Then** it is refused with a safe error code and no service is called.
3. **Given** a command with no sender frame (null), **Then** it is refused.
4. **Given** a refused command, **Then** the log records the refusal without customer data.

---

### User Story 2 - The window can never ask for device access (Priority: P1)

Camera, microphone, location, notifications and every other browser permission are denied, for both requests and checks, unless a later feature explicitly allows one.

**Why this priority**: Electron approves every permission request by default (Security item 5). The counter app needs none of them today (barcode scanning arrives with `015` and will allow exactly one).

**Independent Test**: Trigger a permission request and a permission check on the session and confirm both return denied.

**Acceptance Scenarios**:

1. **Given** the page requests any permission, **Then** it is denied.
2. **Given** a permission check, **Then** it reports not granted.
3. **Given** `015` later needs the camera, **Then** it adds one named, tested exception without removing the default.

---

### User Story 3 - Navigation is limited to the app's own page, exactly (Priority: P1)

The window may show only the app's own page (and the dev server while developing). Any other address, including look-alike addresses and other local files, is blocked.

**Why this priority**: The current check is a text-prefix match, which the docs warn can be bypassed (Security item 13), and it accepts any local file address, not only the app's page.

**Independent Test**: Table-driven test of allowed and blocked addresses, including `file:///etc/hosts`, a look-alike dev-server host and an address with extra path segments.

**Acceptance Scenarios**:

1. **Given** the app's own page address, **Then** navigation is allowed.
2. **Given** another local file address, **Then** it is blocked.
3. **Given** a dev-server look-alike (for example the allowed host followed by a dot and another domain), **Then** it is blocked, even in development.
4. **Given** an address that cannot be parsed, **Then** it is blocked.

---

### User Story 4 - A tampered or hijacked installed app refuses to run (Priority: P2)

The packaged app cannot be launched as a plain Node interpreter, cannot be attached to by a debugger from the command line or environment, and refuses to start if its application bundle was altered after packaging.

**Why this priority**: The installer sits on the shop counter's PC. Fuses and ASAR integrity close the door on swapping code inside the bundle (Security item 19, ASAR integrity page). It is P2 because it needs a packaging change, not just code.

**Independent Test**: Package the app, then run the fuse reader against the result, and try to launch it with `ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS` and `--inspect`; then modify the bundle and confirm it will not start.

**Acceptance Scenarios**:

1. **Given** the packaged app, **Then** the fuse report shows run-as-node, node-options and node-inspect disabled, ASAR integrity and load-only-from-ASAR enabled.
2. **Given** `ELECTRON_RUN_AS_NODE=1`, **Then** the packaged app does not act as Node.
3. **Given** the bundle file changed after packaging, **Then** the app terminates at launch.
4. **Given** the development and test Electron binary, **Then** it is untouched, and `pnpm test` still runs (tests depend on run-as-node).
5. **Given** the packaged app, **Then** the database still opens (the SQLite native binary stays outside the archive) and a bill still saves and prints.

---

### User Story 5 - The app can be signed and updated safely (Priority: P3, deferred)

Installers are signed (and on Mac, notarized) so the operating system trusts them and automatic update can work.

**Why this priority**: The docs say automatic update on Mac needs a signed app, and several protections (`safeStorage`, the cookie-encryption fuse) behave inconsistently without a stable signature. Today the app is installed by hand on one shop's machine, so signing adds cost with little gain. Trigger: the first feature that auto-updates or stores a secret (`010`, `012`).

**Independent Test**: Install the signed build on a clean Mac and Windows machine and confirm no "unidentified developer" block and, once added, an update installs.

**Acceptance Scenarios**:

1. **Given** a signed release, **Then** a clean machine installs it without manual override steps.
2. **Given** the first secret to store, **Then** the async secret-storage API is used (the synchronous one is removed in Electron 46).

---

### User Story 6 - The screen is served without whole-disk file access (Priority: P3)

The screen loads from a private app address instead of the local-file protocol, so a flaw in the page cannot read arbitrary files on the machine.

**Why this priority**: Local-file pages can read every file the user can (Security item 18). It is P3 because it changes how the renderer loads, so it first needs a spike proving the built screen works under it.

**Independent Test**: Launch the packaged app and confirm every screen renders in light and dark; request a path outside the app's bundle and confirm it is refused.

**Acceptance Scenarios**:

1. **Given** the packaged app, **Then** all screens, fonts and icons load from the private address.
2. **Given** a request that escapes the app folder (for example parent-directory segments), **Then** it is refused.
3. **Given** the move is complete, **Then** the file-protocol extra-privileges fuse is disabled and the Content-Security-Policy is delivered by header.

---

### User Story 7 - Heavy database work never freezes the counter (Priority: P3, deferred)

Long jobs (large reports, imports, backups) run away from the main process so billing stays responsive while they run.

**Why this priority**: A synchronous query on the main process freezes every window (Performance item 3, NFR-002, NFR-007). Bill saves are milliseconds today. It matters once `011` reports, `012` migration and `010` backups handle large data.

**Independent Test**: Run a report over 500 bills a day for 10 years while saving a bill; the save still completes in about 1 second.

**Acceptance Scenarios**:

1. **Given** a long report is running, **When** a bill is saved, **Then** the save still takes about 1 second (NFR-002).
2. **Given** the helper process crashes, **Then** the app stays open, the bill data is intact and the job reports a clear failure.

---

### Edge Cases

- A dev-server address is allowed only in development, never in a packaged build.
- A refused command must still return the normal result envelope, never throw across the bridge.
- Fuses flipped on the wrong binary would break `pnpm test` (Electron's Node mode), so flipping runs only on the packaged output.
- Moving to a private address changes where local storage lives; the move must not lose any saved preference (theme).
- A null application menu on Mac removes copy and paste shortcuts (FR-009).
- A helper process must not load the database module in a worker thread; native modules crash there.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** (US1): Every IPC command MUST be accepted only from the app's own page origin, and refused if the sender frame is missing. Refusals return the normal error envelope and call no service. (Security item 17; NFR-008)
- **FR-002** (US2): Permission requests and permission checks MUST be denied by default, with each future exception named in code and tested. (Security item 5)
- **FR-003** (US3): Navigation MUST be allowed only to the app's own page (and the dev server in development) using exact address parsing, never text-prefix matching. (Security item 13)
- **FR-004** (US4): The packaged app MUST disable run-as-node, node-options and node-inspect, and enable ASAR integrity and load-only-from-ASAR. (Security item 19; Fuses; ASAR integrity)
- **FR-005** (US4): Fuses MUST be flipped only on packaged output, never on the development or test binary.
- **FR-006** (US4): A CI or release check MUST read the fuse state of the packaged app and fail if it differs from FR-004.
- **FR-007** (US6): The screen MUST load from a private app protocol that serves only files under the app bundle; requests outside it are refused. (Security item 18)
- **FR-008** (US6): After FR-007, the file-protocol extra-privileges fuse MUST be disabled, and the CSP MUST be delivered by response header.
- **FR-009** (US4): The default application menu MAY be removed to speed startup only on platforms where copy, paste and quit shortcuts keep working; on Mac a minimal Edit menu stays. (Performance item 8)
- **FR-010** (all): Tests MUST fail if context isolation, sandbox, Node integration off, the CSP, new-window denial or the narrow bridge is relaxed.
- **FR-011** (US5): Signing and notarization MUST be added before the first auto-update or stored secret. Secrets MUST use the async secret-storage API. (Code signing; safeStorage)
- **FR-012** (US7): Jobs expected to run longer than about 200 ms on large data MUST run outside the main process; no database module is loaded in a worker thread. (Performance item 3; Multithreading)
- **FR-013** (all): Each change MUST record why, trade-off, industry practice and references in `research.md` (CLAUDE.md).
- **FR-014** (all): The Electron version MUST be kept current; each upgrade rebuilds the native database module and re-runs the full suite and the packaged-app check.

### Key Entities

None. This feature adds no tables and changes no bill, stock or ledger records.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of IPC commands from a wrong, missing or null sender are refused with zero writes, proven by tests.
- **SC-002**: 0 permission requests are granted by default.
- **SC-003**: Every address in the blocked-navigation table (look-alikes, other files, unparsable) is blocked; the app's own page is allowed.
- **SC-004**: The packaged app's fuse report matches FR-004 on every release, and a modified bundle fails to launch.
- **SC-005**: `pnpm test` and the end-to-end suite still pass unchanged on the development binary after PR B.
- **SC-006**: After PR C, an arbitrary local file outside the bundle cannot be loaded by the screen.
- **SC-007**: With a long report running, a bill still saves and prints in about 1 second (NFR-002).
- **SC-008**: Bill save and print speed does not regress by more than 5% after any PR in this feature (measured against the `016` benchmark once it exists).

## Assumptions

- First use is on Mac, per NFR-013, so the menu change must keep the Mac Edit menu; Windows and Linux can drop the default menu.
- The Electron documentation read on 2026-11-15 is current for Electron 43; items not covered by it are open items in `research.md`, not facts.
- Adding the fuse-flipping package, if electron-builder has no built-in option, needs the owner's approval first (CLAUDE.md, working with Spec Kit, rule 6).
- This feature does not add tax, bill or stock behaviour and does not alter any constitution principle; Electron security in the constitution is only made stricter.
- Auto-update, secret storage and heavy reports do not exist yet; US5 and US7 stay as recorded intent until a feature needs them.
