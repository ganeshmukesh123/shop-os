import fs from "node:fs";
import path from "node:path";
import { desc, eq } from "drizzle-orm";
import Database from "better-sqlite3";
import { CoreError } from "@shopos/core";
import type { DB } from "../db/connection";
import { newId, nowIso } from "../db/ids";
import { backupLog } from "../db/schema";
import type { Ctx } from "../db/seed";
import { SettingsRepository } from "../repositories/SettingsRepository";

const KEEP_DAYS = 30;
const KEEP_TODAY = 4;
const NAME_RE = /^shopos-(\d{8})-(\d{6})\.sqlite$/;
const pad = (numberValue: number) => String(numberValue).padStart(2, "0");
const stamp = (backupTime: Date) =>
  `${backupTime.getFullYear()}${pad(backupTime.getMonth() + 1)}${pad(backupTime.getDate())}-${pad(backupTime.getHours())}${pad(backupTime.getMinutes())}${pad(backupTime.getSeconds())}`;

/** A file is a usable backup only if SQLite opens it, integrity_check passes and our tables exist. */
export function validateBackupFile(file: string): void {
  let db: Database.Database | undefined;
  try {
    db = new Database(file, { readonly: true, fileMustExist: true });
    if (db.pragma("integrity_check", { simple: true }) !== "ok")
      throw new Error("integrity check failed");
    const names = new Set(
      (
        db.prepare("select name from sqlite_master where type='table'").all() as { name: string }[]
      ).map((tableRow) => tableRow.name),
    );
    for (const tableName of ["bill", "bill_line", "stock_movement", "shop_profile"]) {
      if (!names.has(tableName)) throw new Error(`missing table ${tableName}`);
    }
    // A backup taken before the item split (D18) still has `item`; the next start upgrades it.
    if (!names.has("item_variant") && !names.has("item")) throw new Error("missing table item");
  } catch (caughtError) {
    throw new CoreError(
      "INVALID_BACKUP",
      `This is not a valid Shop OS backup (${caughtError instanceof Error ? caughtError.message : String(caughtError)})`,
    );
  } finally {
    db?.close();
  }
}

/**
 * Replace the live database file with a validated backup. The caller must have closed the live
 * database first. The backup is copied beside the target and renamed into place, so a failure
 * leaves the old file untouched.
 */
export function restoreBackup(backupFile: string, liveDbPath: string): void {
  validateBackupFile(backupFile);
  const tmp = `${liveDbPath}.restore-${process.pid}`;
  fs.copyFileSync(backupFile, tmp);
  fs.rmSync(`${liveDbPath}-wal`, { force: true });
  fs.rmSync(`${liveDbPath}-shm`, { force: true });
  fs.renameSync(tmp, liveDbPath);
}

export class BackupService {
  private readonly settings: SettingsRepository;

  constructor(
    private readonly sqlite: Database.Database,
    private readonly db: DB,
    private readonly ctx: Ctx,
    private readonly getFolder?: () => string,
  ) {
    this.settings = new SettingsRepository(db, ctx);
  }

  private folder(): string {
    return (this.getFolder ? this.getFolder() : this.settings.get().backupFolder).trim();
  }

  private log(entry: {
    path: string;
    startedAt: string;
    finishedAt: string;
    status: "ok" | "failed";
    error?: string;
  }): void {
    const now = nowIso();
    this.db
      .insert(backupLog)
      .values({
        id: newId(),
        businessId: this.ctx.businessId,
        shopId: this.ctx.shopId,
        createdAt: now,
        updatedAt: now,
        ...entry,
        error: entry.error ?? null,
      })
      .run();
  }

  /** Online backup through SQLite's backup API (never a file copy of the live database). */
  async run(now: Date = new Date()): Promise<{ path: string; finishedAt: string }> {
    const startedAt = nowIso();
    const folder = this.folder();
    let target = "";
    try {
      if (!folder) throw new Error("No backup folder is set");
      target = path.join(folder, `shopos-${stamp(now)}.sqlite`);
      fs.mkdirSync(folder, { recursive: true });
      await this.sqlite.backup(target);
      validateBackupFile(target);
      const finishedAt = nowIso();
      this.log({ path: target, startedAt, finishedAt, status: "ok" });
      this.prune(now);
      return { path: target, finishedAt };
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
      try {
        if (target) fs.rmSync(target, { force: true });
        this.log({
          path: target || folder,
          startedAt,
          finishedAt: nowIso(),
          status: "failed",
          error: message,
        });
      } catch {
        /* the log itself must never hide the original failure */
      }
      throw new CoreError("BACKUP_FAILED", message);
    }
  }

  /** Keep the newest copy of each of the last 30 days, plus the newest 4 of today. */
  prune(now: Date = new Date()): void {
    const folder = this.folder();
    if (!folder || !fs.existsSync(folder)) return;
    const entries = fs
      .readdirSync(folder)
      .map((fileName) => ({ fileName, nameMatch: NAME_RE.exec(fileName) }))
      .filter(
        (fileEntry): fileEntry is { fileName: string; nameMatch: RegExpExecArray } =>
          fileEntry.nameMatch !== null,
      )
      .sort((firstEntry, secondEntry) => secondEntry.fileName.localeCompare(firstEntry.fileName)); // newest first
    const today = stamp(now).slice(0, 8);
    const keep = new Set<string>();
    const seenDays: string[] = [];
    let todayKept = 0;
    for (const { fileName, nameMatch } of entries) {
      const day = nameMatch[1]!;
      if (day === today && todayKept < KEEP_TODAY) {
        keep.add(fileName);
        todayKept++;
      }
      if (!seenDays.includes(day)) {
        if (seenDays.length < KEEP_DAYS) {
          seenDays.push(day);
          keep.add(fileName);
        }
      }
    }
    for (const { fileName } of entries) {
      if (!keep.has(fileName)) fs.rmSync(path.join(folder, fileName), { force: true });
    }
  }

  status(): { lastOkAt: string | null; lastError: string | null; folder: string } {
    const lastOk = this.db
      .select()
      .from(backupLog)
      .where(eq(backupLog.status, "ok"))
      .orderBy(desc(backupLog.createdAt), desc(backupLog.id))
      .get();
    const last = this.db
      .select()
      .from(backupLog)
      .orderBy(desc(backupLog.createdAt), desc(backupLog.id))
      .get();
    return {
      lastOkAt: lastOk?.finishedAt ?? null,
      lastError: last && last.status === "failed" ? last.error : null,
      folder: this.folder(),
    };
  }
}
