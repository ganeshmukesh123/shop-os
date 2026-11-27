# Release checklist

What to run before an installer goes to the counter. It starts with the packaging checks from
spec 018 (Electron hardening). Feature 012 (go-live) will add CI, the offline kit and rollback.

```
pnpm package ----> release/       Shop OS        what the counter installs
     |                |
     |                +--> check:fuses     5 fuses as the contract says
     |                +--> smoke:release   starts, migrates, refuses debuggers
     |
pnpm package:e2e -> release-e2e/  Shop OS E2E    never shipped
                      +--> test:e2e:packaged   Playwright scenarios
```

## Every release

Run in `apps/desktop` (or with `pnpm --filter @shopos/desktop`), on each platform you ship:

| Step | Command                                                     | Passes when                                                                                   |
| ---- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1    | `pnpm test`, `pnpm typecheck`, `pnpm lint` (repo root)      | all green                                                                                     |
| 2    | `pnpm package`                                              | `release/` holds the installer; the log shows `executing @electron/fuses`                     |
| 3    | `pnpm check:fuses`                                          | "Fuse check passed ... 5 fuses as expected"                                                   |
| 4    | `pnpm smoke:release`                                        | three PASS lines: migrates, refuses `--remote-debugging-port`, ignores `ELECTRON_RUN_AS_NODE` |
| 5    | `pnpm package:e2e`, then `pnpm test:e2e:packaged`           | every Playwright scenario passes                                                              |
| 6    | Mac only: `pnpm test:e2e:packaged --offline`                | passes with the network denied                                                                |
| 7    | Install from `release/` and save and print one bill by hand | bill prints; reprint matches                                                                  |

Never copy anything from `release-e2e/` to a counter. It accepts a debugger by design.

Example of step 3 failing, if someone drops a line from `electron-builder.yml`:

```
Fuse check FAILED for release/mac-arm64/Shop OS.app/...:
  RunAsNode: expected off, found on
```

## After every Electron upgrade (spec 018 FR-014)

1. `pnpm install`. `ensure-electron-sqlite.mjs` fetches the `better-sqlite3` binary for the new
   Electron ABI. Never run `pnpm rebuild better-sqlite3` (it builds for plain Node).
2. `pnpm test` (Vitest runs inside Electron's Node, so a wrong binary fails here).
3. `pnpm test:e2e`.
4. The whole "Every release" table above, including `check:fuses`: a new Electron can add fuses
   or change their positions.

## Accepted gaps (decisions D3 and D4, 2026-11-27)

The hardening does not make the install tamper-proof. Known, accepted for now:

| Gap                                                                            | Why accepted                                                                     | Closes when                            |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | -------------------------------------- |
| Linux AppImage has no ASAR integrity check (D3, O12)                           | Linux is not a shop platform (NFR-013)                                           | a shop needs Linux                     |
| `drizzle` migrations sit outside `app.asar` (D4, O13) and are not hash-checked | someone who can write to the install folder can already replace the unsigned app | signing (spec 018 US5)                 |
| unpacked `better-sqlite3` is outside the archive                               | native modules must be unpacked                                                  | signing (US5)                          |
| the app is unsigned (ad hoc on Mac)                                            | no auto-update or stored secret yet                                              | spec 010 or 012 adds one (T037)        |
| Windows fuse and integrity behaviour not yet seen on a real build (O10)        | first use is Mac                                                                 | someone runs this checklist on Windows |
