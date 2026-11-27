# Research: Electron Hardening

Source: official Electron docs read 2026-11-15 (links in `spec.md`) and an audit of `apps/desktop` the same day. Claims marked **unverified** must be checked by the task that depends on them. Nothing here has been run.

## Audit: what exists today

| Item | File | State |
|---|---|---|
| Isolation, sandbox, no Node | `src/main/app/mainWindow.ts:25-27` | In place |
| CSP header | `src/main/app/securityHeaders.ts` | In place (header; see O3 for `file://`) |
| Window open denied | `mainWindow.ts:47` | In place |
| Navigation check | `mainWindow.ts` `isNavigationAllowed` | Uses `startsWith`; accepts any `file://` |
| IPC sender check | `src/main/ipc/index.ts:11` | Missing (`_event` ignored) |
| Permission handler | none | Missing |
| Fuses, ASAR integrity | `electron-builder.yml` | Missing |
| Signing | `electron-builder.yml` (`identity: null`) | Unsigned |
| Application menu | none | Default menu kept |

## Recommendations (why, trade-off, industry practice, references)

### R1. IPC sender validation (US1)
- **Why**: a foreign frame must never reach a service that writes bills (constitution I, NFR-008).
- **Trade-off**: a few lines per handler wrapper. Serialized origins are the text `"null"` for `file:` and unregistered custom schemes, so the check compares the parsed scheme and location of the sender's main frame instead (and rejects child frames); PR C strengthens it with a private protocol. What `senderFrame.origin` returns for `file:` is unverified (O11). Alternative rejected: trusting the context bridge alone; the docs say isolation "does not automatically mean that everything you do is safe".
- **Industry practice**: the Electron security checklist lists it as item 17. No reliable public practice from a named company was found; not invented.
- **References**: [Security](https://www.electronjs.org/docs/latest/tutorial/security), [Context isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation).

### R2. Deny all permissions (US2)
- **Why**: Electron auto-approves permission requests by default.
- **Trade-off**: later features add named exceptions (005 needs the microphone for problem-report voice notes; 015 needs none on the desktop, because camera scanning runs in the phone apps). Cost is one small function.
- **Industry practice**: Electron security item 5. No named-company source found.
- **References**: [Security](https://www.electronjs.org/docs/latest/tutorial/security).

### R3. Exact navigation (US3)
- **Why**: the docs warn that `startsWith('https://example.com')` is bypassed by `https://example.com.attacker.com`; ours accepts every `file://` address.
- **Trade-off**: dev-server URL handling must parse host and port, and `will-redirect` needs the same check as `will-navigate`. Alternative rejected: regex, which is easier to get wrong.
- **Industry practice**: Electron security item 13; no named-company source found.
- **References**: [Security](https://www.electronjs.org/docs/latest/tutorial/security).

### R4 and R5. Fuses and ASAR integrity (US4)
- **Why**: fuses stop abuse of the app through `ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS` and `--inspect`; ASAR integrity detects changes to `app.asar` on macOS and Windows. They do **not** make the install tamper-proof: ASAR integrity does not apply to the Linux AppImage, does not cover files outside the archive (the `drizzle` migrations in `extraResources`, the unpacked `better-sqlite3`), and while the app is unsigned someone with write access to the install folder can replace the whole package.
- **Trade-off**: a build step; never flip on the dev binary (tests use run-as-node). `embeddedAsarIntegrityValidation` adds a small read cost. The `loadBrowserProcessSpecificV8Snapshot` fuse is skipped for now because it slows main-process startup (counter startup matters); revisit with measurements.
- **Industry practice**: the Electron docs recommend these for all apps. VS Code moved its renderers to sandboxed processes (Microsoft engineering blog, vendor-written); no company-level fuse data was found.
- **References**: [Fuses](https://www.electronjs.org/docs/latest/tutorial/fuses), [ASAR integrity](https://www.electronjs.org/docs/latest/tutorial/asar-integrity).

### R6. Custom protocol (US6)
- **Why**: `file://` pages can read all local files.
- **Trade-off**: changes loading and local storage origin; needs a spike. Rejected: staying on `file://` (simplest, weakest).
- **References**: [protocol](https://www.electronjs.org/docs/latest/api/protocol).

### R7. Signing (US5, deferred)
- **Why**: auto-update on Mac needs a signed app; `safeStorage` may re-prompt without a stable signature.
- **Trade-off**: an Apple developer account (cost not verified here) and CI secrets, against hand-installing on one machine.
- **References**: [Code signing](https://www.electronjs.org/docs/latest/tutorial/code-signing), [safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage).

### R8. Menu (FR-009)
- **Why**: a small startup gain. Measured 2026-11-27 (packaged e2e build, Mac, warm, launch to the Items button, 6 runs): 533 to 629 ms with the default menu, 523 to 571 ms with the minimal one, within noise. Kept instead because Electron's default menu offers View > Reload (Cmd+R) and Toggle Developer Tools (Alt+Cmd+I) in the packaged app; the minimal menu has neither.
- **Trade-off**: on Mac a null menu removes Cmd+C and Cmd+V, and first use is on Mac; hence the Mac build keeps the app menu (About, Hide, Quit) and the Edit menu. Windows and Linux packaged builds get no menu. Unpackaged runs keep the default menu for developers.
- **References**: [Performance](https://www.electronjs.org/docs/latest/tutorial/performance).

### R9. Utility process (US7, deferred)
- **Why**: a synchronous query on the main process freezes every window.
- **Trade-off**: crosses a process boundary, so `better-sqlite3` must be loaded there too (separate connection, WAL); extra code for no gain at MVP data sizes.
- **Industry practice**: the Electron docs recommend utility processes for CPU-heavy or crash-prone work; VS Code is a known user of separate helper processes (secondhand; verify before citing).
- **References**: [Utility process](https://www.electronjs.org/docs/latest/api/utility-process), [Process model](https://www.electronjs.org/docs/latest/tutorial/process-model).

## Open items (unverified)

- **O1 (resolved 2026-11-17, run 2026-11-27)**: yes. electron-builder 26.15.7 has an `electronFuses` option (`app-builder-lib/scheme.json`, `out/platformPackager.js` calls `flipFuses` from `@electron/fuses`). Run on a real Mac package: the build log shows `executing @electron/fuses`. `@electron/fuses` 1.8.0 was added as a direct devDependency (owner approved 2026-11-27) only for `check-fuses.mjs` to read the result; its read function is `getCurrentFuseWire`.
- **O2 (Mac resolved 2026-11-27; Windows open, see O10)**: electron-builder computes the ASAR header hash (`integrity.computeData`) and writes `ElectronAsarIntegrity` into the Mac plist (`electronMac.js`). Seen on a real arm64 package: `Info.plist` has `ElectronAsarIntegrity` with `Resources/app.asar`, algorithm SHA256; `codesign --verify --deep --strict` still passes with the ad hoc signature.
- **O3 (resolved 2026-11-18)**: `electron.vite.config.ts` replaces the `<!--CSP-->` marker in `src/renderer/index.html`. A fresh `pnpm build` on 2026-11-18 produced `out/renderer/index.html` with the `Content-Security-Policy` meta tag (task T001).
- **O4**: does the Vite-built output (module scripts, fonts, Radix assets) load under a custom protocol? Needs a spike before PR C.
- **O5**: can `grantFileProtocolExtraPrivileges` be disabled while still on `file://`? Module scripts over `file://` may need it. Run the packaged app with it off.
- **O6 (automated half answered 2026-11-27)**: with the permission and navigation changes (PR #61) and the fuses, `tests/integration/print.test.ts` passes and the packaged PDF e2e (receipt, A5, A4 through the offscreen window) passes. Still open: a manual print through the OS dialog in `pnpm dev` and on the shop's printer, which waits for 001 T057 and T058.
- **O7**: does moving to a custom protocol change the storage origin and lose saved settings (theme)?
- **O8 (answered 2026-11-27, decision D2)**: Mac, per NFR-013. FR-009 keeps a minimal Mac menu.
- **O9**: Apple developer account cost and whether notarization is needed for a build installed by hand on the owner's own Mac.
- **O10 (open, needs a Windows machine)**: Windows-specific fuse and integrity behaviour (integrity needs Electron 30 or later on Windows; we use 43, so expected to work, not tested). To close: on Windows run `pnpm --filter @shopos/desktop package`, `check:fuses`, `smoke:release`, then the O14 tamper test on a copy of `win-unpacked`.
- **O11 (answered 2026-11-17, scratch Electron 43.8.10 on macOS, `file:` page)**: `senderFrame.origin` is `file://`, `senderFrame.url` is the full file URL, `senderFrame === webContents.mainFrame` is true for the main frame. A child iframe in a sandboxed window got no preload, so it could not call the bridge. Not yet checked: a custom protocol (PR C). Original question:  what Electron's `senderFrame.origin` and `senderFrame.url` return for the app's `file:` page and for a custom protocol, and whether the main-frame test (`senderFrame === webContents.mainFrame`) works as intended. Test before relying on it.
- **O12 (answered 2026-11-27, decision D3)**: accepted exception. Linux is not a shop platform; the AppImage keeps the fuses but has no ASAR integrity. Written down in `docs/operations/release-checklist.md`.
- **O13 (answered 2026-11-27, decision D4)**: deferred, recorded as a known gap. The migrations stay in `extraResources`, outside the integrity check; someone who can write to the install folder can change them, as they can replace the whole unsigned app (US5). Written down in `docs/operations/release-checklist.md`.
- **O14 (Mac answered 2026-11-27)**: both refuse to start, on copies of the packaged arm64 app. One character changed in the header (`index.html` renamed): `FATAL ... Integrity check failed for asar archive entry '<header>'`, exit code 133. One byte changed inside `out/main/index.js` with the header intact: `ASAR Integrity Violation: got a hash mismatch`, exit code 1. That file is read at launch; a packed file read only later (for example a renderer asset) was not tested and per the ASAR page fails when it is read. Windows: see O10.
- **O15 (answered 2026-11-27)**: the fuses do not block it. The hardened Mac build started with `--remote-debugging-port=47913` listened on that port and listed the Shop OS page for any local program to attach to; `--inspect` was refused as intended. Fixed: a packaged release started with `--remote-debugging-port` or `--remote-debugging-pipe` logs the switch and exits with code 1 before the database opens (`src/main/app/debugSwitchPolicy`, fixed at build time). `pnpm smoke:release` checks it. Consequence: Playwright, which always passes `--inspect=0 --remote-debugging-port=0`, cannot drive the release build, so packaged e2e runs on the `package:e2e` flavour (decision E1 below).

## Decisions recorded 2026-11-27 (task T002)

| ID | Answer | Source |
|---|---|---|
| D1 | Reuse `INTERNAL`, message "Command refused" (built in PR #43) | plan default |
| D2 | Mac is the main platform; keep a minimal Edit menu | owner, 2026-11-27 |
| D3 | Linux AppImage accepted without ASAR integrity | owner, 2026-11-27 |
| D4 | Migrations stay outside the archive; known gap | owner, 2026-11-27 |
| E1 | Two package flavours: `package` (release, all fuses, DevTools port refused) and `package:e2e` (Playwright: `--inspect` and the port allowed, ASAR checks still on, own name `Shop OS E2E`, app id and `release-e2e/` folder). The release build gets `check:fuses` and `smoke:release` instead of Playwright | owner, 2026-11-27 |

E1 trade-off: one extra packaging run (about 3.5 minutes on the M-series Mac) for every packaged e2e run, and Playwright never drives the exact binary that ships. Rejected: keeping `--inspect` on (one build, but a debugger can attach to the counter's app) and dropping packaged Playwright altogether (save and print on the packaged app checked only by hand).

## Performance baseline and SC-008 (tasks T003, T017, T028)

Measured 2026-11-27 on `main` at `fcdb8fd` (after PR #43 and #61; the earlier commit was not rebuilt, so the baseline includes the sender check and the permission and navigation policies, whose cost is one URL parse per command). Mac arm64, packaged, warm runs.

| Measure | Before fuses and menu | After (e2e flavour, fuses + menu) |
|---|---|---|
| `billing.spec.ts` (save, stock, draft recovery) | 4.2, 4.3, 4.8 s | 4.2, 4.3, 4.3 s (cold first run 5.0 s) |
| `pdf.spec.ts` (receipt, A5, A4 through the print window) | 1.4, 1.4, 1.4 s | 1.4, 1.5, 1.4, 1.4 s |
| `searchPerf.test.ts` (test time, dev binary) | 57 to 65 ms | 56 to 64 ms |
| Launch to the Items button | 533 to 629 ms | 523 to 571 ms |

No measure is more than 5% slower: SC-008 holds for PR B. The release build itself cannot be timed with Playwright (O15); it differs from the e2e flavour only in the inspect fuse and the start-up switch check.

## Not adopted

- `<webview>`, remote content, `nodeIntegrationInWorker`: not used by this app, so nothing to harden.
- Worker threads with `better-sqlite3`: the docs say native modules in workers can crash and corrupt memory.
