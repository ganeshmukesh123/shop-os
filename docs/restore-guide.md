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
4. Choose the newest `shopos-….sqlite` file (the file name has the date and time).
5. A window asks for **the last bill number you printed**. Look at your last printed bill (or your paper bill book) and type its number exactly, for example `C1/26-27/000126`. The window shows an example in your own number format.
6. Click **Restore and restart**. The app **replaces all current data** with the backup and restarts.
7. Check **Items** and look at the last bill you made. Anything entered after the backup's time is not in it.

### Why the app asks for the last bill number

A backup is a copy from an earlier time. Bills you printed after it was made are not in it, but their numbers are already on your customers' paper. If the app carried on from the backup, it would give a new bill a number that a customer already holds. So it continues **after** the number you type, and records the numbers in between as **lost in restore**, so the gap in the sequence is explained.

Example: the backup ended at bill `C1/26-27/000120`, and you printed bills 121 to 126 before the disk failed. You type `C1/26-27/000126`. The next bill is `C1/26-27/000127`, and 121 to 126 are recorded as lost in the restore.

- **If you cannot find the number**, leave the box empty. The app then skips the next 100 bill numbers and records them as lost. This protects only those 100 numbers: if more than 100 bills were printed after the backup was made, the next bill could repeat a number a customer already holds, so find the last printed bill (paper book, a customer's copy, WhatsApp shares) before restoring. It tells you this before it restarts.
- **If the number you type is not in your bill number format, is in another series, or is older than the backup's own last bill**, the app says so and changes nothing; correct it and try again.
- The numbers recorded as lost cannot be edited or deleted. _(Showing them as "Lost in restore" in the bill list needs the Bills screen, task T070, and is not built yet. Until then they are in the database only.)_
- _To be confirmed with the shop's CA: whether recording lost numbers like this is the right treatment for GST numbering (research D21)._

If you choose a file that is not a Shop OS backup, the app refuses it and changes nothing.

## What stays on your bills (retention)

A saved bill is never changed, even if a customer asks for their name to be removed. It keeps exactly what was printed on it for the period the law requires bills to be kept (72 months from the annual return due date, CGST Rule 56; this is still to be confirmed with the shop's CA). The only personal detail this version holds is the optional **customer name** typed on a bill; it stays with the bill. Shop OS stores no phone numbers or addresses of customers in this version. Everything else held about a person (from a later version, their party record) can be removed on request; the bill itself stays. Restoring a backup keeps your bills as they were printed.

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
