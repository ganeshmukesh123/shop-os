import {
  backupPlanRestoreInput,
  backupRestoreInput,
  settingsClockCheckInput,
  settingsUpdateInput,
  type BackupPlanRestoreInput,
  type BackupRestoreInput,
  type CommandName,
  type IBackupRestoreResult,
  type IRestorePreview,
} from "@shopos/core";
import type { ZodTypeAny } from "zod";
import { cmd, none } from "./command";
import type { Handlers, Services, Shell } from "./handlers";
import { assertPlanIsConfirmed, planRestoreFor, toRestorePreview } from "./restoreCommands";

/** settings.*, backup.* and system.* (theme commands excepted: they live in handlers.ts). */
export type SystemCommandName = Exclude<
  Extract<CommandName, `settings.${string}` | `backup.${string}` | `system.${string}`>,
  "settings.getTheme" | "settings.setTheme"
>;

type BackupCommandName = Extract<SystemCommandName, `backup.${string}`>;

/** backup.*: the backups and the restore, which never trusts a plan from the renderer. */
function createBackupHandlers(services: Services, shell: Shell): Pick<Handlers, BackupCommandName> {
  return {
    "backup.run": cmd<"backup.run">(none(), () => services.backup.run()),
    "backup.status": cmd<"backup.status">(none(), () => services.backup.status()),
    "backup.planRestore": cmd<"backup.planRestore">(
      backupPlanRestoreInput,
      async (commandInput: BackupPlanRestoreInput): Promise<IRestorePreview> =>
        toRestorePreview(await planRestoreFor(commandInput, new Date())),
    ),
    "backup.restore": cmd<"backup.restore">(
      backupRestoreInput,
      async (commandInput: BackupRestoreInput): Promise<IBackupRestoreResult> => {
        // Worked out again, never taken from the renderer; nothing is touched unless it still matches.
        const numbering = await planRestoreFor(commandInput, new Date());
        assertPlanIsConfirmed(numbering, commandInput.confirmedPreview);
        shell.scheduleRestore(commandInput.filePath, numbering);
        return { restored: true, ...toRestorePreview(numbering) };
      },
    ),
  };
}

export function createSystemHandlers(
  services: Services,
  shell: Shell,
): Pick<Handlers, SystemCommandName> {
  return {
    "settings.get": cmd<"settings.get">(none(), () => services.settings.get()),
    "settings.update": cmd<"settings.update">(settingsUpdateInput, (commandInput) =>
      services.settings.update(commandInput),
    ),
    "settings.clockCheck": cmd<"settings.clockCheck">(
      settingsClockCheckInput,
      (commandInput: { deviceTimeZone: string }) =>
        services.settings.clockCheck(commandInput.deviceTimeZone),
    ),
    ...createBackupHandlers(services, shell),
    "system.pickFolder": cmd<"system.pickFolder">(none(), async () => ({
      path: await shell.pickFolder(),
    })),
    "system.pickBackupFile": cmd<"system.pickBackupFile">(none(), async () => ({
      path: await shell.pickBackupFile(),
    })),
    "system.pickPdfPath": cmd<"system.pickPdfPath">(
      { parse: (rawInput: unknown) => rawInput } as ZodTypeAny,
      async (commandInput: { defaultName: string }) => ({
        path: await shell.pickPdfPath(commandInput.defaultName),
      }),
    ),
  };
}
