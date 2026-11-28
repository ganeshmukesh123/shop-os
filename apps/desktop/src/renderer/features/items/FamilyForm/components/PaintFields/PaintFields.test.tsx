import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { IUnit } from "@shopos/core";
import { renderWithTheme } from "../../../../../../../tests/helpers/renderWithTheme";
import { uiText } from "../../../../../shared/text/strings";
import { EMPTY_PAINT_FIELDS } from "../../useFamilyForm/paintDraft";
import { PaintFields } from "./PaintFields";

/** Spec 002 T079: the paint, warranty and serial fields of the family form. */
const UNITS: IUnit[] = [{ code: "litre", label: "Litre", dimension: "volume", allowDecimal: true }];
const text = uiText.family.paint;

function renderFields(kind: "general" | "paint") {
  const onChange = vi.fn();
  renderWithTheme(
    <PaintFields kind={kind} paint={EMPTY_PAINT_FIELDS} units={UNITS} onChange={onChange} />,
  );
  return onChange;
}

describe("PaintFields (spec 002 T079)", () => {
  it("shows the paint fields for a paint, marked required", () => {
    renderFields("paint");

    expect(screen.getByRole("combobox", { name: `${text.petroleumClass} *` })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: `${text.declaredQty} *` })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: text.tradeLabel })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: text.sealedPackOnly })).toBeTruthy();
  });

  it("hides the paint fields for a general item but keeps warranty and serial tracking", () => {
    renderFields("general");

    expect(screen.queryByRole("combobox", { name: `${text.petroleumClass} *` })).toBeNull();
    expect(screen.getByRole("textbox", { name: text.warranty })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: text.serialTracked })).toBeTruthy();
  });

  it("reports the chosen class, a typed warranty and the serial tick", async () => {
    const onChange = renderFields("paint");

    await userEvent.click(screen.getByRole("combobox", { name: `${text.petroleumClass} *` }));
    await userEvent.click(await screen.findByRole("option", { name: "Class B" }));
    await userEvent.type(screen.getByRole("textbox", { name: text.warranty }), "6");
    await userEvent.click(screen.getByRole("checkbox", { name: text.serialTracked }));

    expect(onChange).toHaveBeenCalledWith({ petroleumClass: "B" });
    expect(onChange).toHaveBeenCalledWith({ warrantyText: "6" });
    expect(onChange).toHaveBeenCalledWith({ isSerialTracked: true });
  });
});
