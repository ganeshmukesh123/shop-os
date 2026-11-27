import type Database from "better-sqlite3";
import { DEFAULT_TIME_ZONE } from "@shopos/core";

export interface IBackupNumberingSettings {
  seriesCode: string;
  numberTemplate: string;
  timeZone: string;
}

/**
 * Reads what a restore needs to know from a backup file, whatever version of the schema it has.
 * Read only: it never writes to the file it is given.
 */
export class BackupInspectionRepository {
  constructor(private readonly backupDatabase: Database.Database) {}

  private tableColumns(tableName: string): string[] {
    const columnRows = this.backupDatabase.pragma(`table_info(${tableName})`) as { name: string }[];
    return columnRows.map((columnRow) => columnRow.name);
  }

  /** The shop's series code, number format and time zone (older backups have no time zone). */
  readNumberingSettings(): IBackupNumberingSettings {
    const hasTimeZone = this.tableColumns("shop_profile").includes("time_zone");
    const profileRow = this.backupDatabase
      .prepare(
        `select series_code, number_template, ${hasTimeZone ? "time_zone" : `'${DEFAULT_TIME_ZONE}'`} as time_zone from shop_profile`,
      )
      .get() as { series_code: string; number_template: string; time_zone: string } | undefined;
    if (!profileRow) throw new Error("the backup has no shop profile");
    return {
      seriesCode: profileRow.series_code,
      numberTemplate: profileRow.number_template,
      timeZone: profileRow.time_zone,
    };
  }

  /** The latest financial year in which the backup issued a number for this counter, or null. */
  latestFinancialYear(counterCode: string): string | null {
    const hasNumberSeries = this.tableColumns("number_series").length > 0;
    const yearQuery = hasNumberSeries
      ? "select financial_year from number_series where counter_code = ? and last_seq > 0 order by substr(financial_year, 1, 2) desc limit 1"
      : "select financial_year from number_counter where series_code = ? and last_seq > 0 order by substr(financial_year, 1, 2) desc limit 1";
    const yearRow = this.backupDatabase.prepare(yearQuery).get(counterCode) as
      { financial_year: string } | undefined;
    return yearRow?.financial_year ?? null;
  }

  /** The last number the backup issued in a series, or 0 when it has no such series (older backups call it a counter). */
  lastSeq(counterCode: string, financialYear: string): number {
    const hasNumberSeries = this.tableColumns("number_series").length > 0;
    const seriesQuery = hasNumberSeries
      ? "select last_seq from number_series where counter_code = ? and financial_year = ?"
      : "select last_seq from number_counter where series_code = ? and financial_year = ?";
    const seriesRow = this.backupDatabase.prepare(seriesQuery).get(counterCode, financialYear) as
      { last_seq: number } | undefined;
    return seriesRow?.last_seq ?? 0;
  }
}
