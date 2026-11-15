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
- **Trade-off**: `015` must add a named exception for the camera scanner. Cost is one small function.
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
- **Why**: a small startup gain.
- **Trade-off**: on Mac a null menu removes Cmd+C and Cmd+V, and first use is on Mac; hence minimal Edit menu or skip.
- **References**: [Performance](https://www.electronjs.org/docs/latest/tutorial/performance).

### R9. Utility process (US7, deferred)
- **Why**: a synchronous query on the main process freezes every window.
- **Trade-off**: crosses a process boundary, so `better-sqlite3` must be loaded there too (separate connection, WAL); extra code for no gain at MVP data sizes.
- **Industry practice**: the Electron docs recommend utility processes for CPU-heavy or crash-prone work; VS Code is a known user of separate helper processes (secondhand; verify before citing).
- **References**: [Utility process](https://www.electronjs.org/docs/latest/api/utility-process), [Process model](https://www.electronjs.org/docs/latest/tutorial/process-model).

## Open items (unverified)

- **O1**: does electron-builder 26.15 have a built-in option for flipping fuses? The Electron fuses page does not cover electron-builder. If not, `@electron/fuses` is a new package: ask the owner first.
- **O2**: does electron-builder wire ASAR integrity header hashing, or must the fuse step do it? The ASAR page names only Packager and Forge (minimum versions) and the manual method.
- **O3**: the docs say a CSP header cannot apply to `file://`. Confirm `index.html` carries the CSP `<meta>` tag for packaged builds until PR C.
- **O4**: does the Vite-built output (module scripts, fonts, Radix assets) load under a custom protocol? Needs a spike before PR C.
- **O5**: can `grantFileProtocolExtraPrivileges` be disabled while still on `file://`? Module scripts over `file://` may need it. Run the packaged app with it off.
- **O6**: does the offscreen print window (`data:` URL) still work after the permission and navigation changes?
- **O7**: does moving to a custom protocol change the storage origin and lose saved settings (theme)?
- **O8**: which of Windows or Mac is the shop's main platform? Decides FR-009.
- **O9**: Apple developer account cost and whether notarization is needed for a build installed by hand on the owner's own Mac.
- **O10**: Windows-specific fuse and integrity behaviour (integrity needs Electron 30 or later on Windows; we use 43, so expected to work, not tested).
- **O11**: what Electron's `senderFrame.origin` and `senderFrame.url` return for the app's `file:` page and for a custom protocol, and whether the main-frame test (`senderFrame === webContents.mainFrame`) works as intended. Test before relying on it.
- **O12**: `electron-builder.yml` also builds a Linux AppImage, and ASAR integrity does not apply there. Decide whether Linux is an accepted exception or needs a separate protection (the shop's first use is Mac, NFR-013).
- **O13**: the `drizzle` migrations are in `extraResources`, outside `app.asar`, and run against the shop database at start. Decide whether to bundle them inside the archive or protect them separately.
- **O14**: the ASAR page says the app checks the hash of the archive **header** at launch. Does a changed file with an intact header fail at launch, or only when that file is read? Test by modifying one packed file and launching.
- **O15**: the `nodeCliInspect` fuse covers Node's `--inspect` arguments, not Chromium's remote-debugging switch. Check whether and how to block the latter before claiming no debugger can attach.

## Not adopted

- `<webview>`, remote content, `nodeIntegrationInWorker`: not used by this app, so nothing to harden.
- Worker threads with `better-sqlite3`: the docs say native modules in workers can crash and corrupt memory.
