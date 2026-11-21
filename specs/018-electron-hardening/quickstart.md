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
| Alter `app.asar` header on both macOS and Windows (check each packaged build) | app will not start on either platform (US4 scenario 3); on each platform, restore the original archive or re-run `package` before the next row |
| Packaged app: save and print bill C1/26-27/000123 | works; database opens (US4 scenario 5) |

## Before shipping PR C (US6)

Launch the installed T035 build and let its `file:` page load. The one-time copy runs on the first load of that page; installing T035 alone is insufficient. Right after that first load, verify that `shop_profile.theme` equals the value that was in `localStorage` (the copy worked). Just before the PR C release, check only that `shop_profile.theme` holds the owner's current choice: if they changed the theme after the copy, the old `localStorage` value is stale and is no longer compared.

**Release gate for PR C**: the shop installs updates by hand (no auto-updater), so PR C is handed out only after **every** counter has launched the T035 build and its theme check above has passed; record each counter's name and the date. A counter that was upgraded straight to PR C anyway (a mistake, not a supported path) has no way to read the old `file:` storage: it starts with System and shows a one-time "Choose your theme again" message, so the loss is visible and fixed in one click rather than silent.

## After PR C (US6)

| Check | Expected |
|---|---|
| Packaged app: every screen in System, Light, Dark | renders; fonts and icons load from the private address |
| Request `../` path outside the bundle | refused (SC-006) |
| Theme preference after upgrading from the verified T035 build | matches the value copied into `shop_profile.theme` before the switch |
| Fuse report | file-protocol extra privileges off |
