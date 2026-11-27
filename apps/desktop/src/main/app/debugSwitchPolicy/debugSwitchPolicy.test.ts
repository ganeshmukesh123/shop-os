import { isStartAllowedBySwitches, findForbiddenDebugSwitch } from "./debugSwitchPolicy";

// Spec 018 O15: the fuses do not stop Chromium's DevTools port, so a packaged release build refuses
// to run when started with one. The e2e build flavour (Playwright needs the port) allows it.
function buildSwitchReader(givenSwitches: readonly string[]): (switchName: string) => boolean {
  return (switchName) => givenSwitches.includes(switchName);
}

const PACKAGED_RELEASE = { isPackaged: true, allowsDebugSwitches: false };

describe("findForbiddenDebugSwitch (O15)", () => {
  it.each(["remote-debugging-port", "remote-debugging-pipe"])(
    "refuses a packaged release started with --%s",
    (switchName) => {
      const forbiddenSwitch = findForbiddenDebugSwitch(
        buildSwitchReader([switchName]),
        PACKAGED_RELEASE,
      );

      expect(forbiddenSwitch).toBe(switchName);
    },
  );

  it("lets a packaged release start with no debug switch", () => {
    const forbiddenSwitch = findForbiddenDebugSwitch(buildSwitchReader([]), PACKAGED_RELEASE);

    expect(forbiddenSwitch).toBeUndefined();
  });

  it("ignores ordinary switches such as --no-sandbox", () => {
    const forbiddenSwitch = findForbiddenDebugSwitch(
      buildSwitchReader(["no-sandbox", "lang"]),
      PACKAGED_RELEASE,
    );

    expect(forbiddenSwitch).toBeUndefined();
  });

  it("allows the port in the e2e build flavour so Playwright can attach", () => {
    const forbiddenSwitch = findForbiddenDebugSwitch(buildSwitchReader(["remote-debugging-port"]), {
      isPackaged: true,
      allowsDebugSwitches: true,
    });

    expect(forbiddenSwitch).toBeUndefined();
  });

  it("allows the port when running unpackaged (pnpm dev and pnpm test:e2e)", () => {
    const forbiddenSwitch = findForbiddenDebugSwitch(buildSwitchReader(["remote-debugging-port"]), {
      isPackaged: false,
      allowsDebugSwitches: false,
    });

    expect(forbiddenSwitch).toBeUndefined();
  });
});

describe("isStartAllowedBySwitches", () => {
  function buildFakeApp(givenSwitches: readonly string[]) {
    return {
      isPackaged: true,
      commandLine: { hasSwitch: buildSwitchReader(givenSwitches) },
      exit: vi.fn(),
    } as unknown as Parameters<typeof isStartAllowedBySwitches>[0] & {
      exit: ReturnType<typeof vi.fn>;
    };
  }

  it("exits with code 1 and logs the switch name, without starting the app", () => {
    const fakeApp = buildFakeApp(["remote-debugging-port"]);
    const logRefusal = vi.fn();

    const isStartAllowed = isStartAllowedBySwitches(fakeApp, false, logRefusal);

    expect(isStartAllowed).toBe(false);
    expect(fakeApp.exit).toHaveBeenCalledWith(1);
    expect(logRefusal).toHaveBeenCalledWith("Shop OS will not start with --remote-debugging-port");
  });

  it("does nothing for a normal start", () => {
    const fakeApp = buildFakeApp([]);
    const logRefusal = vi.fn();

    const isStartAllowed = isStartAllowedBySwitches(fakeApp, false, logRefusal);

    expect(isStartAllowed).toBe(true);
    expect(fakeApp.exit).not.toHaveBeenCalled();
    expect(logRefusal).not.toHaveBeenCalled();
  });
});
