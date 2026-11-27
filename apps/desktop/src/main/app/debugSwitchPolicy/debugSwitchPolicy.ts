import type { App } from "electron";
import { FORBIDDEN_DEBUG_SWITCHES } from "./constants";
import type { HasCommandLineSwitch, IDebugSwitchContext } from "./types";

/** The DevTools switch a packaged release was started with, or undefined when it may start. */
export function findForbiddenDebugSwitch(
  hasSwitch: HasCommandLineSwitch,
  context: IDebugSwitchContext,
): string | undefined {
  const isGuarded = context.isPackaged && !context.allowsDebugSwitches;
  return isGuarded ? FORBIDDEN_DEBUG_SWITCHES.find(hasSwitch) : undefined;
}

/**
 * Exits a packaged release started with a DevTools switch, before the database opens or a window
 * shows. Chromium opens the port before this code runs; exiting closes it. Returns true when the
 * app may start, false when it is exiting.
 */
export function isStartAllowedBySwitches(
  app: Pick<App, "isPackaged" | "commandLine" | "exit">,
  allowsDebugSwitches: boolean,
  logRefusal: (message: string) => void = console.error,
): boolean {
  const forbiddenSwitch = findForbiddenDebugSwitch(
    (switchName) => app.commandLine.hasSwitch(switchName),
    { isPackaged: app.isPackaged, allowsDebugSwitches },
  );
  const isStartedWithForbiddenSwitch = forbiddenSwitch !== undefined;
  if (isStartedWithForbiddenSwitch) {
    logRefusal(`Shop OS will not start with --${forbiddenSwitch}`);
    app.exit(1);
  }
  return forbiddenSwitch === undefined;
}
