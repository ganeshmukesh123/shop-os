import fs from "node:fs";
import path from "node:path";
import {
  CoreError,
  assertNotAfterCurrentYear,
  assertNotBeforeBackupYear,
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
import { restoreBackup, validateBackupFile } from "../BackupService";
import { EXAMPLE_SEQ, PREPARED_COPY_SUFFIX } from "./RestoreNumbering.constants";
import type { IRestoreNumberingPlan, IRestoreTarget } from "./RestoreNumbering.types";
import { readDatabaseFile, withBackupCopy } from "./backupCopy";

interface ISeriesChoice {
  counterCode: string;
  financialYear: string;
  /** The last number the owner says was issued, or null when they cannot say. */
  confirmedSeq: number | null;
}

/**
 * The plan was made from the file earlier; refuse if the copy now ends elsewhere, because applying
 * it would move the counter to a number the backup already used.
 */
function assertPlanMatchesCopy(preparedFile: string, plan: IRestoreNumberingPlan): void {
  const copyLastSeq = readDatabaseFile(preparedFile, (database) =>
    new BackupInspectionRepository(database).lastSeq(plan.counterCode, plan.financialYear),
  );
  const isSameBackup = copyLastSeq === plan.restoredLastSeq;
  if (isSameBackup) {
    return;
  }
  throw new CoreError(
    "INVALID_BACKUP",
    "The backup file changed after it was checked. Choose it again.",
  );
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
  currentYear: string,
): ISeriesChoice {
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
  const typedYear = parsed.financialYear ?? currentYear;
  assertNotAfterCurrentYear(typedYear, currentYear);
  return { counterCode: settings.seriesCode, financialYear: typedYear, confirmedSeq: parsed.seq };
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
): Promise<IRestoreNumberingPlan> {
  return withBackupCopy(backupFile, (copyDatabase) => {
    const inspection = new BackupInspectionRepository(copyDatabase);
    const settings = inspection.readNumberingSettings();
    const currentYear = currentFinancialYear(settings.timeZone, now);
    const series = chooseSeries(settings, lastIssuedBillNo, currentYear);
    const isTypedNumber = series.confirmedSeq !== null;
    if (isTypedNumber) {
      assertNotBeforeBackupYear(
        series.financialYear,
        inspection.latestFinancialYear(series.counterCode),
      );
    }
    const restoredLastSeq = inspection.lastSeq(series.counterCode, series.financialYear);
    const gap = planNumberGap(restoredLastSeq, series.confirmedSeq);
    // Billing numbers the next bill in the year of its own date, which is the current year, even when
    // the lost range belongs to last year (a last bill typed from March, restored in May).
    const isCurrentYearSeries = series.financialYear === currentYear;
    const currentYearLastSeq = isCurrentYearSeries
      ? (gap?.newLastSeq ?? restoredLastSeq)
      : inspection.lastSeq(series.counterCode, currentYear);
    return {
      counterCode: series.counterCode,
      financialYear: series.financialYear,
      template: settings.numberTemplate,
      restoredLastSeq,
      gap,
      nextBillNo: formatBillNumber(
        settings.numberTemplate,
        series.counterCode,
        currentYear,
        currentYearLastSeq + 1,
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
  validateBackupFile(backupFile); // INVALID_BACKUP before a copy is made
  const preparedFile = `${target.databasePath}${PREPARED_COPY_SUFFIX}-${process.pid}`;
  try {
    fs.mkdirSync(path.dirname(target.databasePath), { recursive: true });
    fs.copyFileSync(backupFile, preparedFile);
    assertPlanMatchesCopy(preparedFile, plan);
    applyNumbering(preparedFile, target.migrationsFolder, plan, now);
    restoreBackup(preparedFile, target.databasePath);
  } finally {
    removePreparedCopy(preparedFile);
  }
}
