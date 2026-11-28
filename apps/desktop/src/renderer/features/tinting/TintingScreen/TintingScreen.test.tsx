import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TintChargesSaveInput } from "@shopos/core";
import { installFakeShopos } from "../../../../../tests/helpers/fakeShopos";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { ToastProvider } from "../../../shared/components/Toast";
import { uiText } from "../../../shared/text/strings";
import { TintingScreen } from "./TintingScreen";

/** Spec 002 T066: the tint charge per pack size, and the shade library. */
function renderScreen() {
  const fake = installFakeShopos({
    "tint.charges.list": () => ({
      rules: [{ declaredQtyMilli: 4_000, declaredUom: "litre", chargePaise: 6_000 }],
    }),
    "tint.charges.save": (input) => ({ rules: input.rules }),
    "tint.shades.search": () => ({
      shades: [
        {
          id: "sky",
          shadeCode: "C-0001",
          shadeName: "Sky Blue",
          brandId: null,
          shadeCard: null,
          source: "custom",
          customerLabel: "Sharma",
          siteLabel: null,
        },
      ],
    }),
  });
  renderWithTheme(
    <ToastProvider>
      <TintingScreen />
    </ToastProvider>,
  );
  return fake;
}

describe("TintingScreen: tint charges (spec 002 T066)", () => {
  it("shows the 4 L charge, adds 10 L at ₹150 and saves both", async () => {
    const fake = renderScreen();
    const text = uiText.tinting.charges;

    expect(await screen.findByDisplayValue("60.00")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: text.addRow }));
    const sizes = screen.getAllByRole("textbox", { name: text.packSize });
    const charges = screen.getAllByRole("textbox", { name: text.charge });
    await userEvent.type(sizes[1]!, "10");
    await userEvent.type(charges[1]!, "150");
    await userEvent.click(screen.getByRole("button", { name: text.save }));

    const sent = fake.calls.find((call) => call.commandName === "tint.charges.save")!
      .input as TintChargesSaveInput;
    expect(sent.rules).toEqual([
      { declaredQtyMilli: 4_000, declaredUom: "litre", chargePaise: 6_000 },
      { declaredQtyMilli: 10_000, declaredUom: "litre", chargePaise: 15_000 },
    ]);
  });

  it("does not save a row with no size", async () => {
    const fake = renderScreen();
    const text = uiText.tinting.charges;
    await screen.findByDisplayValue("60.00");

    await userEvent.click(screen.getByRole("button", { name: text.addRow }));
    await userEvent.click(screen.getByRole("button", { name: text.save }));

    expect(await screen.findByText(text.incomplete)).toBeTruthy();
    expect(fake.calls.some((call) => call.commandName === "tint.charges.save")).toBe(false);
  });
});

describe("TintingScreen: shades (spec 002 T066)", () => {
  it("finds a shade and says whose custom shade it is", async () => {
    renderScreen();
    const text = uiText.tinting.shades;

    await userEvent.click(
      await screen.findByRole("tab", { name: new RegExp(`^${uiText.tinting.shadesTab}`) }),
    );
    await userEvent.type(await screen.findByRole("textbox", { name: text.find }), "sky");

    const row = (await screen.findByRole("rowheader", { name: "Sky Blue" })).closest("tr")!;
    expect(within(row).getByText("C-0001")).toBeTruthy();
    expect(within(row).getByText(text.customFor.replace("{label}", "Sharma"))).toBeTruthy();
  });
});
