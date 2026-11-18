# Quickstart: validate Electron hardening

Run from `apps/desktop` unless noted. Contracts: [contracts/hardening-policies.md](./contracts/hardening-policies.md).

## After PR A (US1, US2, US3)

```
pnpm test            # sender, permission, navigation tables pass
pnpm pr:size         # repo root; within 400
```

| Check | Expected |
|---|---|
| Fake event from foreign page, null frame, child frame | refused, no service call, zero writes (SC-001) |
| Permission request and check | denied, not granted (SC-002) |
| Blocked-address table | all blocked; app page allowed (SC-003) |
| Relax `sandbox`, CSP or isolation in a scratch edit | a test fails (FR-010) |
| Save a bill in `pnpm dev`, print preview | works as before (O6) |

## After PR B (US4)

```
pnpm build && pnpm --filter @shopos/desktop package
node scripts/check-fuses.mjs release/<packaged app>
ELECTRON_RUN_AS_NODE=1 "<packaged app binary>" -e "console.log(1)"
pnpm test && pnpm test:e2e      # dev binary untouched (SC-005)
```

| Check | Expected |
|---|---|
| Fuse report | run-as-node, node-options, node-inspect off; integrity and only-from-asar on |
| Run-as-node on packaged app | does not print `1`; app starts normally or exits |
| Alter `app.asar` header (Mac or Windows) | app will not start (US4 scenario 3); then restore the original archive or re-run `package` before the next row |
| Packaged app: save and print bill C1/26-27/000123 | works; database opens (US4 scenario 5) |

## After PR C (US6)

| Check | Expected |
|---|---|
| Packaged app: every screen in System, Light, Dark | renders; fonts and icons load from the private address |
| Request `../` path outside the bundle | refused (SC-006) |
| Theme preference after upgrade from the T035 release | kept: it lives in the database before the switch (T035) |
| Fuse report | file-protocol extra privileges off |
