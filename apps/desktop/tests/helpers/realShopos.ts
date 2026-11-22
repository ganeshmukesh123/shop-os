import type { CommandName } from "@shopos/core/commands";
import { buildShopOsApi } from "../../src/preload/bridge";
import {
  buildHandlersFixture,
  type IFixtureOptions,
  type IHandlersFixture,
} from "./handlersFixture";

/** 18 Nov 2026, 10:30 in the shop's zone (IST): financial year 26-27, so the first bill is C1/26-27/000001. */
export const SHOP_DAY = new Date(Date.UTC(2026, 10, 18, 5, 0));

export interface IRealShopos {
  fixture: IHandlersFixture;
  /** Counts rows in one table of the real database, optionally filtered by a SQL condition. */
  countRows: (tableName: string, condition?: string) => number;
  /** Runs the command for real, then throws as if the reply was lost on the way back (a retry case). */
  loseNextReplyOf: (commandName: CommandName) => void;
}

type RawHandler = (commandInput: unknown) => Promise<unknown>;

/**
 * Wires `window.shopos` to the real IPC handlers, services and an in-memory SQLite database, so a
 * screen test goes through the same Zod checks and transactions as the app. Only the Electron transport
 * and the native dialogs are replaced (the dialogs by the handlers fixture's recording fakes).
 */
export function installRealShopos(options: IFixtureOptions = {}): IRealShopos {
  const fixture = buildHandlersFixture(options);
  const lostReplies = new Set<string>();
  const handlers = fixture.handlers as Record<string, RawHandler>;

  const invoke = async (_channel: string, commandName: string, input: unknown) => {
    const response = await handlers[commandName]!(input);
    const isReplyLost = lostReplies.delete(commandName);
    if (isReplyLost) throw new Error(`The reply to ${commandName} was lost`);
    return response;
  };
  window.shopos = buildShopOsApi(invoke);

  const countRows = (tableName: string, condition = "1 = 1") =>
    (
      fixture.testDb.sqlite
        .prepare(`select count(*) as rowCount from ${tableName} where ${condition}`)
        .get() as { rowCount: number }
    ).rowCount;

  return {
    fixture,
    countRows,
    loseNextReplyOf: (commandName) => lostReplies.add(commandName),
  };
}

/** Fixes only the date, so bill numbers and dates repeat; timers stay real for the user events. */
export function freezeShopClock(instant: Date = SHOP_DAY): void {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(instant);
}

export async function createItemDirectly(
  realShopos: IRealShopos,
  item: { name: string; unit: string; pricePaise: number; openingQtyMilli: number },
): Promise<string> {
  const created = await realShopos.fixture.handlers["items.create"](item);
  if (!created.ok) throw new Error(created.message);
  return created.data.item.id;
}
