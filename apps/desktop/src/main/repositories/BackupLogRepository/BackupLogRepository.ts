import { desc, eq } from "drizzle-orm";
import type { Handle } from "../../db/connection";
import { newId, nowMs } from "../../db/ids";
import { backupLog } from "../../db/schema";
import type { Ctx } from "../../db/seed";

export interface IBackupLogEntry {
  path: string;
  startedAt: string;
  finishedAt: string;
  status: "ok" | "failed";
  error?: string;
}

type BackupLogRow = typeof backupLog.$inferSelect;

/** Every backup attempt, kept so the screen can show the last good copy and the last error. */
export class BackupLogRepository {
  constructor(
    private readonly databaseHandle: Handle,
    private readonly ctx: Ctx,
  ) {}

  append(entry: IBackupLogEntry): void {
    const now = nowMs();
    this.databaseHandle
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

  lastSucceeded(): BackupLogRow | undefined {
    return this.databaseHandle
      .select()
      .from(backupLog)
      .where(eq(backupLog.status, "ok"))
      .orderBy(desc(backupLog.createdAt), desc(backupLog.id))
      .get();
  }

  lastAttempt(): BackupLogRow | undefined {
    return this.databaseHandle
      .select()
      .from(backupLog)
      .orderBy(desc(backupLog.createdAt), desc(backupLog.id))
      .get();
  }
}
