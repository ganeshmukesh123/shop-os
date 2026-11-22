---
name: shopos-electron-ipc
description: "Use when touching the Electron main process, preload bridge, IPC commands, native dialogs, printing, or anything that crosses between the React renderer and the main process in Shop OS. Covers security defaults, the typed command contract, adding a command step by step, validation and error results."
---

# Electron main process, preload and IPC

Authority: constitution I, V and the Technical Constraints (Electron security). Architecture: `docs/reference/architecture.md` 10.1 (desktop shell) and 12.3 (security). Contract: `specs/<feature>/contracts/ipc-commands.md`.

## 1. Security defaults (never relax)

- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`; a restrictive Content-Security-Policy in `index.html` and as response headers (`apps/desktop/src/main/app/securityHeaders.ts`).
- The renderer **never** touches the database, the file system, Node or Electron APIs. It calls typed commands through `window.shopos`.
- The preload exposes **only** the commands in the contract, as plain functions. No generic `invoke(channel)`, no `ipcRenderer` leaked.
- Block navigation and new windows (`will-navigate`, `setWindowOpenHandler`).
- Treat renderer input as untrusted: validate every command with Zod in the main process. Keep Electron updated.

## 2. One command, five places

The contract is a single map so the compiler checks every layer.

| Step | File |
|---|---|
| 1. Describe it in the contract | `specs/<feature>/contracts/ipc-commands.md` |
| 2. Input and result types, Zod schema | `packages/core/src/types.ts` |
| 3. Register in the command map | `packages/core/src/commands.ts` |
| 4. Handler: validate, call a service, return the envelope | `apps/desktop/src/main/ipc/handlers.ts` (or a feature file it imports) |
| 5. Bridge and typed client | `apps/desktop/src/preload/bridge.ts` (builds the bridge from the command list; `preload/index.ts` only exposes it) and `apps/desktop/src/renderer/shared/api/api.ts` |

Then: a test that calls the handler (`tests/integration/ipc.test.ts` style) for success, a domain error and bad input.

## 3. Handlers

- One handler per command, thin: **validate, call one service method, map the result**. No business rules, no SQL.
- Result envelope is always `{ ok: true, data }` or `{ ok: false, code, message }`. Domain errors (`CoreError`) map to their `code`; validation errors to `INVALID_FIELD`; anything unexpected to a generic code with a safe message (log details locally, without customer data).
- Never throw across IPC. Never return a raw database error.
- Handlers receive services by constructor wiring (`createHandlers(services, shell)`), so tests pass in-memory or fake ones.

## 4. Main process responsibilities

Owns: the database file, backups, printing (OS dialog, `printToPDF`, later ESC/POS), native dialogs (open, save), auto-update, app lifecycle. Keep `index.ts` to wiring: create window, create services, register handlers, start backup scheduler. Anything bigger moves to its own module.

Hardware and OS access sits behind small interfaces (`HtmlRenderer`, `Shell`) so tests use fakes (architecture 10.5, ports and adapters).

## 5. Printing

A print or PDF failure never affects the saved bill: commit first, print after, return `PRINT_FAILED` or `WRITE_FAILED`. Printed output is always black on white, whatever theme the screen uses. Real printer behaviour (receipt width, driver) is unverified until spike T008 is run on the shop's printer.

## 6. Checklist

- [ ] Security defaults unchanged; no new Node or Electron access in the renderer
- [ ] Command added in all five places; schema validates input
- [ ] Handler thin; errors mapped to codes; no throw across IPC
- [ ] Integration test for success, domain error and invalid input
- [ ] Contract doc updated
