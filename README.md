# Shop OS

Billing, stock, credit and control for Indian hardware shops. Built first for one shop's own counter.

**This repository contains feature `001-shop-os-mvp`:** a desktop app where the owner enters inventory and staff make simple no-tax bills, then print them or save them as PDF. Everything is stored in a single local file. There is no server, no account and no internet needed once it is installed.

- Status: working MVP, run and tested on **macOS (Apple Silicon)** only. Windows and Linux are not tried yet.
- Not built yet (deferred, see [What is not included](#what-is-not-included)): bill list and search, reprint from a list, cancelling a bill, spreadsheet import, tax, customer credit, cloud sync.

---

## Contents

1. [What the app does](#what-the-app-does)
2. [What is not included](#what-is-not-included)
3. [Requirements](#requirements)
4. [Quick start](#quick-start)
5. [Using the app](#using-the-app)
6. [Where your data lives](#where-your-data-lives)
7. [Commands](#commands)
8. [Tests](#tests)
9. [Project layout](#project-layout)
10. [How it works](#how-it-works)
11. [The SQLite native binary (read this)](#the-sqlite-native-binary-read-this)
12. [Changing the database](#changing-the-database)
13. [Printing](#printing)
14. [Backup and restore](#backup-and-restore)
15. [Building an installer](#building-an-installer)
16. [Troubleshooting](#troubleshooting)
17. [Contributing](#contributing)
18. [Documentation map](#documentation-map)
19. [Verification status](#verification-status)

---

## What the app does

| Area | What you can do |
|---|---|
| **Items** | Add, edit and deactivate items (name, unit, price, opening quantity). Search by part of the name. Correct stock with a required note. Duplicate names are warned. Decimals are accepted for metre, kg, litre and custom units that allow them, and whole numbers only for pieces. |
| **New bill** | Search items (2+ letters), press Enter to add, change quantity, rate and discount (₹ or %) per line or for the whole bill, add an optional customer name, choose a payment label (cash, UPI, card, unpaid), save with `Cmd/Ctrl+S`. Totals update as you type. |
| **After saving** | The bill gets the next number, stock reduces, and you can print it (receipt, A5 or A4) or save a PDF. |
| **Safety** | An unsaved bill is recovered after a crash or power cut. Saving the same bill twice (double click, retry) never creates a second bill. A bill is saved before any printing starts, so a printer failure never loses a sale. Selling more than is in stock is allowed and the item is flagged "Needs correction". |
| **Settings** | Shop name, address, phone, footer, receipt width (58 mm or 80 mm), bill number format, backup folder, run a backup now, restore from a backup file. |
| **Backup** | Automatic backup to a second folder every 15 minutes and when you close the app. |

Bill numbers look like `C1/26-27/000123` (series, financial year April to March, sequence). They are consecutive, at most 16 characters, never reused.

## What is not included

Out of scope for this release (each needs its own spec): bill list and search, reprint from a list, cancelling a bill (the database already enforces that a saved bill can only ever move from *saved* to *cancelled*, but there is no screen yet), spreadsheet import, GST or any tax, customer phone numbers and credit (khata), reports, user logins, WhatsApp sharing, cloud sync, multiple shops and phone apps.

---

## Requirements

| Needed | Notes |
|---|---|
| **macOS** on Apple Silicon | The only platform tested. Windows and Linux are untested. |
| **Node.js 22 LTS** | See `.nvmrc`. It also ran on Node 25 during development. |
| **pnpm 12** | Pinned in `package.json` (`packageManager`). Easiest: `corepack enable`. |
| **Internet, once** | `pnpm install` downloads the Electron app runtime (about 100 MB) and a prebuilt SQLite binary. After that the app itself works fully offline. |
| ~1 GB free disk | For `node_modules`. |
| A printer (optional) | PDF export works without one. See [Printing](#printing). |
| `sqlite3` command line (optional) | Preinstalled on macOS. Used by the end-to-end tests and handy for inspecting data. |

You do **not** need Xcode, Python or a C++ compiler for the normal setup, because a prebuilt SQLite binary is downloaded. (If no prebuilt binary exists for your platform, the setup falls back to telling you to compile, see [Troubleshooting](#troubleshooting).)

---

## Quick start

```bash
git clone <repository-url> shop-os
cd shop-os

corepack enable            # makes the pinned pnpm version available
pnpm install               # installs everything and fetches the Electron-compatible SQLite binary
pnpm dev                   # starts the app in development mode
```

A **Shop OS** window opens. Development mode uses a **throwaway database**, so you can add test data freely without touching real shop data.

Stop it with `Ctrl+C` in the terminal.

### If `pnpm install` stalls on the Electron download

Electron's binary comes from GitHub and can stall on slow or filtered networks. If `pnpm install` seems frozen for several minutes, stop it and install the binary by hand (macOS Apple Silicon shown; for other systems use the matching file name from the [Electron releases page](https://github.com/electron/electron/releases), version `v33.4.11`):

```bash
curl -L --retry 10 --retry-all-errors -C - -o /tmp/electron.zip \
  https://github.com/electron/electron/releases/download/v33.4.11/electron-v33.4.11-darwin-arm64.zip
unzip -tq /tmp/electron.zip                                   # must say: No errors detected

mkdir -p apps/desktop/node_modules/electron/dist
unzip -q -o /tmp/electron.zip -d apps/desktop/node_modules/electron/dist
printf "Electron.app/Contents/MacOS/Electron" > apps/desktop/node_modules/electron/path.txt

pnpm --filter @shopos/desktop ensure:sqlite                   # fetch the matching SQLite binary
```

If pnpm complains that build scripts were "ignored", check that `pnpm-workspace.yaml` contains the `allowBuilds` section for `better-sqlite3`, `electron` and `esbuild`.

---

## Using the app

First time, in this order:

1. **Settings** (`Cmd+3`): set the **shop name**, address, phone and footer. These appear on every bill. Check the **bill number format** preview. Choose your receipt width if you use a thermal printer.
2. **Settings > Backup**: click **Choose folder** and pick a folder on a *different drive*, then **Back up now**. You should see "Backup complete" and a "Last good backup" time.
3. **Items** (`Cmd+1`): click **Add item**. Example: "PVC Pipe", unit `metre`, price `120.50`, opening quantity `20`. Add a few more. Try adding the same name twice (you will get a warning) or `2.5` pieces of a `pcs` item (it is rejected).
4. **New bill** (`Cmd+2`, the screen the app opens on):
   - Type two or more letters of an item name and press **Enter** to add the top match.
   - Change **Qty**, **Rate** or **Discount** (switch ₹ / %). Press Enter in a quantity box to go back to the search.
   - Optionally type a customer name and pick a payment label.
   - Press **`Cmd/Ctrl+S`** (or **Save bill**).
5. On the saved bill, choose **Receipt / A5 / A4**, then **Print** or **Save PDF**.

Keyboard shortcuts: `Cmd/Ctrl+1/2/3` switch screens, `Cmd/Ctrl+S` saves the bill, `Esc` clears the search box.

---

## Where your data lives

A single SQLite file, plus backups you choose.

| Mode | Database file |
|---|---|
| `pnpm dev` on macOS | `~/Library/Application Support/@shopos/desktop/shopos-dev.sqlite` |
| Built app, not packaged (`out/`) | `shopos.sqlite` in the same folder |
| Installed app | Expected under the app's own data folder (not verified, no installer has been built yet) |
| **Any mode, your choice** | Set `SHOPOS_USER_DATA=/some/folder` before starting; the app then uses that folder. The tests use this. |

```bash
SHOPOS_USER_DATA=/tmp/shopos-demo pnpm dev     # use a clean, known folder
sqlite3 /tmp/shopos-demo/shopos-dev.sqlite "select number, grand_total_paise, status from bill;"
```

Money is stored as integer **paise** and quantities as integer **thousandths**, so `120.50` is `12050` and `2.5 metre` is `2500`.

---

## Commands

Run from the repository root unless noted.

| Command | What it does |
|---|---|
| `pnpm install` | Install dependencies. The `postinstall` step also makes sure the SQLite binary matches Electron. |
| `pnpm dev` | Run the app in development with hot reload for the screens. |
| `pnpm test` | All unit and integration tests (core in plain Node, desktop inside Electron's Node). |
| `pnpm --filter @shopos/desktop test:watch` | Desktop tests in watch mode. |
| `pnpm build` | Production build into `apps/desktop/out/`. |
| `pnpm test:e2e` | Playwright end-to-end tests against the real app. **Run `pnpm build` first.** |
| `pnpm typecheck` | TypeScript strict check for both packages. |
| `pnpm lint` | ESLint (0 errors expected; there are warnings for older code). |
| `pnpm format` | Prettier. |
| `pnpm pr:size` | Count changed lines for a pull request. |
| `pnpm --filter @shopos/desktop db:generate` | Generate a new SQL migration after editing the schema. |
| `pnpm --filter @shopos/desktop ensure:sqlite` | Check or repair the SQLite binary. |
| `pnpm --filter @shopos/desktop package` | Build an installer (**not yet tried**, see [Building an installer](#building-an-installer)). |

**Development tips**
- Screen changes (`renderer/`) update instantly. Changes in `main/`, `preload/` or `packages/core` need the app restarted. `npx electron-vite dev --watch` (run inside `apps/desktop`) restarts on main-process changes automatically.
- `Cmd+Option+I` in the app window opens Chrome DevTools. Main-process logs print in the terminal that runs `pnpm dev`.
- Real error details for unexpected failures appear only in that terminal; the screen shows a generic message.

---

## Tests

```
 packages/core        34 tests   plain Node, no database      pnpm test
 apps/desktop         65 tests   unit + integration, in-memory SQLite with the real migrations,
                                 run inside Electron's Node   pnpm test
 apps/desktop e2e      3 specs   Playwright drives the real built app   pnpm build && pnpm test:e2e
```

- Integration tests use the **real migrations and triggers** against an in-memory database, so they prove the same rules the app enforces.
- The Playwright specs cover: the inventory flow, a full bill with crash recovery and an exactly-once save, and PDF export for receipt, A5 and A4.
- A first-run in a clean checkout needs `pnpm build` before `pnpm test:e2e`.
- Run one test by name: `pnpm --filter @shopos/desktop test:watch -t "duplicate"`.

---

## Project layout

```
shop-os/
├── apps/desktop/                 The Electron app
│   ├── src/main/                 Electron main process (Node)
│   │   ├── index.ts              Entry point: opens the DB, wires services, creates the window
│   │   ├── db/                   Drizzle schema, connection, first-run seed
│   │   ├── repositories/         The only code that writes SQL
│   │   ├── services/             Use cases: Inventory, Billing, Settings, Print, Backup
│   │   └── ipc/                  Command handlers and the allow-listed IPC entry point
│   ├── src/preload/              Narrow bridge exposing window.shopos
│   ├── src/renderer/             React screens (Radix UI), no database access
│   ├── drizzle/                  Generated SQL migrations (committed)
│   ├── scripts/                  vitest-electron.mjs, ensure-electron-sqlite.mjs
│   ├── tests/                    unit/, integration/, e2e/, helpers/
│   └── electron-builder.yml      Installer configuration
├── packages/core/                @shopos/core: pure TypeScript business rules, no I/O
│   └── src/                      money, quantity, billing, stock, numbering, draftBill, types, commands
├── specs/001-shop-os-mvp/        Spec, plan, tasks, data model, contracts, quickstart
├── docs/                         PRD, architecture, design guidelines, contributing, restore guide
├── .specify/                     Spec Kit templates and the project constitution
└── .claude/skills/               Engineering guides for AI assistants and contributors
```

---

## How it works

```
 RENDERER (React)          PRELOAD            MAIN PROCESS                         DISK
 ───────────────────       ─────────          ─────────────────────────────        ──────────────
 screens call        ──▶   window.shopos ──▶  ipc: allow-list → Zod validation      shopos.sqlite
 call("bills.save")        (18 commands)      ▼                                      (WAL mode)
 no DB, no Node            only             services (use cases, transactions)         │
 uses @shopos/core         what the           ▼                                        │ online backup
 for live totals           contract           repositories ──────────────────────▶ SQLite ─────▶ backup folder
                           allows             ▼
                                              {ok:true,data} or {ok:false,code,message}
```

**Rules the code is built around** (full text in `.specify/memory/constitution.md`):

1. **A saved bill is never edited or deleted.** SQLite triggers enforce it, not just the app code.
2. **Stock is the sum of immutable stock movements.** The cached `stock_milli` on an item must always equal that sum, and a test checks it.
3. **Money is integer paise, quantity is integer thousandths.** No floating point. Rounding is one tested rule in `packages/core/src/money.ts` (half up).
4. **A bill, its lines, its stock movements and its number are saved in one transaction.** Printing happens after the commit.
5. **Business rules live in `@shopos/core`**, which imports no Electron, database or UI code, so a future server and phone apps can reuse them.
6. **The screen never touches the database.** It can only call the typed commands in `specs/001-shop-os-mvp/contracts/ipc-commands.md`.
7. **Every table has a UUID `id`, `business_id` and `shop_id`**, so sync and multiple shops can be added later without migrating data.

**Saving a bill, in short**

```
 Cmd+S ─▶ bills.save ─▶ validate (Zod, then core rules)
                         │
                         ▼  ONE TRANSACTION
                         same clientBillId already saved? ─yes─▶ return the first bill, change nothing
                         take next bill number · insert bill and lines (name/unit snapshot)
                         one "sale" stock movement per line · update cached stock · clear the draft
                         │ COMMIT (any failure rolls everything back)
                         ▼
                         return the bill  ─▶  Print / Save PDF run only now
```

---

## The SQLite native binary (read this)

`better-sqlite3` contains a compiled file (`better_sqlite3.node`) that works only with **one** JavaScript runtime version at a time. Electron ships its own Node with a different internal version number (ABI) from the Node installed on your computer. Loading the wrong build gives:

```
The module '.../better_sqlite3.node' was compiled against a different Node.js version
using NODE_MODULE_VERSION 141. This version of Node.js requires NODE_MODULE_VERSION 130.
```

**How this project avoids it:** there is one binary and it is the **Electron build**. The app, the integration tests (`pnpm test` runs Vitest inside Electron's Node) and Playwright all use it. `apps/desktop/scripts/ensure-electron-sqlite.mjs` checks it and downloads the right prebuilt binary if needed. It runs automatically on `postinstall` and before `dev`, `test` and `test:e2e`.

Do and don't:

| Do | Don't |
|---|---|
| Use `pnpm test` and `pnpm --filter @shopos/desktop test:watch` | Run `npx vitest` directly in `apps/desktop` (plain Node, wrong binary) |
| Run `pnpm --filter @shopos/desktop ensure:sqlite` if you see `NODE_MODULE_VERSION` | Run `pnpm rebuild better-sqlite3` (builds for plain Node and breaks the app) |
| Expect `packages/core` tests to run in plain Node (they use no database) | Assume the same binary works for every Electron upgrade: after bumping Electron, run `ensure:sqlite` |

IDE test buttons (for example the VS Code Vitest extension) use plain Node and will fail on database tests unless configured to use the project scripts.

---

## Changing the database

1. Edit `apps/desktop/src/main/db/schema.ts`.
2. Run `pnpm --filter @shopos/desktop db:generate`. Commit the new SQL file and the `drizzle/meta/` changes.
3. Migrations are applied automatically when the app starts (and by the test helper).
4. Update `specs/001-shop-os-mvp/data-model.md` and add or adjust tests.

Gotchas:
- This project uses **drizzle-orm 0.36**: table constraints use the object form `(t) => ({ name: index(...) })`, not the array form.
- If SQLite has to **rebuild a table** (for example when dropping a column), the migration drops that table's **triggers**. Re-create the immutability triggers in the same migration, as `0002` does for `bill`.
- Never change an existing migration file that has already been applied anywhere; add a new one.

---

## Printing

The app prints through the **operating system's print dialog**; it does not talk to printers directly.

1. Connect the printer to the computer (USB, network or Bluetooth) and install its driver so it prints a normal test page from the OS.
2. In Shop OS open a saved bill, choose **Receipt**, **A5** or **A4**, and click **Print**. Pick the printer in the OS dialog.
3. In **Settings** choose receipt width **80 mm** or **58 mm** to match your paper roll.
4. No printer? Use **Save PDF**.

**Not verified:** the Print button and OS dialog have never been exercised with a real printer, and thermal-printer paper sizing is untested. PDF export for receipt, A5 and A4 is tested. Raw thermal-printer commands (ESC/POS) are deliberately deferred.

---

## Backup and restore

- Set the backup folder in **Settings > Backup** (pick a different drive). Backups run every 15 minutes while the app is open and once more on close.
- Files are named `shopos-YYYYMMDD-HHMMSS.sqlite`. The app keeps the newest copy of each of the last 30 days, plus the last 4 of today.
- A failed backup is shown in red in Settings.
- **Restore** from Settings: choose a backup file, confirm, and the app replaces all data with it and restarts. A file that is not a valid Shop OS backup is refused and nothing changes.

The owner-facing step-by-step is in [`docs/restore-guide.md`](docs/restore-guide.md). It has not yet been followed by a second person on a clean computer.

---

## Building an installer

```bash
pnpm --filter @shopos/desktop package
```

This runs the build and then electron-builder (configuration in `apps/desktop/electron-builder.yml`: macOS `.dmg`, Windows NSIS, Linux AppImage; migrations are shipped as an extra resource and the SQLite module is unpacked from the archive). **This has not been run yet**, so treat the installer, the packaged app's data location and Windows/Linux builds as unverified. macOS builds are configured unsigned; on first launch right-click the app and choose **Open**.

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Dialog **"Shop OS could not start"** mentioning `NODE_MODULE_VERSION` | Wrong SQLite binary. Run `pnpm --filter @shopos/desktop ensure:sqlite`, then start again. See [the SQLite section](#the-sqlite-native-binary-read-this). |
| `pnpm install` stalls at the Electron download | See [the manual download steps](#if-pnpm-install-stalls-on-the-electron-download). |
| `ensure:sqlite` cannot fetch a binary | It needs network once. Try again, or compile: `npx @electron/rebuild -f -w better-sqlite3` (needs Xcode command line tools). |
| Dialog **"Shop OS could not start"** about migrations or "meta/_journal.json" | The `drizzle/` folder is missing or the app was started from a wrong path. Run from a full checkout. |
| `pnpm` commands hang or ask about "ignored build scripts" | Check the `allowBuilds` block in `pnpm-workspace.yaml`; run `pnpm install` again. |
| Window never appears from `pnpm dev` | Look at the terminal for the error. Port **5173** may be in use by another dev server; stop it and retry. |
| `pnpm test:e2e` fails to launch | Run `pnpm build` first; the specs start the built app from `apps/desktop/out/`. |
| `npx vitest` fails with `NODE_MODULE_VERSION` | Expected. Use `pnpm test` (runs inside Electron). |
| macOS says the built app "cannot be opened" | Unsigned build. Right-click, **Open**. |
| Print does nothing or prints oddly | Check the printer prints from other apps. Try **Save PDF**. See [Printing](#printing). |
| Want to see what the app saved | `sqlite3 <database file>` and query `bill`, `bill_line`, `stock_movement`, `item`. |

---

## Contributing

- Read [`.specify/memory/constitution.md`](.specify/memory/constitution.md) first: the rules that override everything.
- Day-to-day guidance for contributors and AI assistants is in [`CLAUDE.md`](CLAUDE.md), with focused guides in `.claude/skills/` (core domain, database, IPC, React components, service layer, testing, design system, code review).
- Work spec-first: one folder per feature under `specs/`, in the order *specify, clarify, plan, tasks, analyze, implement*. Do not build things the current spec does not ask for.
- Test first for anything that touches money, billing or stock.
- Pull requests: small (aim for 400 changed lines or fewer), one concern each. See [`docs/contributing/pull-requests.md`](docs/contributing/pull-requests.md), check size with `pnpm pr:size`, and use the template in `.github/pull_request_template.md`.
- Before opening a PR: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build && pnpm test:e2e` if you touched screens, IPC or printing.
- Naming and size limits are enforced by ESLint (`eslint.config.js`). Existing code predates some limits, so some show as warnings.

---

## Documentation map

| File | What it is |
|---|---|
| `specs/001-shop-os-mvp/spec.md` | What the MVP must do and how it is measured |
| `specs/001-shop-os-mvp/plan.md` | Technical plan, structure and milestones |
| `specs/001-shop-os-mvp/data-model.md` | Tables, fields and constraints |
| `specs/001-shop-os-mvp/contracts/ipc-commands.md` | The commands the screen may call |
| `specs/001-shop-os-mvp/contracts/bill-layout.md` | The printed bill layout |
| `specs/001-shop-os-mvp/research.md` | Decisions, open items and what is verified |
| `specs/001-shop-os-mvp/tasks.md` | The work list and its status |
| `specs/001-shop-os-mvp/quickstart.md` | Manual validation scenarios |
| `docs/reference/PRD.md`, `architecture.md` | Long-term product and architecture reference |
| `docs/design/design-guidelines.md` | Screen design rules |
| `docs/restore-guide.md` | Owner-facing backup and restore guide |

---

## Verification status

Last full run on macOS 26 (Apple Silicon), Electron 33.4.11:

| Check | Result |
|---|---|
| Core unit tests | 34 passed |
| Desktop unit and integration tests | 65 passed |
| Playwright end-to-end (inventory, billing with crash recovery, PDF export) | 3 passed |
| TypeScript strict check | clean |
| ESLint | 0 errors, 92 warnings (older code) |
| 5,000-item search | about 4 to 6 ms (target under 500 ms) |

**Not verified yet:** printing to a real printer, a packaged installer and the packaged app's data location, the Settings and backup screens being clicked through in a test, the restore guide followed by a second person, SQLCipher encryption (deferred), and anything on Windows or Linux. The remaining open tasks are listed in `specs/001-shop-os-mvp/tasks.md`.

## License

Not specified yet.
