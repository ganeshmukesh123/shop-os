import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import type { IPreviewRow } from "../FamilyForm/useFamilyForm";
import { VariantPreview } from "./VariantPreview";

/** Spec 002 T036: the combination table with tick boxes, price and opening stock per row. */
const row = (displayName: string, axisSignature: string, isChosen = true): IPreviewRow => ({
  axes: {},
  axisSignature,
  displayName,
  isChosen,
  priceText: "",
  openingText: "",
});

function renderPreview(rows: IPreviewRow[]) {
  const handlers = { onToggle: vi.fn(), onPrice: vi.fn(), onOpening: vi.fn() };
  renderWithTheme(<VariantPreview rows={rows} unit="pcs" {...handlers} />);
  return handlers;
}

describe("VariantPreview (spec 002 T036)", () => {
  it("shows one row per combination with its name, tick box, price and opening stock", () => {
    renderPreview([row("0.5 in 4 kg", "a"), row("0.5 in 6 kg", "b", false)]);

    expect(
      screen.getByRole("checkbox", { name: "Keep 0.5 in 4 kg" }).getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      screen.getByRole("checkbox", { name: "Keep 0.5 in 6 kg" }).getAttribute("aria-checked"),
    ).toBe("false");
    expect(screen.getByRole("textbox", { name: "Price (₹) for 0.5 in 4 kg" })).toBeTruthy();
    expect(
      screen.getByRole("textbox", { name: "Opening stock (pcs) for 0.5 in 4 kg" }),
    ).toBeTruthy();
  });

  it("disables the price and stock of a row that is not kept", () => {
    renderPreview([row("0.5 in 6 kg", "b", false)]);

    expect(
      (screen.getByRole("textbox", { name: "Price (₹) for 0.5 in 6 kg" }) as HTMLInputElement)
        .disabled,
    ).toBe(true);
  });

  it("reports a tick, a typed price and a typed opening stock by the row's signature", async () => {
    const handlers = renderPreview([row("1 in 4 kg", "class=4 kg|size=1 in")]);

    await userEvent.click(screen.getByRole("checkbox", { name: "Keep 1 in 4 kg" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Price (₹) for 1 in 4 kg" }), "9");
    await userEvent.type(
      screen.getByRole("textbox", { name: "Opening stock (pcs) for 1 in 4 kg" }),
      "5",
    );

    expect(handlers.onToggle).toHaveBeenCalledWith("class=4 kg|size=1 in");
    expect(handlers.onPrice).toHaveBeenCalledWith("class=4 kg|size=1 in", "9");
    expect(handlers.onOpening).toHaveBeenCalledWith("class=4 kg|size=1 in", "5");
  });

  it("shows nothing before there are combinations", () => {
    renderPreview([]);

    expect(screen.queryByRole("table")).toBeNull();
  });
});
