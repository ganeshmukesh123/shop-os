# Research: GitHub Workflow (CI and merge protection)

Findings from the spike run on 2026-11-14 and decisions for the plan. Claims marked **unverified** have not been run and must be checked when the task that depends on them is done.

## Spike results (2026-11-14)

### S1. Coverage works inside Electron's Node: VERIFIED
`@vitest/coverage-v8@2.1.9` (matches vitest 2.1.9) was installed in `packages/core` and `apps/desktop`. Running `node scripts/vitest-electron.mjs run --coverage ...` (tests run in Electron's Node via `ELECTRON_RUN_AS_NODE`, sharing the app's SQLite binary) printed a full coverage table. So tests, app and coverage can all use the same Electron SQLite binary, and CI can reuse `pnpm test`.

### S2. Baseline coverage (statements = lines; V8 provider; all files under `src/` included)

| Area | Statements/lines | Branches | Functions | Notes |
|---|---|---|---|---|
| `packages/core` | 67.22% | 86.88% | 87.87% | `types.ts` (Zod schemas), `commands.ts`, `index.ts` are 0% in core's own tests; they are exercised only through desktop tests, which do not count for core |
| desktop `main/db` | 96.26% | 84.61% | 80% | `seed.ts` partly uncovered |
| desktop `main/repositories` | 95.09% | 91.93% | 93.75% | small gaps in Bill, Stock, Item repositories |
| desktop `main/services` | 90.63% | 91.87% | 94.59% | `electronRenderer.ts` is 0% |
| desktop `main/ipc` | 72.64% | 89.47% | 71.42% | `ipc/index.ts` 0%, `handlers.ts` 81% |
| desktop `main/index.ts`, `preload/index.ts` | 0% | 0% | 0% | Electron entry and bridge: no unit tests |
| desktop `renderer` (App, screens, components, state, strings, main) | 0% | 0% | 0% | about 1,700 lines, no component tests yet |
| **Desktop total** | **38.17%** | **86.66%** | **78.35%** | |

Reading: the logic that handles money and stock is already close to the target; the distance to 90% is the **renderer**, the Electron entry files and a few gaps. Branch numbers look healthy only because the renderer's branches are not counted when no test imports the file (V8 reports 0 statements for it); they will move when renderer tests exist.

### S3. Count of the work to reach 90%
Not measured by file-line arithmetic yet. After the renderer files are imported by tests, the baseline must be re-measured (Step 2 of the sequence) because branch and function totals will change.

## Decisions

### D1. Reuse existing commands
CI runs `pnpm test` (Electron's Node, via `scripts/vitest-electron.mjs`), `pnpm build` and `pnpm test:e2e`, so developers and CI run the same thing. No separate CI-only test invocation.

### D2. Coverage configuration in one place
A single module `config/coverage.ts` exports `COVERAGE_THRESHOLD_PERCENT = 90` and `COVERAGE_EXCLUDED_PATHS`. Both vitest configs import it. The exclusion list starts with only: generated files, `*.d.ts`, test folders. Nothing else without a written reason in a PR (FR-011, FR-012).

### D3. Report-only first, then the gate
Thresholds are applied only when `COVERAGE_ENFORCE=true`. The workflow sets it from a single committed value (`config/coverage.ts` exports `COVERAGE_ENFORCE`, default `false`). The gate is switched on by a PR that sets it to `true`, once `main` measures at least 90% on every metric (FR-010a).

### D4. Per package and total
Thresholds apply to `packages/core` and `apps/desktop` separately (each package must reach 90% by itself) and the CI summary also shows the combined figure. Each package's own tests must cover its own code (core's schemas get core tests rather than relying on desktop tests).

### D5. Entry files are counted, and made testable
Electron entry (`main/index.ts`), preload and `electronRenderer.ts` are counted. To test them, move logic into small functions that take Electron objects as arguments (for example `createMainWindow(electronApi)`), leaving a thin untested-by-design line or two if any is justified in writing. End-to-end runs do not contribute coverage.

### D6. Renderer tests use Testing Library with jsdom
Component and hook tests run in the same Vitest, under `jsdom`, with `window.shopos` replaced by a typed fake. User-event drives interactions. They live in `apps/desktop/tests/renderer/**`. Large screens are split first (React skill plan) so tests stay small.

### D7. Order of workflow steps
Quick checks (format, lint, types, migrations in sync, PR title and size) run first and fail fast; tests with coverage next; build; end-to-end last (slowest). Heavy steps depend on quick checks passing.

### D8. Workflow hygiene (from the spec)
Least-privilege `permissions: contents: read`, `pull_request` (never `pull_request_target`), pinned action versions, concurrency group to cancel superseded runs, job timeouts, Node from `.nvmrc`, pnpm from `package.json` `packageManager`, `--frozen-lockfile`, caches for the pnpm store and the Electron download.

### D9. Required checks and protection (no reviewer)
Branch protection on `main`: require the named checks, require the branch to be up to date, squash merge only, no force push or delete, include administrators, **zero required approving reviews** (solo project, owner decision). Configured in the repository settings (or by an infrastructure script); documented in `docs/contributing/ci.md`.

### D10. Retries
Unit and integration tests: no retries. End-to-end: Playwright `retries: 1` on CI only, and any retried test is reported as a flake with its trace.

## Implementation findings (2026-11-14, from building T004 to T014 locally)

### F1. Pinned actions (resolves O2): VERIFIED
Latest releases were read from the GitHub API and each tag was resolved to its commit SHA with `git ls-remote`. A script (not committed) then re-checked every SHA in `.github/**` against GitHub: all 7 match. They are newer than commonly remembered, which is why they were looked up.

| Action | Release | Published | Commit SHA |
|---|---|---|---|
| actions/checkout | v7.0.1 | 2026-07-20 | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| pnpm/action-setup | v6.1.1 | 2026-11-03 | `73e46992e05b19abd31f2f3c20e0e7370d762115` |
| actions/setup-node | v7.1.0 | 2026-10-08 | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| actions/cache | v6.1.0 | 2026-06-26 | `55cc8345863c7cc4c66a329aec7e433d2d1c52a9` |
| actions/upload-artifact | v7.0.2 | 2026-10-07 | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` |
| actions/download-artifact | v8.0.2 | 2026-10-07 | `9000827ccba6bdab643e8b6fd33ac0654aef8333` |
| trufflesecurity/trufflehog | v3.99.9 | 2026-11-12 | `3bd2b5887eb0efb8fa18bfd1d296032924e4ffdc` |

Notes: `pnpm/action-setup` v6.1.1 was published 11 days before this was written (newest release); it reads `packageManager` from `package.json` and can cache the store itself. gitleaks-action (v3.0.0) was not used: its README says a licence key is required for organisation accounts. TruffleHog's action reads the commit range from the event; its `version` input is a Docker image tag and the value `3.99.9` is **unverified** until the first run.

### F2. Coverage in a recursive run: VERIFIED
`pnpm -r test:coverage` skips `apps/desktop` when `packages/core` fails, because desktop depends on core (pnpm skips dependents of a failed package, even with `--no-bail`). `pnpm -r --no-bail --no-sort` runs both independently, so both packages always report. Report-only exits 0; with the gate on both fail with "does not meet global threshold (90%)".

### F3. Playwright JSON report shape: VERIFIED
Generated from a throwaway probe (pass, pass-on-retry, always-fail): a test passing only on retry has `status: "flaky"` and `results: [failed (retry 0), passed (retry 1)]`. `scripts/ci/flaky-summary.mjs` reads exactly this shape.

### F4. Dependency audit (answers O4): MEASURED
`pnpm audit --audit-level high` reports **81 vulnerabilities (4 critical, 27 high, 40 moderate, 10 low)**; production dependencies alone: **2 high**. The installed Electron is **33.4.11** (declared `^33.0.0`) with 12 high advisories; the advisory text names a fix at 42.11.16 or later, so the fix is a major upgrade. Others: `tar`, `vitest`, `tinypool` (critical, tooling), `drizzle-orm`, `zod`, `vite`, `extract-zip`, `app-builder-lib`, `builder-util-runtime` (high). Consequence: the audit job is informational (`continue-on-error`) and must not become a required check until these are dealt with. The Electron and dependency upgrades are a separate piece of work, not part of spec 017.

### F4b. Migration check: VERIFIED
`scripts/ci/check-migrations.sh` fingerprints `apps/desktop/drizzle`, runs the generator, and fails if the fingerprint changed. Passes on the real tree; fails (exit 1) when the generator adds a file (tested through `MIGRATION_GENERATE_COMMAND`, without touching the real schema).

### F5. Behaviour when the real tree is measured
With the gate off, `pnpm test:coverage` exits 0 (core 67.2% lines, desktop 38.2%). `pnpm pr:size` in CI mode on the current working tree (about 5,700 uncommitted lines) fails as designed.

### F6. Electron upgrade 33.4.11 to 43.8.10 (2026-11-14; asked for as "F5", renumbered because F5 already exists)

**Result: DONE and verified locally (macOS arm64).** `pnpm audit` Electron advisories: 46 before (12 high, 25 moderate, 9 low), **0 after**. Overall audit: 4 critical / 27 high / 40 moderate / 10 low before; 4 critical / 13 high / 15 moderate / 1 low after (part of the drop is the old `prebuild-install` dependency tree leaving with better-sqlite3 13).

```
 Before                         After
 Electron 33.4.11 (ABI 130)     Electron 43.8.10 (ABI 148, Node 24.22.1, Node-API 10)
 better-sqlite3 12.11.1         better-sqlite3 13.1.1
   one binary per Electron        Node-API build: ONE binary per platform,
   version, fetched by              shipped inside the npm package,
   prebuild-install                 works in Node, Electron and the packaged app
```

**Why 43.8.10.** Electron's policy is that the latest three stable majors are supported (source: electronjs.org/docs/latest/tutorial/electron-timelines); npm `latest` is 45.3.2, so 45, 44 and 43 are supported. For each of the 46 advisories the first patched version per major line was read from the GitHub advisory API (`api.github.com/advisories/<id>`). A line with no entry for an advisory is not affected by it. Minimum stable that clears all 46: **43.8.1** on 43.x, **44.9.1** on 44.x, any stable 45.x on 45.x (every 45 patch is in a pre-release). The lowest supported line is 43, and 43.8.10 is its latest patch, so that is the chosen version (example advisory: GHSA-jr5w-w6x2-84p9, eMudhra certificates, patched 42.11.16 / 43.8.1 / 44.9.1 / 45.0.0-beta.6). **Risk:** Electron 43 leaves support once Electron 46 reaches stable (release dates not read from a source; the timelines page gave the policy but no dates). Because better-sqlite3 13 no longer depends on the Electron ABI, moving to 44 or 45 later is only an `electron` version change; it has not been tried.

**Compatibility checks (with sources)**

| Check | Finding | Source |
|---|---|---|
| ABI numbers | Electron 33 = 130, 43 = 148, 44 = 149, 45 = 150 | `abi_registry.json` in github.com/electron/node-abi |
| better-sqlite3 12.x prebuilds for Electron 43 | 12.11.1 stops at ABI 146 (**no** 148). 12.11.2 has 148 but **no Linux** binary. 12.12.0 has 148 incl. linux-x64, but **12.11.2 and 12.12.0 are not published to npm** (npm 12.x ends at 12.11.1); `pnpm install` failed with "No matching version found for better-sqlite3@^12.12.0" | GitHub releases API for WiseLibs/better-sqlite3; `npm view better-sqlite3 versions` |
| better-sqlite3 13.x | Built as Node-API (`NAPI_VERSION=10` in `binding.gyp`), prebuilds for darwin/linux/win32 and arm64/x64 shipped **inside the npm package** (`prebuilds/<platform>-<arch>.node`), `prebuild-install` dropped, `engines.node >=22`; release notes list no JavaScript API break, only additions (`db.explain()`, `statement.toString()`) | tarball of better-sqlite3@13.1.1 (`npm pack`); github.com/WiseLibs/better-sqlite3/releases/tag/v13.0.0 |
| Electron 43 runtime check | In Electron's Node: Node 24.22.1, napi 10, modules 148; better-sqlite3 13.1.1 opens a database, SQLite 3.54.1 | run locally |
| electron-builder 25.1.8 | Declares no peer dependency on Electron; works with 43.8.10 for the native-module step and the app skeleton. Latest is 26.18.0 (not needed) | `npm view`; packaging run below |
| electron-vite 2.3.0 | No Electron peer dependency; builds main, preload and renderer with Electron 43 | `npm view`; build run below |
| @playwright/test 1.65.0 | Drives the built app on Electron 43: 3 of 3 end-to-end scenarios pass | e2e run below |

**Breaking changes 34 to 43 against what the app uses** (source: electronjs.org/docs/latest/breaking-changes, first 100,000 characters, covering 45 down to 34; I did not read the part for 33 and earlier). The app uses: `BrowserWindow` + `webPreferences`, `will-navigate`, `setWindowOpenHandler`, `dialog.showOpenDialog` / `showSaveDialog` / `showErrorBox`, `app.getPath` / `setPath` / `relaunch` / `exit` / `quit` / `isPackaged`, `before-quit`, `webContents.print` / `printToPDF`, `ipcMain.handle`, `ipcRenderer.invoke`, `contextBridge`. **No removed or changed behaviour for any of these.** Relevant notes: (43) `dialog` without `defaultPath` now opens in the user's Downloads folder (our save dialog passes `defaultPath`; the open dialogs do not, so they will start in Downloads, which is acceptable); (39) `window.open` popups become resizable (we deny all window opens); (38) macOS 12 or later is required to run Electron 38+. No source change to `apps/desktop/src` was needed. Security defaults are unchanged: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false` in `main/index.ts` and `main/services/electronRenderer.ts`.

**Changes made (6 lines of `apps/desktop/package.json` plus the lockfile, which is excluded from the PR size)**
- `electron`: `^33.0.0` to `^43.8.10`
- `better-sqlite3`: `^12.0.0` to `^13.1.1`
- `@shopos/core` moved from `dependencies` to `devDependencies`. This is not caused by the upgrade: the packaging dry run failed with "`packages/core/coverage/base.css` must be under `apps/desktop/`" because electron-builder tried to ship the whole workspace package as a runtime dependency. The built app bundles core (the main bundle requires only `electron`, `better-sqlite3` and Node built-ins), so it is not needed at runtime. (Other bundled libraries, for example react, radix, drizzle-orm, zod and uuid, are also listed as runtime dependencies and are shipped redundantly; not changed here.)

**Verification (all on macOS arm64, 2026-11-14)**

| Check | Result |
|---|---|
| `pnpm lint` | 0 errors, 92 warnings (same as before) |
| `pnpm -r typecheck` | clean |
| `pnpm -r test` | core 34/34, desktop 65/65 (run inside Electron 43's Node) |
| `pnpm test:coverage` | exit 0; baseline unchanged (core 67.22% lines, desktop 38.17%) |
| `pnpm test:scripts` | 36/36 |
| `pnpm --filter @shopos/desktop build` | succeeds |
| `pnpm test:e2e` | 3/3: billing (totals, negative stock, draft recovery, exactly-once save), inventory, PDF export |
| `electron-builder --dir` | succeeds; `Shop OS.app` (343 MB, unsigned as configured); from inside the packaged app, better-sqlite3 loads from `app.asar.unpacked` (Electron 43.8.10, Node 24.22.1, napi 10, SQLite 3.54.1) |
| `pnpm audit` | Electron advisories 46 to 0 (see above) |

**Packaging detour worth knowing.** The first dry runs hung for 13 minutes in electron-builder's `unpack-electron` step. Cause found: a **corrupt cached zip** `~/Library/Caches/electron/electron-v43.8.10-darwin-arm64.zip` (555 MB, `unzip -t`: "bad zipfile offset"; the valid file is 123,480,564 bytes). It most likely came from overlapping and killed runs during this work. Deleting it and re-running downloaded a valid zip and unpacking worked. If CI ever hangs there, clear the Electron cache.

**Not verified**
- Windows and Linux builds, and the macOS x64 build (only arm64 macOS was run). The Node-API prebuilds exist for those platforms (listed in the tarball) but were not executed.
- Real printer behaviour on Electron 43 (receipt width, driver): `webContents.print` and `printToPDF` run (PDF export passes end to end) but no physical printer was tested; spike T008 is still open.
- Packaging with code signing, `.dmg`, NSIS and AppImage targets: only `--dir` was run.
- The remaining audit findings: high or critical advisories in `tar`, `vitest` (3.2.6 or later is advised; we use 2.1.9), `tinypool`, `vite`, `drizzle-orm` (0.45.2 or later is advised; we use 0.36), `zod` (4.6.6 or later is advised; we use 3.x), `app-builder-lib` and `builder-util-runtime` (electron-builder 26 line). Of these, `drizzle-orm` and `zod` are runtime libraries bundled into the app and deserve their own review; the rest are build or test tooling. None of them was changed here.
- `apps/desktop/scripts/ensure-electron-sqlite.mjs` still works (it passes its probe) but its `prebuild-install` fallback is now unnecessary with better-sqlite3 13; it could be simplified later.

**Rollback.** Restore `apps/desktop/package.json` and `pnpm-lock.yaml` from git (the files were uncommitted at the time, so copies of the pre-upgrade `package.json`, `pnpm-lock.yaml` and the two workspace `package.json` files were saved in the session scratchpad `electron-backup/`), run `pnpm install`, then `node apps/desktop/scripts/ensure-electron-sqlite.mjs`. The code under `apps/desktop/src` is unchanged, so no code rollback is needed.

### F7. zod 3 to 4 and drizzle-orm 0.36 to 0.45 upgrade (2026-11-14): VERIFIED locally

Owner decision: upgrade both runtime libraries now to clear their audit advisories. Done as two separate groups, each verified in full before the next. Nothing committed.

**Advisories (from `pnpm audit --json`, 2026-11-14)**

| Library | Advisory | Vulnerable | Patched | Title |
|---|---|---|---|---|
| zod | GHSA-mrhx-c7xc-m3w5 | below 4.6.6 | 4.6.6 or later | Can exhaust memory while validating oversized constrained collections |
| drizzle-orm | GHSA-gpj5-g38j-94v9 | below 0.45.2 | 0.45.2 or later | SQL injection via improperly escaped SQL identifiers (`sql.identifier()`, `sql.as()`) |

Neither flaw was reachable in our code: we never call `sql.identifier()` or `sql.as()` (grep of `apps/desktop/src`, `tests`, `drizzle.config.ts`), and our zod schemas validate small, bounded IPC inputs (no oversized constrained collections from untrusted sources).

**Versions chosen**

| Package | From | To (installed) | Why |
|---|---|---|---|
| zod | ^3.23.0 | ^4.6.7 (4.6.7) | Lowest stable line that clears the advisory is 4.6.6; `npm view zod dist-tags` shows 4.6.7 as `latest`, and pnpm resolved the caret range to it |
| drizzle-orm | ^0.36.0 | ^0.45.4 (0.45.4) | Advisory fixed in 0.45.2; 0.45.4 is `latest` (the stable 0.x line; 1.0.0 is only beta and rc) |
| drizzle-kit | ^0.28.0 | ^0.31.11 (0.31.11) | The 0.31 line is the stable kit contemporaneous with drizzle-orm 0.44 and 0.45 (0.31.8 shipped the same day as 0.45.0, 0.31.11 the same day as 0.45.3, per GitHub releases); npm `latest` is 0.31.11. The release notes do not state a pairing table, so this is inferred from release dates and proven by `check:migrations` |

**Sources**: `npm view zod|drizzle-orm|drizzle-kit dist-tags`; zod migration guide https://zod.dev/v4/changelog (fetched); GitHub releases API for `drizzle-team/drizzle-orm` (every release from 0.37.0 to 0.45.4 and drizzle-kit 0.28.0 to 0.31.11 read for breaking, deprecated, removed and migration lines); drizzle-orm@0.45.x peer dependency `better-sqlite3 >=7` (we use 13.1.1).

**Breaking changes that touch our usage, and how each was handled**

| Library | Change (source) | Our usage | Result |
|---|---|---|---|
| zod 4 | `.uuid()` is stricter, follows RFC 9562/4122 (migration guide) | `clientBillId: z.string().uuid()` | No change needed: `crypto.randomUUID()` ids validate; a non-UUID is rejected (checked directly) |
| zod 4 | Method forms such as `.uuid()` are deprecated in favour of `z.uuid()` (guide) | same | Left as is (still works); candidate for a later tidy-up |
| zod 4 | `z.ZodTypeAny` "eliminated, use `z.ZodType`" (guide) | `handlers.ts` imports `ZodTypeAny` | Still compiles in 4.6.7; left unchanged |
| zod 4 | `z.unknown()` object keys are no longer optional: the key must be present (guide, v4.4.0 note) | `draftSaveInput = z.object({ payload: z.unknown() })` | **Behaviour change**: `{}` now fails (`success: false`), `{ payload: null }` and `{ payload: {...} }` pass (checked directly). The renderer always sends `payload`, so no code change |
| zod 4 | Default error messages changed (guide, "error customization") | Messages are joined into `INVALID_FIELD` text in `toFailure` | Custom messages we set ("Name is required") are unchanged; the default for a missing field is now "Invalid input: expected string, received undefined" instead of "Required". Only malformed input the UI never sends shows it |
| zod 4 | `ZodError.errors` removed, use `.issues` (guide) | `toFailure` uses `.issues` | No change needed |
| drizzle-orm 0.36 | Table extras: array form introduced, object form "still available but deprecated" (0.36.0 notes) | All 7 tables used the object form | Converted to the array form (126 changed lines, extras only); `check:migrations` proves no SQL changed |
| drizzle-orm 0.38 | Internal builder types changed (0.38.0 "Types breaking changes") | We do not use those types | None |
| drizzle-orm 0.41 | `sql-js` prepare behaviour; Postgres type mappers removed (0.41.0) | We use better-sqlite3 | None |
| drizzle-kit 0.30 | PostgreSQL no longer emits `IF NOT EXISTS` (0.30.0) | SQLite only | None |
| drizzle-kit 0.31.10 | `esbuild-register` replaced by the `tsx` loader | `drizzle.config.ts` | `drizzle-kit generate` works unchanged |

No change was needed to the better-sqlite3 driver import (`drizzle-orm/better-sqlite3`), the migrator import (`drizzle-orm/better-sqlite3/migrator`), `.returning()`, `.onConflictDoUpdate()`, `.transaction()`, `eq`/`and`/`asc`/`desc`/`lt`, `sql` templates, or `check()`/`index()`/`uniqueIndex()`.

**The migration question (the risk with drizzle-kit)**: after the bump, `pnpm check:migrations` (runs `drizzle-kit generate` and fails on any change) printed "Migrations are in sync with the schema." and a directory diff of `apps/desktop/drizzle` against a backup taken before the group shows it unchanged. So the new drizzle-kit did not rewrite any snapshot or emit a new migration. The immutability triggers are untouched; the tests "saved bills and lines cannot be edited or deleted" and "movements are append-only at the database level" were run by name and pass.

**Verification (macOS arm64, Electron 43.8.10, after each group)**

| Check | After zod | After drizzle |
|---|---|---|
| `pnpm lint` | 0 errors, 92 warnings | 0 errors, 91 warnings |
| `pnpm typecheck` | 0 errors | 0 errors |
| `pnpm -r test` | core 34/34, desktop 65/65 | core 34/34, desktop 65/65 |
| `pnpm test:scripts` | 36/36 | 36/36 |
| `pnpm test:coverage` | exit 0; core 67.22%, desktop 38.17% lines | exit 0; core 67.22%, desktop 37.32% lines (lower only because `schema.ts` got shorter; its removed lines were covered) |
| `pnpm check:migrations` | in sync | in sync, drizzle folder unchanged |
| `pnpm --filter @shopos/desktop build` | built | built |
| `pnpm test:e2e` | 3 of 3 | 3 of 3 |

**Audit, overall (low / moderate / high / critical)**: before both groups 1 / 15 / 13 / 4; after zod 1 / 15 / 12 / 4; after drizzle 1 / 15 / 11 / 4. Zero zod, drizzle-orm or drizzle-kit advisories remain. The remaining high and critical advisories are build and test tooling: `tar`, `vitest`, `tinypool`, `vite`, `app-builder-lib`, `builder-util-runtime`.

**Size**: zod group: 2 manifest lines (plus lockfile, excluded). drizzle group: 2 manifest lines, `schema.ts` 126 changed lines, 1 line each in `CLAUDE.md` and `shopos-database-drizzle/SKILL.md`; about 134 lines excluding the lockfile.

**Not verified**: macOS x64, Windows and Linux; a real packaged build with the new drizzle (not run; migrations are applied by `migrate()` in the same code path the integration tests exercise); the migrator against a database created by the old version (not run; migration files are unchanged so the journal is compatible, but a real old database was not opened).

**Risks**: zod 4 behaviour changes for malformed input (message text, required `unknown` keys) could surprise a future caller; drizzle 0.45 is a nine-minor jump and drizzle-kit pairing is inferred from release dates. Both are covered by the tests and the migration check above.

**Rollback**: restore `packages/core/package.json`, `apps/desktop/package.json` and `pnpm-lock.yaml` from the backups taken before each group (scratchpad `zod-backup/` and `drizzle-backup/`), restore `apps/desktop/src/main/db/schema.ts` from `drizzle-backup/schema.ts.before` and the two note lines in `CLAUDE.md` and the drizzle skill, then `pnpm install` and `node apps/desktop/scripts/ensure-electron-sqlite.mjs`. The migration files did not change, so nothing needs undoing in the database folder.

### F8. Tooling upgrade (vitest, vite, electron-vite, electron-builder) (2026-11-14)

Goal: clear the high and critical advisories left in build and test tooling so the CI "Dependency audit" job can pass. Baseline from `pnpm audit --json` on `main` (0aa3609): low 1, moderate 15, **high 11, critical 4**; `pnpm audit --prod --audit-level high` passes (no known vulnerabilities in shipped dependencies).

| Package | Severity | Advisory ids (examples) | Patched in | Comes from |
|---|---|---|---|---|
| vitest | critical | GHSA-5xrq-8626-4rwp (Vitest UI server file read/exec) | 3.2.6 | our test runner |
| tinypool | critical (2) | GHSA-5gmw-xhrv-c9v3, GHSA-85c8-ppgw-ccpr (prototype pollution to RCE) | **2.1.2** (vulnerable `<2.1.2`) | vitest 2.x and 3.x (`tinypool ^1.1.1`) |
| vite | high (1) | GHSA-587h-7wmj-h5pm (plus moderate/low launch-editor and fs.deny advisories) | 6.4.4 | vitest, electron-vite |
| tar | critical 1, high 8 | GHSA-34x7-hfp2-rc4v and others | up to 7.5.21 | electron-builder > dmg-builder > app-builder-lib |
| app-builder-lib | high | GHSA-7g7r-gx96-252g | 26.15.0 | electron-builder |
| builder-util-runtime | high | GHSA-p2f4-r6v6-j797 | 9.7.0 | electron-builder |

**Group order changed from the brief (coupling found, not assumed).** Vitest 4.1.12 declares `vite ^6 || ^7 || ^8` as a non-optional peer; desktop pins `vite` directly, so vitest resolved to desktop's vite 5.4.21 and the desktop test run failed at start-up (`ERR_PACKAGE_PATH_NOT_EXPORTED: './module-runner'`, observed). `electron-vite@2.3.0` caps vite at `^4 || ^5`. So vite and electron-vite had to move first, then vitest. Core alone ran 34/34 on vitest 4.1.12 (with vite 8) before this was understood.

#### Group 1 (done first): vite 5.4 to 6.4.6 and electron-vite 2.3.0 to 3.1.0: VERIFIED locally (macOS arm64)

Sources:
- `npm view` (2026-11-14): vite 6.4.6 is the latest 6.x (engines `^18 || ^20 || >=22`); `electron-vite@3.1.0` peers `vite ^4 || ^5 || ^6`, engines `^18 || >=20`; `electron-vite@4.0.1` and later need Node `^20.19 || >=22.12` and (v4) Vite 7; `@vitejs/plugin-react@4.7.0` peers `vite ^4.2 || ^5 || ^6 || ^7`.
- electron-vite CHANGELOG (raw.githubusercontent.com/alex8088/electron-vite/master/CHANGELOG.md): v3.0.0 only "feat: resolve conditions for preload"; v3.1.0 only a bytecode-plugin fix; **v4.0.0 breaking: Vite 7 and the CJS build removed** (not taken: the app ships a CommonJS main bundle); v5.0.0 breaking config restructuring (not taken). Electron targets listed: 3.0.0 adds Electron 32 to 34, 3.1.0 adds 35; Electron 43 has no table entry in any 3.x release, the same position as 2.3.0 had, and the build output is unchanged in shape.

Chosen: vite `^6.4.6` (clears every vite advisory, all were `<=6.4.3`), electron-vite `^3.1.0` (smallest version supporting vite 6, no breaking changes listed).

Changes: `apps/desktop/package.json`, 2 lines; no source or config changes needed (`electron.vite.config.ts` untouched).

Results: `pnpm peers check`: no issues; `pnpm --filter @shopos/desktop build`: built, main bundle still CommonJS (`"use strict"; const fs = require(...)`); `pnpm test:e2e`: 3 of 3 pass; lint 0 errors (91 warnings, unchanged); typecheck 0 errors; `pnpm -r test`: core 34/34, desktop 65/65; `pnpm test:scripts`: 36/36; `pnpm test:coverage` exit 0 (core 67.22%, desktop 37.32% lines, unchanged); `pnpm check:migrations` in sync. Audit unchanged at high 11, critical 4: the one remaining vite advisory path is `@vitest/coverage-v8 > vitest > vite` (vitest 2.1.9's own vite 5), removed by the vitest group.

#### Group 2: vitest 2.1.9 to 4.1.12 (and @vitest/coverage-v8 to 4.1.12): VERIFIED locally (macOS arm64)

Why 4.x and not 3.x: vitest 3.2.7 (latest 3.x, clears GHSA-5xrq-8626-4rwp) still depends on `tinypool ^1.1.1`, and the tinypool advisories are vulnerable `<2.1.2`, so the two critical tinypool findings would remain. Vitest 4.1.12 has no tinypool dependency (the 4.0 migration guide: "Tinypool removed; pools rewritten without new dependencies") and also clears the moderate GHSA-82fw-gwwq-j7x9 (patched 4.1.11). Vitest 5.0 needs Node 22.12 or newer and Vite 6.4 or newer; 4.1.12 was chosen as the lowest line that clears everything.

Sources: `npm view vitest@4.1.12` (dependencies, peers: `vite ^6 || ^7 || ^8` non-optional, engines `node ^20 || ^22 || >=24`), `npm view tinypool versions`, the audit JSON, and the official migration guide `https://v4.vitest.dev/guide/migration` (WebFetch 2026-11-14). Electron 43 bundles Node 24.22.1 (`ELECTRON_RUN_AS_NODE=1 electron -p process.versions.node`), which satisfies the engines range; the host Node is 25.6.1; CI uses `.nvmrc` 22.

Breaking changes read, and whether they touch us:

| 4.0 change | Touches us? |
|---|---|
| Vite 6 or newer required | **Yes**: this is why the vite group came first |
| `coverage.all` and `coverage.extensions` removed; coverage includes only loaded files unless `coverage.include` is set | No: `config/coverage.ts` already sets `include`, which keeps counting untested files |
| V8 coverage now AST-based remapping; reports may change | **Yes**: the measured numbers moved (below) |
| Default `exclude` narrowed to node_modules and .git | No: our `include` globs are explicit |
| `poolOptions`, `singleFork`, `maxThreads` removed; tinypool removed | No: not used in our configs |
| `workspace` renamed `projects`; `environmentMatchGlobs` removed | No: not used |
| Mock changes (`vi.fn`, `restoreAllMocks`, automock) | No: the repo uses no `vi.*` mocks (grep) |
| `basic` reporter removed | No |

Changes made: versions in `package.json` (root), `apps/desktop/package.json`, `packages/core/package.json`; coverage `include` narrowed from `src/**` to the code files (`src/**/*.ts`, and `src/**/*.{ts,tsx}` for desktop), because vitest 4 now parses every matched file and `renderer/index.html` produced a (non-fatal) "Failed to parse ... Excluding it from coverage" error. The comment in `config/coverage.ts` explains it.

Runs inside Electron's Node: VERIFIED. `node scripts/vitest-electron.mjs run` starts, runs 65 tests, and `--coverage` works (same `ELECTRON_RUN_AS_NODE` mechanism as with vitest 2).

Results: lint 0 errors (91 warnings, unchanged); typecheck 0 errors; core 34/34, desktop 65/65; scripts 36/36; build ok; `pnpm test:e2e` 3/3; `pnpm check:migrations` in sync; `COVERAGE_ENFORCE=true pnpm test:coverage` still fails both packages with "does not meet global threshold (90%)" (the switch works); `pnpm test:coverage` exits 0.

**The coverage baseline restated (measurement change, not a code change).** Same code, same tests:

| | vitest 2.1.9 (V8, line-based) | vitest 4.1.12 (V8, AST-based) |
|---|---|---|
| core lines / statements / branches / functions | 67.22 / 67.22 / 86.88 / 87.87 | 77.43 / 77.88 / 85.15 / 93.93 |
| desktop lines / statements / branches / functions | 37.32 / 37.32 / 86.66 / 78.35 | 39.8 / 39.4 / **30.36** / 32.7 |

Reading: AST remapping drops lines with no runtime code and counts every function and branch in files no test imports (the renderer), which v2 reported as 0 of 0. The desktop branch figure of 86.66% therefore overstated reality; 30.36% is the honest starting point for the 90% climb. Some files show lower numbers too (for example `schema.ts` 80%: the table-extras callbacks are never called in tests). The plan's baseline table (S2) is superseded by this one; the re-measure task T026 should start from these numbers.

Audit after this group: low 0, moderate 6, **high 10, critical 1**; the only remaining high and critical advisories are `tar`, `app-builder-lib` and `builder-util-runtime`, all under electron-builder (next group). `pnpm audit --prod --audit-level high`: no known vulnerabilities.

#### Group 3: electron-builder 25.1.8 to 26.15.7 (app-builder-lib, dmg-builder, builder-util-runtime, tar): VERIFIED locally (macOS arm64)

Sources: `npm view electron-builder dist-tags/versions` (latest `26.18.0`, `v26` tag `26.18.1`); `npm view app-builder-lib@26.x dependencies` (`tar ^7.5.7`, `builder-util-runtime 9.7.0`); the GitHub release notes for every `electron-builder@26.x` tag up to 26.15.7 (GitHub API, read 2026-11-14); the electron.build changelog page (covers 27.0.0-alpha only). Advisories (audit JSON): app-builder-lib GHSA-7g7r-gx96-252g patched 26.15.0; builder-util-runtime GHSA-p2f4-r6v6-j797 patched 9.7.0; tar 12 advisories, newest GHSA-r292-9mhp-454m patched 7.5.21.

Chosen: `electron-builder ~26.15.7` (the last patch of the first line that clears app-builder-lib and builder-util-runtime). Because app-builder-lib 26.15.x asks for `tar ^7.5.7`, pnpm resolved tar to **7.5.23**, above every patched version. `~` keeps the toolchain on 26.15.x; later 26.16 to 26.18 exist but were not tested.

What the release notes say (none verified beyond reading): no entry is marked breaking in 26.0 to 26.15.7. Notable for us: 26.1.0 adds a dynamic-import helper; 26.3.3 "double check hoisted mode for each node module" (pnpm related); **26.15.0 replaces the Go binary `app-builder-bin` with a TypeScript implementation and replaces its node dependency-tree and rebuild helpers**, which is why the packaging dry run is the test that matters. The 25 to 26.0.0 release body itself could not be retrieved (no release object for that tag in the API listing).

Changes: `apps/desktop/package.json` (1 line), `pnpm-workspace.yaml` (+2 lines: `electron-winstaller: false` with a comment; electron-builder 26 pulls in `electron-winstaller@5.4.0`, whose install script only copies a 7-Zip binary for Squirrel.Windows installers; our Windows target is NSIS, and pnpm 12 fails `pnpm install` with `ERR_PNPM_IGNORED_BUILDS` for an unreviewed build script, which would also fail `pnpm install --frozen-lockfile` in CI), and `electron-builder.yml` was **not** changed.

Packaging dry run (`pnpm exec electron-builder --dir`, baseline on 25.1.8 first):

| | 25.1.8 (baseline) | 26.15.7 |
|---|---|---|
| runtime | 5.6 s | 9.8 s (includes re-downloading the Electron zip) |
| `app.asar` entries | 5,799 | 5,796 (3 fewer: a leftover `node-gyp` build folder from the old native rebuild) |
| Resources tree | 72 entries | identical |
| `better-sqlite3` unpacked outside the asar | yes | yes |
| `drizzle/` migrations in Resources | yes | yes (all 3 migration files present) |
| `@shopos/core` bundled | no | no (devDependency fix from F6 still holds) |
| `.app` size | 347 MB | 338 MB |
| new log noise | none | one warning "duplicate dependency references" listing react, react-dom and the radix packages (the redundant runtime dependency listing noted in F6); harmless in this run |

Smoke test of the **packaged** app's native module: `ELECTRON_RUN_AS_NODE=1 "Shop OS.app/Contents/MacOS/Shop OS" -e "...require(.../app.asar.unpacked/node_modules/better-sqlite3)..."` printed `electron 43.8.10 node 24.22.1 sqlite 3.54.1`. The full app window was not launched here beyond the end-to-end run against the built bundle (3 of 3 pass).

Results: lint 0 errors (91 warnings, unchanged); typecheck 0 errors; core 34/34, desktop 65/65; scripts 36/36; `pnpm test:coverage` exit 0 (core 77.43%, desktop 39.8% lines, as restated under group 2); `pnpm check:migrations` in sync; build ok; `pnpm test:e2e` 3/3; `pnpm install --frozen-lockfile` clean.

#### Audit before and after (`pnpm audit`, run 2026-11-14)

| Stage | low | moderate | high | critical | `audit --audit-level high` exit |
|---|---|---|---|---|---|
| Baseline (`main`, 0aa3609) | 1 | 15 | 11 | 4 | 1 |
| After vite + electron-vite | 1 | 15 | 11 | 4 | 1 |
| After vitest 4 | 0 | 6 | 10 | 1 | 1 |
| After electron-builder 26.15.7 | **0** | **2** | **0** | **0** | **0** |

`pnpm audit --prod --audit-level high` passes (no known vulnerabilities) at every stage. Remaining, both moderate and not required by the high-level gate: esbuild GHSA-67mh-4wv8-2f99 (patched 0.25.0) via `drizzle-kit > @esbuild-kit/esm-loader > @esbuild-kit/core-utils` (drizzle-kit's own deprecated loader; the newer esbuild is installed separately), and minimatch GHSA-g3hv-75wg-m249 (patched 11.0.1) via `typescript-eslint`. Neither is reachable from the shipped app; they are build-time tools.

`.github/workflows/ci.yml`: the audit job is now a real check (name "Dependency audit", `continue-on-error` removed, header and comments updated) because `pnpm audit --audit-level high` exits 0. The secret-scan job stays informational. **Not verifiable here:** how that job behaves on GitHub; a new advisory can turn it red with no code change (the job comment says to upgrade or record a reviewed exception). This answers open item O4 differently from F4: the audit is now stable enough to keep as a check, with that caveat.

### F9. Coverage baseline under vitest 4 (2026-11-14, before the M2 tests)

Measured with `pnpm test:coverage` on branch `test/coverage-core-main` (vitest 4.1.12, V8 provider, report-only). The earlier S2 numbers (vitest 2) are **not comparable**: vitest 4 counts coverage from the AST, so untested files and branches now show up.

| Area | Lines | Statements | Functions | Branches |
|---|---|---|---|---|
| `packages/core` (whole package) | 77.43 | 77.88 | 93.93 | 85.15 |
| `apps/desktop` (whole package, renderer still 0%) | 39.80 | 39.40 | 32.70 | 30.36 |
| desktop slice `src/main/**` | 74.16 | 73.31 | 67.53 | 64.52 |
| desktop slice `src/preload/**` | 0 | 0 | 0 | 0 |

Per file, `packages/core` (lines / statements / functions / branches): `commands.ts` 0/0/100/100, `index.ts` 0/0/100/100 and `types.ts` 0/0/100/100 (no core test imports them: the Zod schemas are only exercised through the desktop tests, which do not count for core); `money.ts` 85.7/84.2/90/79.2; `quantity.ts` 88.2/89.5/80/70.6; `draftBill.ts` 96/92.1/100/85.1; `numbering.ts` 95.5/95.8/100/93.8; `stock.ts` 100/100/100/87.5; `billing.ts` and `errors.ts` 100 on all four.

Per file, main process: `main/index.ts` 0 on all four; `main/ipc/index.ts` 0; `main/ipc/handlers.ts` 55.6/57.9/50/75; `main/db/seed.ts` 60/54.5/50/25; `main/db/schema.ts` 80/80/63.6/100; `main/db/connection.ts` 100/85.7/100/50; `main/services/electronRenderer.ts` 0; `preload/index.ts` 0; repositories 90 to 100 lines but 50 to 83 branches (`SettingsRepository` 50, `StockRepository` 66.7, `ItemRepository` 83.3); services 91.8 to 100 lines, branches 81.8 to 100.

Reading: the slice that matters is the main process (74% lines, 65% branches) and core (77% lines). The shortfalls are untested entry files (`main/index.ts`, `preload/index.ts`, `electronRenderer.ts`, `ipc/index.ts`), schema factory functions that vitest counts as functions, and untested branches. The renderer is a separate, later phase.

### F10. M2 result: core and main process at 90% (2026-11-15)

Measured with `pnpm test:coverage` (vitest 4.1.12, V8) on branch `test/coverage-core-main`; `COVERAGE_ENFORCE` stays `false` (the gate is switched on last, T036).

| Area | Lines | Statements | Functions | Branches | Threshold check |
|---|---|---|---|---|---|
| `packages/core` | 100 | 100 | 100 | 99.21 | `COVERAGE_ENFORCE=true` run exits 0 |
| desktop slice `src/main/**` + `src/preload/**` | 100 | 100 | 100 | 98.02 | enforced run on this slice (one-off config, same 90% thresholds) exits 0 |
| desktop whole package (renderer still 0%) | 56.22 | 55.99 | 52.35 | 46.79 | below 90%: the renderer phase (T027 to T035) is next |

Per file (the "after" column shows lines / functions / branches). New files from the refactor have no "before".

| File | Before: lines / branches | After: lines / functions / branches |
|---|---|---|
| `core/billing.ts` | 100 / 100 | 100 / 100 / 100 |
| `core/commands.ts` | 0 / 100 | 100 / 100 / 100 |
| `core/draftBill.ts` | 96 / 85.1 | 100 / 100 / 97.87 |
| `core/errors.ts` | 100 / 100 | 100 / 100 / 100 |
| `core/index.ts` | 0 / 100 | 100 / 100 / 100 |
| `core/money.ts` | 85.71 / 79.16 | 100 / 100 / 100 |
| `core/numbering.ts` | 95.45 / 93.75 | 100 / 100 / 100 |
| `core/quantity.ts` | 88.23 / 70.58 | 100 / 100 / 100 |
| `core/stock.ts` | 100 / 87.5 | 100 / 100 / 100 |
| `core/types.ts` | 0 / 100 | 100 / 100 / 100 |
| `main/app/appConfig.ts` | new | 100 / 100 / 100 |
| `main/app/appState.ts` | new | 100 / 100 / 100 |
| `main/app/backupLifecycle.ts` | new | 100 / 100 / 100 |
| `main/app/mainWindow.ts` | new | 100 / 100 / 100 |
| `main/app/securityHeaders.ts` | new | 100 / 100 / 100 |
| `main/app/shell.ts` | new | 100 / 100 / 100 |
| `main/app/startApp.ts` | new | 100 / 100 / 100 |
| `main/db/connection.ts` | 100 / 50 | 100 / 100 / 100 |
| `main/db/ids.ts` | 100 / 100 | 100 / 100 / 100 |
| `main/db/schema.ts` | 80 / 100 | 100 / 100 / 100 |
| `main/db/seed.ts` | 60 / 25 | 100 / 100 / 100 |
| `main/index.ts` | 0 / 0 | 100 / 100 / 100 |
| `main/ipc/handlers.ts` | 55.55 / 75 | 100 / 100 / 100 |
| `main/ipc/index.ts` | 0 / 0 | 100 / 100 / 100 |
| `main/repositories/BillRepository.ts` | 100 / 100 | 100 / 100 / 100 |
| `main/repositories/ItemRepository.ts` | 97.22 / 83.33 | 100 / 100 / 94.44 |
| `main/repositories/SettingsRepository.ts` | 100 / 50 | 100 / 100 / 100 |
| `main/repositories/StockRepository.ts` | 90 / 66.66 | 100 / 100 / 83.33 |
| `main/services/BackupService.ts` | 98.61 / 90 | 100 / 100 / 95 |
| `main/services/BillingService.ts` | 93.47 / 84.61 | 100 / 100 / 100 |
| `main/services/InventoryService.ts` | 98 / 91.66 | 100 / 100 / 100 |
| `main/services/PrintService.ts` | 100 / 81.81 | 100 / 100 / 100 |
| `main/services/SettingsService.ts` | 100 / 100 | 100 / 100 / 100 |
| `main/services/billHtml.ts` | 100 / 88.46 | 100 / 100 / 100 |
| `main/services/electronRenderer.ts` | 0 / 0 | 100 / 100 / 100 |
| `preload/bridge.ts` | new | 100 / 100 / 100 |
| `preload/index.ts` | 0 / 0 | 100 / 100 / 100 |

Left uncovered, with the reason (checked against the lcov report, not assumed):
- `core/draftBill.ts` line 98 (one branch): the "not a CoreError" side of `caughtError instanceof CoreError ? ... : "Invalid line"`. Everything inside that `try` throws `CoreError`; reaching the other side needs a mock that makes a core rule throw a different error. Defensive; left.
- `BackupService.ts` lines 37 and 112 (one branch each): `String(caughtError)` for a thrown value that is not an `Error`. better-sqlite3 and the file system only throw `Error`s. Defensive; left.
- `ItemRepository.ts` lines 114 and 137, `StockRepository.ts` line 58 (one branch each): the `?? 0` after `.get()?.` on `count(*)` and `coalesce(sum(...), 0)` queries. SQLite always returns exactly one row for these, so the fallback cannot happen. Left.

Defect found by the work: `evaluateDraft` documented "never throws" but threw `CoreError: amount too large` for a line with a huge quantity and rate, which would have crashed the New bill screen. Fixed test-first (commit `919beed`).

Refactor for testability (behaviour unchanged, proven by the 3 end-to-end tests on the built app): `main/index.ts` (174 lines of top-level code) became a 22-line entry plus seven small modules in `main/app/`; `electronRenderer.ts` builds from a window factory; the preload bridge is a function (`preload/bridge.ts`). Security options are copied unchanged and pinned by tests (isolated, sandboxed, no Node; offscreen window also no JavaScript; Content-Security-Policy; window-open denied; navigation guard).

### F11. M3 result: the desktop package and `main` at 90% (2026-11-22, T035)

Measured with `pnpm test:coverage` (vitest 4.1.12, V8, all files under `src/` included) on `origin/main` at `7b48cf8` plus the tests of #120 (the gaps T028 to T034 still had). `COVERAGE_ENFORCE` is still `false` at the time of this record; T036 switches it on. Per-area figures are sums of covered over total from `apps/desktop/coverage/coverage-summary.json`.

| Area | Lines | Statements | Functions | Branches |
|---|---|---|---|---|
| `packages/core` | 99.68 | 99.42 | 100 | 96.91 |
| desktop total | 99.17 | 98.83 | 97.77 | 96.92 |
| desktop `src/main/**` (48 files) | 99.64 | 99.22 | 99.30 | 96.03 |
| desktop `src/preload/**` (2 files) | 100 | 100 | 100 | 100 |
| desktop `src/renderer/**` (113 files) | 98.51 | 98.30 | 96.02 | 98.00 |

Every area is above 90% on all four metrics.

What was on `main` and what came after, so the baseline is not misread:

| When | Tests | Desktop total (lines / statements / functions / branches) |
|---|---|---|
| `main` at `7b48cf8` (baseline) | the screen and hook tests of T030 to T033 (#107, #108), already merged | 98.75 / 98.38 / 96.47 / 96.02 |
| baseline + #120 | adds `api`, `billForm`, `useDraftAutosave`, `useItems`, `main.tsx`, `Toast` and `BillLineRow` tests | 99.17 / 98.83 / 97.77 / 96.92 |

So the 90% target was already met at the baseline by the T030 to T033 tests, and #120 closed the last gaps. Only the desktop total was measured at `7b48cf8`; the per-area rows above are from the branch with #120.

Lowest remaining spots among files that contain code: `ItemForm.tsx` 90.9% lines and 83.33% branches, `SettingsScreen.tsx` 91.1% lines, `themePreference.ts` 91.7% lines, `startupRecovery.ts` 75% branches, `startupSafety.ts` 80% branches. Every file with code is above 90% on lines; the type-only `*.types.ts` files have no code and show 0 of 0.

O6 answered: branch coverage of 90% was reachable on the UI code (renderer 98.00%). No exclusion was added and no threshold changed.

## Open items (unverified; each resolved by the task named)

| # | Item | Resolved by |
|---|---|---|
| O1 | Linux runner needs a virtual display for Electron: `xvfb-run` or a display action; whether the app launches under it and whether Chromium sandbox flags are needed | T010 |
| O2 | ~~Exact third-party action versions to pin~~ **Resolved 2026-11-14**: looked up and verified, see F1 | T008 |
| O3 | Runner minutes: macOS and Windows runners cost more than Linux; confirm the account's allowance before the nightly smoke job | T040 |
| O4 | **Answered (F4): not stable, stays non-required.** *Updated 2026-11-14 (F8): after the tooling upgrades the high-level audit exits 0 and the job is no longer informational.* Was: whether `pnpm audit` is stable enough to be a required check (it can fail on advisories the project cannot fix) | T014 |
| O5 | The repository is not on GitHub yet: hosting and the default branch name (`main`) | T006 (owner action) |
| O6 | ~~Branch coverage at 90% on UI code may be hard~~ **Answered 2026-11-22 (F11): not hard; renderer branches 98.00%, desktop total 96.92%** | T034 |
