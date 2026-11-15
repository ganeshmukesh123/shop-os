import type { CommandMap, CommandName } from "@shopos/core/commands";
import { buildShopOsApi } from "../../src/preload/bridge";

/** What a test supplies for a command: the data, given the input the screen sent. */
export type FakeCommandHandlers = {
  [K in CommandName]?: (input: CommandMap[K][0]) => CommandMap[K][1] | Promise<CommandMap[K][1]>;
};

export interface IFakeShopos {
  /** Every command the screen sent, in order, with its input. */
  calls: { commandName: string; input: unknown }[];
}

/**
 * Installs a typed `window.shopos` built by the real bridge, so the screen goes through the same
 * command list as production. A command with no handler answers with an INTERNAL error result.
 */
export function installFakeShopos(handlers: FakeCommandHandlers = {}): IFakeShopos {
  const calls: IFakeShopos["calls"] = [];
  const invoke = async (_channel: string, commandName: string, input: unknown) => {
    calls.push({ commandName, input });
    const handler = (handlers as Record<string, ((commandInput: unknown) => unknown) | undefined>)[
      commandName
    ];
    return handler
      ? { ok: true, data: await handler(input) }
      : { ok: false, code: "INTERNAL", message: `no fake for ${commandName}` };
  };
  window.shopos = buildShopOsApi(invoke);
  return { calls };
}
