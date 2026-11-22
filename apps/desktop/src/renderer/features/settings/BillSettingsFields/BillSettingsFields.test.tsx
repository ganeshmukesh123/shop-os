import { useState } from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ShopProfile } from "@shopos/core";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { BillSettingsFields } from "./BillSettingsFields";
import { isBillSettingsValid } from "./billSettingsValidity";
import type { BillSettings } from "./BillSettingsFields.types";

const DEFAULT_SETTINGS: BillSettings = {
  docTitle: "Estimate",
  roundBillTotal: true,
  timeZone: "Asia/Kolkata",
  receiptWidth: "80mm",
};

/** Holds the settings the way the Settings screen does, and shows what the parent would save. */
function Harness({ initial = DEFAULT_SETTINGS }: { initial?: BillSettings }) {
  const [settings, setSettings] = useState(initial);
  const patchSettings = (patch: Partial<ShopProfile>) => setSettings({ ...settings, ...patch });
  return (
    <>
      <BillSettingsFields settings={settings} onChange={patchSettings} />
      <output data-testid="saved">{JSON.stringify(settings)}</output>
    </>
  );
}

const savedSettings = (): BillSettings =>
  JSON.parse(screen.getByTestId("saved").textContent ?? "{}") as BillSettings;

describe("BillSettingsFields (task T080, FR-010a, FR-015a, FR-019a)", () => {
  it("shows the title, the rounding switch, the zone and the paper the shop has", () => {
    renderWithTheme(<Harness />);

    expect((screen.getByLabelText("Title printed on the bill") as HTMLInputElement).value).toBe(
      "Estimate",
    );
    expect(
      screen.getByRole("switch", { name: "Round the bill total to the nearest rupee" }),
    ).toHaveProperty("ariaChecked", "true");
    expect((screen.getByLabelText("Shop time zone") as HTMLInputElement).value).toBe(
      "Asia/Kolkata",
    );
    expect(screen.getByRole("radio", { name: "80 mm receipt" })).toHaveProperty(
      "ariaChecked",
      "true",
    );
  });

  it("marks an unknown time zone invalid and links the error to the field", () => {
    renderWithTheme(<Harness initial={{ ...DEFAULT_SETTINGS, timeZone: "Mars/Olympus" }} />);

    const zoneField = screen.getByRole("textbox", { name: "Shop time zone" });

    expect(zoneField.getAttribute("aria-invalid")).toBe("true");
    expect(zoneField.getAttribute("aria-describedby")).toContain("bill-time-zone-error");
  });

  it("leaves a known time zone valid, described by its help only", () => {
    renderWithTheme(<Harness />);

    const zoneField = screen.getByRole("textbox", { name: "Shop time zone" });

    expect(zoneField.getAttribute("aria-invalid")).toBe("false");
    expect(zoneField.getAttribute("aria-describedby")).toBe("bill-time-zone-help");
  });

  it("changes the title as the user types", async () => {
    renderWithTheme(<Harness />);

    const titleField = screen.getByLabelText("Title printed on the bill");
    await userEvent.clear(titleField);
    await userEvent.type(titleField, "Cash Memo");

    expect(savedSettings().docTitle).toBe("Cash Memo");
  });

  it("turns rounding off and on with the switch", async () => {
    renderWithTheme(<Harness />);

    const roundingSwitch = screen.getByRole("switch", {
      name: "Round the bill total to the nearest rupee",
    });
    await userEvent.click(roundingSwitch);
    expect(savedSettings().roundBillTotal).toBe(false);
    await userEvent.click(roundingSwitch);

    expect(savedSettings().roundBillTotal).toBe(true);
  });

  it("offers a 58 mm and an 80 mm receipt and an A4 and an A5 sheet", async () => {
    renderWithTheme(<Harness />);

    await userEvent.click(screen.getByRole("radio", { name: "A4 sheet" }));
    expect(savedSettings().receiptWidth).toBe("a4");
    await userEvent.click(screen.getByRole("radio", { name: "A5 sheet" }));
    expect(savedSettings().receiptWidth).toBe("a5");
    await userEvent.click(screen.getByRole("radio", { name: "58 mm receipt" }));

    expect(savedSettings().receiptWidth).toBe("58mm");
  });

  it("says, with a word, when the time zone is not known", async () => {
    renderWithTheme(<Harness />);

    const zoneField = screen.getByLabelText("Shop time zone");
    await userEvent.clear(zoneField);
    await userEvent.type(zoneField, "Mars/Olympus");

    const message = screen.getByRole("alert");
    expect(message.textContent).toBe(
      "Error This time zone is not known. Use a name like Asia/Kolkata.",
    );
  });

  it("shows no error for a known zone", () => {
    renderWithTheme(<Harness />);

    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("isBillSettingsValid", () => {
  it("accepts the defaults", () => {
    expect(isBillSettingsValid(DEFAULT_SETTINGS)).toBe(true);
  });

  it("refuses a blank title and a title over 30 characters", () => {
    expect(isBillSettingsValid({ ...DEFAULT_SETTINGS, docTitle: "   " })).toBe(false);
    expect(isBillSettingsValid({ ...DEFAULT_SETTINGS, docTitle: "t".repeat(31) })).toBe(false);
    expect(isBillSettingsValid({ ...DEFAULT_SETTINGS, docTitle: "t".repeat(30) })).toBe(true);
  });

  it("refuses an unknown time zone", () => {
    expect(isBillSettingsValid({ ...DEFAULT_SETTINGS, timeZone: "Mars/Olympus" })).toBe(false);
  });
});
