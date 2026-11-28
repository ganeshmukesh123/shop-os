import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { IUnit, VariantsSetConversionsInput } from "@shopos/core";
import { installFakeShopos } from "../../../../../tests/helpers/fakeShopos";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { uiText } from "../../../shared/text/strings";
import { UnitConversions } from "./UnitConversions";

/** Spec 002 T037: a variant's other units, with the live example "1 roll = 90 metre". */
const UNITS: IUnit[] = [
  { code: "box", label: "Box", dimension: "count", allowDecimal: false },
  { code: "metre", label: "Metre", dimension: "length", allowDecimal: true },
  { code: "roll", label: "Roll", dimension: "count", allowDecimal: false },
];

function renderConversions(
  conversions = [{ variantId: "wire", uomCode: "roll", factorMilli: 90_000 }],
) {
  const fake = installFakeShopos({
    "variants.setConversions": (input) => ({
      conversions: input.conversions.map((conversion) => ({
        variantId: input.variantId,
        ...conversion,
      })),
    }),
  });
  renderWithTheme(
    <UnitConversions variantId="wire" baseUnit="metre" units={UNITS} conversions={conversions} />,
  );
  const sentInputs = () =>
    fake.calls
      .filter((sent) => sent.commandName === "variants.setConversions")
      .map((sent) => sent.input as VariantsSetConversionsInput);
  return { sentInputs };
}

describe("UnitConversions (spec 002 T037)", () => {
  it("shows each saved unit with what it holds, and the live example", () => {
    renderConversions();

    expect(
      (screen.getByRole("textbox", { name: "Holds (metre) for roll" }) as HTMLInputElement).value,
    ).toBe("90");
    expect(screen.getByText("1 roll = 90 metre")).toBeTruthy();
  });

  it("updates the example as the quantity is typed, and saves it in thousandths", async () => {
    const { sentInputs } = renderConversions();
    const holds = screen.getByRole("textbox", { name: "Holds (metre) for roll" });

    await userEvent.clear(holds);
    await userEvent.type(holds, "45.5");
    await userEvent.click(screen.getByRole("button", { name: uiText.family.units.save }));

    expect(screen.getByText("1 roll = 45.5 metre")).toBeTruthy();
    expect(sentInputs()).toEqual([
      { variantId: "wire", conversions: [{ uomCode: "roll", factorMilli: 45_500 }] },
    ]);
    expect(await screen.findByText(uiText.family.units.saved)).toBeTruthy();
  });

  it("never offers the base unit, and refuses a zero quantity without sending", async () => {
    const { sentInputs } = renderConversions();
    const holds = screen.getByRole("textbox", { name: "Holds (metre) for roll" });

    await userEvent.click(screen.getByRole("combobox", { name: "Unit for roll" }));
    const offered = (await screen.findAllByRole("option")).map((option) => option.textContent);
    await userEvent.keyboard("{Escape}");
    await userEvent.clear(holds);
    await userEvent.type(holds, "0");
    await userEvent.click(screen.getByRole("button", { name: uiText.family.units.save }));

    expect(offered).toEqual(["Box", "Roll"]);
    expect((await screen.findByRole("alert")).textContent).toContain("roll");
    expect(sentInputs()).toEqual([]);
  });

  it("removes a unit and saves the list without it", async () => {
    const { sentInputs } = renderConversions();

    await userEvent.click(
      screen.getByRole("button", { name: `${uiText.family.units.remove} roll` }),
    );
    await userEvent.click(screen.getByRole("button", { name: uiText.family.units.save }));

    expect(sentInputs()).toEqual([{ variantId: "wire", conversions: [] }]);
  });
});
