import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import {
  CoreError,
  DEFAULT_TIME_ZONE,
  businessDateOf,
  financialYearOfBusinessDate,
  formatBillNumber,
  isValidTimeZone,
  parseBillNumber,
  planNumberGap,
} from "@shopos/core";
import { openDatabase } from "../../db/connection";
import { loadCtx } from "../../db/seed";
import {
  BackupInspectionRepository,
  type IBackupNumberingSettings,
} from "../../repositories/BackupInspectionRepository";
import { NumberGapRepository } from "../../repositories/NumberGapRepository";
import { restoreBackup } from "../BackupService";
import { EXAMPLE_SEQ, PREPARED_COPY_SUFFIX } from "./RestoreNumbering.constants";
import type { IRestoreNumberingPlan, IRestoreTarget } from "./RestoreNumbering.types";

interface ISeriesChoice {
  counterCode: string;
  financialYear: string;
  /** The last number the owner says was issued, or null when they cannot say. */
  confirmedSeq: number | null;
}

/** Open a throwaway copy of the backup in the system temp folder, so the backup itself is never touched. */
function withBackupCopy<Result>(
  backupFile: string,
  readCopy: (copyDatabase: Database.Database) => Result,
): Result {
  const copyFolder = fs.mkdtempSync(path.join(os.tmpdir(), "shopos-plan-"));
  const copyFile = path.join(copyFolder, "backup.sqlite");
  fs.copyFileSync(backupFile, copyFile);
  const copyDatabase = new Database(copyFile, { fileMustExist: true });
  try {
    return readCopy(copyDatabase);
  } finally {
    copyDatabase.close();
    fs.rmSync(copyFolder, { recursive: true, force: true });
  }
}

function currentFinancialYear(timeZone: string, now: Date): string {
  const zone = isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
  return financialYearOfBusinessDate(businessDateOf(now.getTime(), zone));
}

/**
 * Which series the lost numbers belong to. The owner's typed number names the financial year and the
 * last sequence; with nothing typed it is the shop's series in the current financial year.
 */
function chooseSeries(
  settings: IBackupNumberingSettings,
  lastIssuedBillNo: string | null,
  now: Date,
): ISeriesChoice {
  const currentYear = currentFinancialYear(settings.timeZone, now);
  const typedNumber = lastIssuedBillNo?.trim() ?? "";
  if (typedNumber === "") {
    return { counterCode: settings.seriesCode, financialYear: currentYear, confirmedSeq: null };
  }
  const parsed = parseBillNumber(settings.numberTemplate, typedNumber);
  if (!parsed) {
    const example = formatBillNumber(
      settings.numberTemplate,
      settings.seriesCode,
      currentYear,
      EXAMPLE_SEQ,
    );
    throw new CoreError(
      "INVALID_FIELD",
      `That is not a bill number in this shop's format. It looks like ${example}.`,
    );
  }
  if (parsed.seriesCode !== null && parsed.seriesCode !== settings.seriesCode) {
    throw new CoreError(
      "INVALID_FIELD",
      `That bill number is in series ${parsed.seriesCode}, but this shop's series is ${settings.seriesCode}.`,
    );
  }
  return {
    counterCode: settings.seriesCode,
    financialYear: parsed.financialYear ?? currentYear,
    confirmedSeq: parsed.seq,
  };
}

/**
 * Work out, from the backup file alone, which bill numbers a restore would lose and what the next bill
 * will be called (FR-013b, EC-19, research D21). Changes nothing. Throws INVALID_FIELD for a number
 * that is not in the shop's format, is in another series, or is older than the backup's last bill.
 */
export function planRestoreNumbering(
  backupFile: string,
  lastIssuedBillNo: string | null,
  now: Date,
): IRestoreNumberingPlan {
  return withBackupCopy(backupFile, (copyDatabase) => {
    const inspection = new BackupInspectionRepository(copyDatabase);
    const settings = inspection.readNumberingSettings();
    const series = chooseSeries(settings, lastIssuedBillNo, now);
    const restoredLastSeq = inspection.lastSeq(series.counterCode, series.financialYear);
    const gap = planNumberGap(restoredLastSeq, series.confirmedSeq);
    const nextSeq = (gap?.newLastSeq ?? restoredLastSeq) + 1;
    return {
      counterCode: series.counterCode,
      financialYear: series.financialYear,
      template: settings.numberTemplate,
      restoredLastSeq,
      gap,
      nextBillNo: formatBillNumber(
        settings.numberTemplate,
        series.counterCode,
        series.financialYear,
        nextSeq,
      ),
    };
  });
}

/** Bring the copy up to the current schema, then record the gap and move the counter, in one transaction. */
function applyNumbering(
  preparedFile: string,
  migrationsFolder: string,
  plan: IRestoreNumberingPlan,
  now: Date,
): void {
  const connection = openDatabase(preparedFile, { migrationsFolder });
  try {
    const shopContext = loadCtx(connection.db);
    const nowMs = now.getTime();
    const { gap } = plan;
    if (gap) {
      connection.db.transaction((transaction) => {
        const repository = new NumberGapRepository(transaction, shopContext);
        const series = repository.ensureSeries(
          plan.counterCode,
          plan.financialYear,
          plan.template,
          nowMs,
        );
        repository.recordGap(series.id, gap, nowMs);
        repository.setLastSeq(series.id, gap.newLastSeq, plan.template, nowMs);
      });
    }
    connection.sqlite.pragma("wal_checkpoint(TRUNCATE)"); // nothing may stay behind in the -wal file
  } finally {
    connection.sqlite.close();
  }
}

function removePreparedCopy(preparedFile: string): void {
  [preparedFile, `${preparedFile}-wal`, `${preparedFile}-shm`].forEach((file) =>
    fs.rmSync(file, { force: true }),
  );
}

/**
 * Replace the database at `target.databasePath` with the backup, with the lost numbers recorded and the
 * counter moved past them. The work is done on a prepared copy beside the database and only a finished
 * copy is put in place, so a failure leaves the live database exactly as it was. The caller must have
 * closed the live database first.
 */
export function restoreWithNumbering(
  backupFile: string,
  target: IRestoreTarget,
  plan: IRestoreNumberingPlan,
  now: Date,
): void {
  const preparedFile = `${target.databasePath}${PREPARED_COPY_SUFFIX}-${process.pid}`;
  try {
    fs.mkdirSync(path.dirname(target.databasePath), { recursive: true });
    fs.copyFileSync(backupFile, preparedFile);
    applyNumbering(preparedFile, target.migrationsFolder, plan, now);
    restoreBackup(preparedFile, target.databasePath);
  } finally {
    removePreparedCopy(preparedFile);
  }
}
