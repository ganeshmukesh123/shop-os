import { ipcMain } from "electron";
import { COMMAND_NAMES } from "@shopos/core";
import { createHandlers, type Services, type Shell } from "./handlers";

export const CHANNEL = "shopos:invoke";

/** Register one IPC entry point; it only dispatches the commands listed in the contract. */
export function registerIpc(services: Services, shell: Shell): void {
  const handlers = createHandlers(services, shell);
  const allowed = new Set<string>(COMMAND_NAMES);
  ipcMain.handle(CHANNEL, (_event, name: unknown, input: unknown) => {
    if (typeof name !== "string" || !allowed.has(name)) {
      return { ok: false, code: "INTERNAL", message: "Unknown command" };
    }
    return handlers[name as keyof typeof handlers](input);
  });
}
