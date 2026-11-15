---
name: shopos-electron-hardening
description: "Use when hardening or reviewing Electron security and performance in Shop OS: IPC sender checks, permission handling, navigation limits, fuses, ASAR integrity, custom protocol instead of file://, code signing, safeStorage, the application menu, and moving long work off the main process. Based on the official Electron security and performance guidance; feature spec 018."
---

# Electron hardening (security and performance)

Authority: constitution (Electron security), `specs/018-electron-hardening/spec.md` and `research.md` (why, trade-off, practice, references, open items). Basics (isolation, sandbox, typed bridge, handler shape) stay in `shopos-electron-ipc`; this skill adds the checklist beyond them. Sources: [Security](https://www.electronjs.org/docs/latest/tutorial/security), [Performance](https://www.electronjs.org/docs/latest/tutorial/performance).

```
Renderer (sandboxed) --invoke--> ipcMain.handle --> service --> SQLite
                          ^             ^
        file:// -> custom protocol    null frame = refuse; then check page location
Window: will-navigate (exact URL) | permissions (deny) | window.open (deny)
Package: fuses + ASAR integrity  (packaged output only, never the dev binary)
```

## 1. Rules (main process)

- **Sender check.** Every IPC handler first checks `event.senderFrame`. Accept only the app's **main frame** (not a same-origin child frame) whose address is the app's own page. Do **not** compare serialized origins: for `file:` and unregistered custom schemes the origin is the text `"null"`, so a foreign page looks the same as ours. Compare the parsed scheme plus location instead (exact file location for `file:`; scheme, host **and the app's entry path** for the custom protocol, so another page on the same host is refused). A null frame, child frame or foreign page returns the normal error envelope and calls no service. Wrap once, not per handler. What Electron returns for `senderFrame.origin` on `file:` is unverified (research O11); test it.
- **Permissions.** `session.setPermissionRequestHandler` and `setPermissionCheckHandler` deny everything. A feature that needs one (camera for a scanner, spec 015) adds a named, tested exception.
- **Navigation.** In `will-navigate`, parse with `new URL()` and compare exactly with the app page (plus the dev server, only when `isDev`). Never `startsWith`: `https://allowed.com.evil.com` passes it. Unparsable means blocked. Run the **same check on `will-redirect`** too, because a redirect from an allowed dev-server URL to a foreign one is a separate event; test it.
- **New windows and links.** Keep `setWindowOpenHandler` returning `{ action: "deny" }`. Never pass renderer-supplied text to `shell.openExternal`; allow only fixed or verified URLs.
- **Never relax**: `webSecurity`, `allowRunningInsecureContent`, `experimentalFeatures`, `enableBlinkFeatures`, `<webview>`, `nodeIntegration`, `--no-sandbox` (a test fails if any is relaxed).
- **Bridge.** Never expose `ipcRenderer` or its `on` directly; wrap callbacks as `(_event, value) => callback(value)`. One narrow function per command.

## 2. Packaging

- Fuses: disable `runAsNode`, `NODE_OPTIONS`, `nodeCliInspect`; enable ASAR integrity and `onlyLoadAppFromAsar`. Disable `grantFileProtocolExtraPrivileges` only once `file://` is gone.
- **Know what is and is not protected.** Fuses stop abuse through Electron and Node flags. ASAR integrity detects changes to `app.asar` on **macOS and Windows only**; the Linux AppImage is an exception until a separate protection is chosen. Files outside the archive (`extraResources` such as the `drizzle` migrations, the unpacked `better-sqlite3`) are **not** covered. While the app is unsigned, someone who can write to the install folder can still replace it; signature verification is what closes that (spec 018 US5).
- **Flip fuses on packaged output only.** Vitest runs inside Electron's Node (`ELECTRON_RUN_AS_NODE=1`); flipping the `node_modules` binary breaks `pnpm test`.
- A release check reads the fuse state (`npx @electron/fuses read --app <path>`) and fails if it differs.
- `better-sqlite3` stays unpacked outside the archive and is rebuilt for Electron after every Electron upgrade (see `shopos-database-drizzle`).
- Adding `@electron/fuses` (or any package) needs owner approval first; check whether electron-builder has a built-in option (open item O1).
- Signing and notarization: only when auto-update or a stored secret arrives. Use the **async** `safeStorage` API (the sync one goes in Electron 46).

## 3. Loading the screen

Prefer a custom protocol with `protocol.handle` over `file://`: resolve the path, reject anything that escapes the bundle root (`..` or absolute), serve only bundled files. The CSP goes in a response header there; on `file://` it must be a `<meta>` tag. Needs a spike first (open items O4, O5, O7).

## 4. Performance

- Never block the main process: no sync IPC (`sendSync`), no long synchronous query; heavy work (big reports, imports, backups) goes to a utility process. Never load `better-sqlite3` in a Web Worker.
- Defer expensive `require`s and startup work; show the window before slow checks where safe. Bundle everything (already done by Vite); ship fonts and icons locally.
- `Menu.setApplicationMenu(null)` only where shortcuts survive. On Mac a null menu removes Cmd+C and Cmd+V, so keep a minimal Edit menu.
- Measure first (DevTools, `--cpu-prof`); do not optimize on guesses. Check bill save stays about 1 s (NFR-002).

## 5. Example

Table-driven navigation test (names say what they hold):

| Address | Expected |
|---|---|
| the app's own page | allowed |
| `file:///etc/hosts` | blocked |
| dev-server host + `.evil.com`, in dev | blocked |
| `not a url` | blocked |

## 6. Checklist

- [ ] Sender check on every command; main frame only; null frame refused; tests for wrong page, missing frame and same-origin child frame
- [ ] Redirects checked as well as navigation
- [ ] Permissions denied by default (request and check)
- [ ] Navigation by parsed URL, exact match
- [ ] No new Electron or Node access in the renderer; no raw `ipcRenderer`
- [ ] Fuses and ASAR integrity on packaged output only; fuse report checked
- [ ] No sync IPC or long main-process work; no database module in workers
- [ ] Every recommendation in a PR carries why, trade-off, industry practice and references
