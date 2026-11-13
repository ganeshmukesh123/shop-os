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
5. Confirm. The app **replaces all current data** with the backup and restarts.
6. Check **Items** and look at the last bill you made. Anything entered after the backup's time is not in it.

If you choose a file that is not a Shop OS backup, the app refuses it and changes nothing.

## First run on a Mac (unsigned build)

If macOS says the app "cannot be opened because the developer cannot be verified": right-click the app, choose **Open**, then **Open** again. You only need to do this once.

## Disk encryption

The database file is not encrypted by Shop OS in this version. Turn on your computer's disk encryption (FileVault on Mac, BitLocker on Windows) if the computer may be lost or stolen.

## Not yet tested

This guide has not yet been followed by someone other than the builder on a clean machine. That check is still to be done (task T063).
