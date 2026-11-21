# Quickstart: validating feature 013

Prerequisites: 010, 011 and 012 merged; Gate 3 passed. Commands: 010's server commands plus `contracts/admin-and-api.md`.

## 1. Separation (M1; US1)

1. Create business A (two shops) and business B with overlapping item names ("PVC Pipe 1 in") and users.
2. Run the cross-tenant suite (`pnpm --filter @shopos/server test:tenancy` and `pnpm --filter @shopos/desktop test:tenancy`). Expected: every route with B's token and A's ids returns 404; no report, export, pull, snapshot or backup of B contains A's rows (SC-001).
3. A counter of shop A1 pulls. Expected: business A's items and parties, shop A1's bills only (not A2's).
4. Each shop has its own registration, series and locations.

## 2. Onboard a pilot shop (M2; US2)

1. `admin create-business`, `create-shop`; register a counter with the code.
2. Import the plumbing starter file through 002's import. Expected: preview marks rows unverified; HSN left blank for the CA.
3. Follow readiness, sign-off, training (012) and save the first real bill. Expected: all onboarding steps complete within one working day (SC-002); tinting and delivery stay switched off.
4. Send a problem report. Expected: `admin reports` lists it with shop, user and screen.

## 3. Usage and retention (M3; US3)

With generated activity for 10 shops over 8 weeks, run `admin usage --cohort`. Expected: active days, bills, share billed per shop per week; the week-8 count against 7 of 10; no names or phones in the output.

## 4. Plans (M4; US4)

1. Offer a plan; record "accepted" for 7 of 10 test shops. Expected: the count shown against SC-004.
2. Let a subscription lapse and move the clock past the 14-day grace. Expected: premium features pause; billing, stock, khata, backup and `data.exportAll` still work.

## 5. Support access and exit

1. `support request` for 2 hours; the owner approves on the phone. Expected: reads work and each is logged; after 2 hours they stop; the owner can revoke earlier.
2. Exit A1 from business A, which also has A2. Open the SQLite and CSV exports: all A1 facts and settings and the shared master data are present; no A2 facts or settings are present. Before receipt is confirmed, nothing is deleted. After confirmation and deletion under D8, A1's devices keep local data; the server and retained recovery copies contain no A1 shop data except required retention. A2 can still sync and restore with all its data and shared master data.
3. Repeat for a whole-business exit. Expected: the export covers the whole business; after confirmation, deletion covers that business under D8 and leaves other businesses untouched.
