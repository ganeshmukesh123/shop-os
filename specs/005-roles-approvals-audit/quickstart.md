# Quickstart: validating feature 005

Prerequisites: 002 merged. Commands as in 001. Commands and codes: `contracts/ipc-commands.md`.

## 1. PIN sign-in and roles (M2; US1)

1. Start the app on a copy of a 001 database. Expected: "Owner set-up" first; set PIN 4826; a recovery code is shown once. 001 items and bills are still there.
2. Create one user per role. Sign in as each and try: Counter exports data; Godown creates a bill. Expected: both refused "Your role cannot do this".
3. Wait 5 minutes (setting lowered to 1 minute in the test). Expected: lock overlay over the half-made bill; after PIN the bill is still there.
4. Quick-switch to another user on the lock overlay. Expected: the bill stays; saving it records the new user; the switch is in the audit log.
5. Enter a wrong PIN 5 times. Expected: locked 30 seconds.
6. Open the database file with the `sqlite3` CLI. Expected: no PIN readable; `pin_hash` starts with `scrypt$`.
7. Owner removes `item.edit` from Manager while a manager has the item screen open. Expected: the manager's next save is refused; the permission change is audited.
8. Owner uses "Forgot PIN" with the recovery code. Expected: new PIN set, new recovery code shown, both audited.

## 2. Approvals (M3; US2)

1. Counter user sells below cost. Expected: approval prompt; owner PIN approves; the bill saves with the approval id; audit shows request and decision.
2. Same, owner rejects with reason "Price too low". Expected: line returns for correction.
3. Leave a request for 2 minutes. Expected: expired, action not saved.
4. Owner absent: Manager with delegated `cancel` approves a cancel. Expected: allowed; for a non-delegated kind, refused.
5. Requester tries to approve their own request. Expected: `SELF_APPROVAL`.
6. Counter user gives 4% on a bill (limit 3%). Expected: approval needed; a user-level limit of 5% for that user allows it.

## 3. Audit log (M3; US3)

1. Change an item price from ₹120 to ₹125. Expected: one entry with before 12000, after 12500, user, device, time.
2. Run `UPDATE audit_log SET reason = 'x'` and `DELETE FROM audit_log` with the `sqlite3` CLI on a test copy. Expected: both rejected by triggers (SC-002).
3. Alter a row's hash with triggers dropped (test copy only) and run `audit.verify`. Expected: break reported at that `seq` and an exception raised.
4. Set the computer clock back 20 minutes and change a price. Expected: a clock exception for the owner.

## 4. Cash and day-close (M4; US4)

1. Open with float ₹2,000. Cash sales ₹19,200, khata cash receipts ₹1,500 (after 004), refund ₹250 (after 003), cash out ₹1,000 expense, ₹3,000 deposit. Expected: expected cash ₹18,450.
2. Count ₹18,200 by denomination. Expected: -₹250 needs a reason; above the ₹200 threshold an owner exception appears.
3. Leave one UPI pending (after 003). Expected: listed at close.
4. Open the summary. Expected: sales by mode, pending UPI, credit, collections, returns, cancels, approvals, cash difference; each figure opens its documents. Time the close (SC-003, under 5 minutes).

## 5. Problem reports (M4; US5)

From the bill screen and the items screen send a text report, a photo report and a voice note. Expected: all three listed with screen, user and time; the microphone works only while the dialog is open.

## 6. Both themes

Sign-in, lock overlay, approval prompt, roles, audit, cash and day-close screens readable in System, Light and Dark.
