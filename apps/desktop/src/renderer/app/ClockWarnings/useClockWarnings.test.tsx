import { renderHook, waitFor } from "@testing-library/react";
import { installFakeShopos } from "../../../../tests/helpers/fakeShopos";
import { useClockWarnings } from "./useClockWarnings";

const DEVICE_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

describe("useClockWarnings (task T080)", () => {
  it("asks the main process with the zone this computer reports, and returns the warnings", async () => {
    const fake = installFakeShopos({
      "settings.clockCheck": () => ({ warnings: ["TIME_ZONE_DIFFERS"] }),
    });

    const { result } = renderHook(() => useClockWarnings("bill"));

    await waitFor(() => expect(result.current).toEqual(["TIME_ZONE_DIFFERS"]));
    expect(fake.calls).toEqual([
      { commandName: "settings.clockCheck", input: { deviceTimeZone: DEVICE_ZONE } },
    ]);
  });

  it("starts with no warning", () => {
    installFakeShopos({ "settings.clockCheck": () => ({ warnings: [] }) });

    const { result } = renderHook(() => useClockWarnings("bill"));

    expect(result.current).toEqual([]);
  });

  it("checks again when the screen changes, so a fixed setting clears the warning", async () => {
    let warnings: ("TIME_ZONE_DIFFERS" | "CLOCK_BEFORE_LAST_BILL")[] = ["TIME_ZONE_DIFFERS"];
    installFakeShopos({ "settings.clockCheck": () => ({ warnings }) });
    const { result, rerender } = renderHook(({ screenName }) => useClockWarnings(screenName), {
      initialProps: { screenName: "settings" },
    });
    await waitFor(() => expect(result.current).toEqual(["TIME_ZONE_DIFFERS"]));

    warnings = [];
    rerender({ screenName: "bill" });

    await waitFor(() => expect(result.current).toEqual([]));
  });

  it("shows no warning, and no error, when the check itself fails", async () => {
    const fake = installFakeShopos({});

    const { result } = renderHook(() => useClockWarnings("bill"));

    await waitFor(() => expect(fake.calls).toHaveLength(1));
    expect(result.current).toEqual([]);
  });
});
