# Quickstart: validating feature 010

Prerequisites: 001 to 009 merged; owner decisions OD-1 to OD-4 answered. New commands (assumed names, set in tasks T001 to T003):

```bash
pnpm --filter @shopos/server dev        # local server against a throwaway PostgreSQL (Docker)
pnpm --filter @shopos/server test       # server unit and integration tests
pnpm test:sync-sim                      # multi-device simulation (2 counters + phone, in-process server)
pnpm --filter @shopos/mobile start      # Expo dev build for the owner and godown apps
```

Contracts: `contracts/sync-api.md` (server), `contracts/ipc-commands.md` (desktop).

## 1. Sync never loses or duplicates (M2; US1)

1. Simulation: two counters and a phone offline for 7 simulated days, 500 bills each, including the last unit of item X on both; random connection drops mid-push; reconnect. Expected: every bill once on the server and on the other counter; stock of X at -1 with a negative-stock exception; 0 duplicates (SC-001).
2. Real devices: counter offline, bill 10 times, reconnect. Expected: indicator counts 10 pending, turns amber after 5 minutes, then 0 within a minute of reconnecting.
3. Kill the network mid-push. Expected: retry, no duplicate (`duplicate` results in the log).
4. Set the counter clock 15 minutes ahead. Expected: server time stored beside device time; owner exception for skew above 10 minutes.

## 2. Today card (M4; US2)

1. Make 5 bills, one with pending UPI, one on credit, one payment. Open the owner app. Expected: figures within 3 seconds on a 4G connection (SC-002), same day last week beside them, "updated 1 minute ago".
2. Tap Sales, then a bill. Expected: the bill opens in 3 taps or fewer.
3. Switch the phone to a weak network or airplane mode. Expected: last data shown with its age.

## 3. Alerts and remote approvals (M5; US3)

1. Below-cost line at the counter; choose "Ask owner on phone". Expected: notification within 10 seconds (measure 20 times, OI-3); approve with a reason; the counter saves.
2. Two owner phones: approve on one, reject on the other. Expected: the first decision wins; the second gets `ALREADY_DECIDED`.
3. No answer for 2 minutes. Expected: expired; the counter offers the PIN.
4. Alerts list with a cash difference of ₹250, a cancelled bill of ₹4,000 and an overdue party of ₹45,000. Expected: ranked ₹45,000, ₹4,000, ₹250.

## 4. Godown app (M6; US4)

Count rack R3 on the phone by camera scan. Expected: after sync the counter shows R3 done and the corrections.

## 5. Backup, revoke and restore (M3; US5)

1. Confirm the server's write-ahead log archive runs every 15 minutes and the device's daily encrypted upload exists (download it: unreadable without the key).
2. Revoke a counter from the owner app. Expected: the counter locks with "This device was removed by the owner"; the at-risk report shows its last sync time and last bill numbers.
3. On a clean computer, follow the restore guide with a registration code. Expected: someone other than the builder has the shop billing within 30 minutes (SC-005); the next bill number follows the last one the server saw.

## 6. Both themes

Sync indicator, device and conflict screens on the desktop readable in System, Light and Dark; the phone apps follow the phone's light or dark setting.
