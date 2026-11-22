# Shop OS: backup and restore guide

For the shop owner. Keep this page where you can find it.

## Where your data lives

- **Live data**: one file called `shopos.sqlite` in the app's data folder.
  - Mac: `~/Library/Application Support/Shop OS/`
  - Windows: `%APPDATA%\Shop OS\`
  - Linux: `~/.config/Shop OS/`
- **Backups**: the folder you chose in **Settings > Backup**. Pick a folder on a **different drive** (a USB drive or second disk), not the same disk as the live data.
- Files are named `shopos-YYYYMMDD-HHMMSS.sqlite`. The app keeps the newest copy of each of the last 30 days, plus the last 4 of today.

## Set up backups (do this on day one)

1. Open **Settings**, scroll to **Backup**.
2. Click **Choose folder** and pick a folder on a second drive.
3. Click **Back up now**. You should see "Backup complete" and a "Last good backup" time.

The app then backs up every 15 minutes while it is open and once more when you close it. If a backup fails, **Settings** shows a red "Last backup failed" message. Check it at the start of each week.

## Check that backups are working

Open **Settings > Backup**. "Last good backup" should show today's date and a recent time. If it says "No backup yet" or the time is old, click **Back up now** and read any error message.

## Restore on a new or repaired computer

1. Install Shop OS. Open it once, then continue.
2. Plug in the drive that holds the backups.
3. Open **Settings > Backup > Restore from file**.
4. Copy the backup file you want to restore (pick it by the date and time in its name) to a folder **outside** the backup folder, for example the Desktop. The app prunes old backups in its backup folder automatically, so a file left there can be deleted by the next backup.
5. If this computer still holds data you may need (for example, the owner PIN and recovery code are lost and you want the current data kept), click **Back up now** in **Settings > Backup** and wait for "Backup complete". If it shows an error instead, **stop here** and do not restore. Then copy that new backup file outside the backup folder too. Do not copy `shopos.sqlite` by hand.
6. In **Restore from file**, choose the file you copied in step 4.
7. Confirm. The app **replaces all current data** with the backup and restarts.
8. Check **Items** and look at the last bill you made. Anything entered after the backup's time is not in it.

If you choose a file that is not a Shop OS backup, the app refuses it and changes nothing.

## Owner access after restore (planned for feature 005)

Before you need a restore, create a second trusted Owner with a separate PIN, verify they can sign in, and take a backup containing both owners. Keep recovery codes separately from backups.

Restoring also restores the users and credentials as of the backup date. Use **Forgot PIN** with the recovery code valid for that copy if available. If both PIN and code are lost, use the current database if it is intact, or the copy made in step 5 of the restore (kept outside the backup folder). If restoring damaged data, keep the original and work on a separate copy. Have the other active Owner sign in with their own PIN, open **Users**, and create a replacement Owner. Save the new recovery code, verify the new Owner can sign in, then deactivate the inaccessible account. Its history and the restored shop records stay in place; owner creation and deactivation are audited.

First-run setup refuses any database that already contains users. Without another valid owner credential, keep the database and backups until a credential is found. Reinstallation and possession of a backup do not authorize a new owner.

## First run on a Mac (the build is not notarised)

Shop OS is signed on the builder's computer without an Apple developer account, so macOS shows "cannot be opened because the developer cannot be verified" (or "Apple could not verify..."). Do this once, after dragging **Shop OS** into **Applications**:

1. Try to open the app, then click **Done** (not Move to Bin).
2. Open **System Settings > Privacy & Security**, scroll down to the line about "Shop OS" and click **Open Anyway**. Enter your Mac password.
3. Open the app again and click **Open**.

On older macOS (14 and earlier) right-clicking the app and choosing **Open** also works. If neither works, open Terminal and run: `xattr -dr com.apple.quarantine "/Applications/Shop OS.app"`, then open the app.

_(Written from how the build behaves on the builder's Mac; the exact wording of these steps is still to be confirmed on a second Mac, see task T062.)_

## Disk encryption

The database file is not encrypted by Shop OS in this version. Turn on your computer's disk encryption (FileVault on Mac, BitLocker on Windows) if the computer may be lost or stolen.

## Not yet tested

This guide has not yet been followed by someone other than the builder on a clean machine. That check is still to be done (task T063).
