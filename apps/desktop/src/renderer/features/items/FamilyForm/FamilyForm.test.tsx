import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FamiliesCreateInput, IUnit } from "@shopos/core";
import { installFakeShopos } from "../../../../../tests/helpers/fakeShopos";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { uiText } from "../../../shared/text/strings";
import { FamilyForm } from "./FamilyForm";

/** Spec 002 T036, quickstart scenario 1: a family of pipes in two sizes, one not stocked. */
const UNITS: IUnit[] = [
  { code: "metre", label: "Metre", dimension: "length", allowDecimal: true },
  { code: "pcs", label: "Pieces", dimension: "count", allowDecimal: false },
];

function renderFamilyForm() {
  const fake = installFakeShopos({
    "families.previewVariants": () => ({
      combinations: [
        { axes: { size: "1 in" }, axisSignature: "size=1 in", displayName: "1 in" },
        { axes: { size: "2 in" }, axisSignature: "size=2 in", displayName: "2 in" },
      ],
    }),
    "families.create": (input) => ({
      family: {
        id: "family-1",
        name: input.family.name,
        kind: "general",
        categoryId: null,
        brandId: null,
        spec: {},
        axisKeys: input.family.axisKeys,
      },
      variants: [],
      duplicates: [],
    }),
  });
  const onSaved = vi.fn();
  renderWithTheme(
    <FamilyForm categories={[]} brands={[]} units={UNITS} onClose={vi.fn()} onSaved={onSaved} />,
  );
  return { fake, onSaved };
}

describe("FamilyForm (spec 002 T036)", () => {
  it("creates a family from the kept combinations", async () => {
    const { fake, onSaved } = renderFamilyForm();

    await userEvent.type(screen.getByRole("textbox", { name: uiText.family.name }), "PVC Pipe");
    await userEvent.click(screen.getByRole("combobox", { name: uiText.family.unit }));
    await userEvent.click(await screen.findByRole("option", { name: "Pieces" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Size" }));
    await userEvent.type(
      screen.getByRole("textbox", { name: "Values for Size, separated by commas" }),
      "1 in, 2 in",
    );
    await userEvent.click(screen.getByRole("button", { name: uiText.family.preview }));
    await userEvent.click(await screen.findByRole("checkbox", { name: "Keep 2 in" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Price (₹) for 1 in" }), "120");
    await userEvent.click(screen.getByRole("button", { name: uiText.family.save }));

    const created = fake.calls.find((sent) => sent.commandName === "families.create")!
      .input as FamiliesCreateInput;
    expect(created.variants).toEqual([
      {
        axes: { size: "1 in" },
        baseUom: "pcs",
        allowDecimal: false,
        sellingPricePaise: 12_000,
        openingQtyMilli: 0,
      },
    ]);
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: "family-1" }));
  });

  it("says Error with the reasons when it is saved empty, and sends nothing", async () => {
    const { fake } = renderFamilyForm();

    await userEvent.click(screen.getByRole("button", { name: uiText.family.save }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(uiText.family.errorLabel);
    expect(alert.textContent).toContain(uiText.family.nameRequired);
    expect(fake.calls.filter((sent) => sent.commandName === "families.create")).toEqual([]);
  });
});
