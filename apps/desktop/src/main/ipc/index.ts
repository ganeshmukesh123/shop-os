import { ipcMain } from "electron";
import { COMMAND_NAMES } from "@shopos/core";
import { createHandlers, type Services, type Shell } from "./handlers";
import { REFUSED_COMMAND_MESSAGE } from "./senderPolicy/constants";
import { isTrustedSender, summarizeSender } from "./senderPolicy/senderPolicy";
import type { ISenderEvent } from "./senderPolicy/types";

export const CHANNEL = "shopos:invoke";

/** The refusal is logged with the page address only: never the command input (customer data). */
function logRefusedSender(event: ISenderEvent, logRefusal: (message: string) => void): void {
  const senderAddress = summarizeSender(event)?.url ?? "no sender frame";
  logRefusal(`Refused a command from an untrusted sender: ${senderAddress}`);
}

/**
 * Register one IPC entry point. It only dispatches the commands listed in the contract, and only
 * for the main frame showing one of the trusted pages (security checklist item 17, FR-001).
 */
export function registerIpc(
  services: Services,
  shell: Shell,
  trustedPageUrls: readonly string[],
  logRefusal: (message: string) => void = console.warn,
): void {
  const handlers = createHandlers(services, shell);
  const allowed = new Set<string>(COMMAND_NAMES);
  ipcMain.handle(CHANNEL, (event: ISenderEvent, name: unknown, input: unknown) => {
    const isSenderTrusted = isTrustedSender(summarizeSender(event), trustedPageUrls);
    if (!isSenderTrusted) {
      logRefusedSender(event, logRefusal);
      return { ok: false, code: "INTERNAL", message: REFUSED_COMMAND_MESSAGE };
    }
    if (typeof name !== "string" || !allowed.has(name)) {
      return { ok: false, code: "INTERNAL", message: "Unknown command" };
    }
    return handlers[name as keyof typeof handlers](input);
  });
}
