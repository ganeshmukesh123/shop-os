import { COMMAND_NAMES, type ShopOsApi } from "@shopos/core/commands";

export const IPC_CHANNEL = "shopos:invoke";

export type InvokeOnMainProcess = (
  channel: string,
  commandName: string,
  input: unknown,
) => Promise<unknown>;

/** Narrow bridge: exactly the commands in contracts/ipc-commands.md, nothing else. */
export function buildShopOsApi(invoke: InvokeOnMainProcess): ShopOsApi {
  return Object.fromEntries(
    COMMAND_NAMES.map((commandName) => [
      commandName,
      (input: unknown) => invoke(IPC_CHANNEL, commandName, input ?? {}),
    ]),
  ) as unknown as ShopOsApi;
}
