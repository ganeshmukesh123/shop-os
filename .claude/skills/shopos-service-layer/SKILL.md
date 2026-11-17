---
name: shopos-service-layer
description: "Use when adding or changing a Shop OS use case, service, repository, port or adapter (apps/desktop/src/main/services and repositories), or when deciding where code belongs between core, services, repositories and UI. Covers layering and dependency direction, ports and adapters, constructor wiring, transactions per use case and idempotent writes."
---

# Services, repositories and layering

Authority: constitution V, VII. Architecture: `docs/reference/architecture.md` 10.1 (packages), 10.5 (use cases, ports, adapters), 10.7 (patterns) and 10.8 (SOLID).

## 1. The layers and the one rule

```
Screens (React)  ->  typed API  ->  IPC handlers  ->  Services (use cases)  ->  Repositories  ->  Database
                                                              \->  @shopos/core (pure rules)
```

**Dependencies point inward only.** Outer layers call inner ones; inner layers never import outer ones. `@shopos/core` imports nothing from the others. Repositories never call services. Services never import React, Electron windows or Drizzle.

| Layer | Owns | Must not |
|---|---|---|
| `@shopos/core` | Rules, value arithmetic, validation, types | Do I/O, import anything outer |
| Service (use case) | One user-level operation: validate, apply rules, coordinate repositories in one transaction, return a result | Contain SQL, format for screens, call the UI |
| Repository | All SQL and Drizzle, mapping rows to domain types | Hold business rules, call services |
| IPC handler | Validate input, call one service method, map the result | Contain rules or SQL |
| Screen / hook | Render and call the typed API | Touch the database, Node or Electron |

**Mapping to the architecture's packages.** Today `packages/core` is `shopos_core`; `main/services` plays `shopos_app` (use cases); `main/repositories` plays `shopos_data_local`; the renderer and main shell are `shopos_ui_desktop`. They are folders in one app for now. Extract a package only when a second consumer (the server or the phone app) needs it, and record why in the plan (constitution VII).

## 2. Services (use cases)

- One public method per use case, named for the business action: `saveBill`, `cancelBill`, `adjustStock`, `createItem`. A service stays small; when it grows past about 200 lines, split by use case (`SaveBillUseCase`, `CancelBillUseCase`).
- Steps in order: parse and validate, call core rules, open **one transaction**, call repositories, return a typed result. Nothing else.
- Dependencies arrive by **constructor**: database, shop context, clock, id generator, renderer or printer port. No global singletons, no service locator, no DI container (architecture 10.7).
- Time and ids are injected (`now: Date = new Date()` as a parameter with default at the edge only), so tests are deterministic.
- Throw `CoreError` with a code; never return half results.

## 2a. One folder per service

Each service (and each helper module such as `billHtml` or `electronRenderer`) has its own folder, and its test, constants and types live in it. Cross-service integration tests (for example IPC) stay in `apps/desktop/tests/integration`.

```
main/services/BillingService/
  BillingService.ts
  constants.ts
  types.ts
  BillingService.test.ts      integration test: success, each failure code, atomicity
  index.ts                    re-exports the service
```

Example: `main/services/BillingService.ts` becomes `main/services/BillingService/BillingService.ts`; its tests move from `tests/integration/billing.test.ts` beside it. The test runner's include pattern must match the co-located tests (task T093). Migration is task T093, done earliest.

## 3. Ports and adapters

- Anything outside our control (printer, file dialogs, clock, WhatsApp, UPI) is a small interface (`HtmlRenderer`, `Shell`) defined where it is used, with a real adapter and a fake for tests.
- Repositories are the same idea for storage. When more than one adapter exists (in-memory, SQLite, later PostgreSQL), they all pass **one shared contract test suite** (architecture 10.8, Liskov).
- Do not create an interface for something with a single implementation and no test double. Add the port when the second implementation or fake appears.

## 4. Writes that must not duplicate or half-save

- A write the user can repeat carries an idempotency key (`clientBillId`); a repeat returns the first result.
- One transaction per use case. Cached totals change in the same transaction as the movements.
- Never print, send or notify inside the transaction; do it after commit, and make failure there harmless.

## 5. Adding a use case

1. Spec and requirement IDs exist; contract entry written.
2. Core rule (if any) added test-first in `@shopos/core`.
3. Repository method(s) with SQL and tests (in-memory database).
4. Service method with an integration test: success, each failure code, atomicity (a failure leaves nothing behind), idempotency if repeatable.
5. IPC command, then screen (see the IPC and React skills).

## 6. Checklist

- [ ] Layer rule respected (no outward imports); no SQL outside repositories; no rules outside core or services
- [ ] One public method per use case; constructor wiring; clock and ids injected
- [ ] One transaction; repeatable writes idempotent; side effects after commit
- [ ] Ports only where a second implementation or fake exists
- [ ] File 200 lines or less; method 40 or less
