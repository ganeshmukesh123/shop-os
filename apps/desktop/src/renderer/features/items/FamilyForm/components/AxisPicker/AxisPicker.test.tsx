import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithTheme } from "../../../../../../../tests/helpers/renderWithTheme";
import { uiText } from "../../../../../shared/text/strings";
import { AxisPicker } from "./AxisPicker";
import type { IAxisPickerProps } from "./types";

/** Spec 002 T036: choosing up to 4 attributes and typing their values. */
function renderPicker(overrides: Partial<IAxisPickerProps> = {}) {
  const props: IAxisPickerProps = {
    axisKeys: [],
    axisValuesText: {},
    axisLimitReason: null,
    onToggle: vi.fn(),
    onValuesChange: vi.fn(),
    ...overrides,
  };
  renderWithTheme(<AxisPicker {...props} />);
  return props;
}

describe("AxisPicker (spec 002 T036)", () => {
  it("offers the ten attributes by their names and reports a tick", async () => {
    const props = renderPicker();

    await userEvent.click(screen.getByRole("checkbox", { name: "Size" }));

    expect(screen.getAllByRole("checkbox")).toHaveLength(10);
    expect(props.onToggle).toHaveBeenCalledWith("size");
  });

  it("shows a values field for each chosen attribute, in the order chosen", async () => {
    const props = renderPicker({ axisKeys: ["size", "class"], axisValuesText: { size: "1 in" } });

    await userEvent.type(
      screen.getByRole("textbox", { name: "Values for Class, separated by commas" }),
      "4",
    );

    expect(
      (
        screen.getByRole("textbox", {
          name: "Values for Size, separated by commas",
        }) as HTMLInputElement
      ).value,
    ).toBe("1 in");
    expect(props.onValuesChange).toHaveBeenCalledWith("class", "4");
  });

  it("says, with a word and not colour alone, why a fifth attribute was refused", () => {
    renderPicker({ axisLimitReason: uiText.family.axisLimit });

    expect(screen.getByRole("status").textContent).toContain(uiText.family.axisLimit);
  });
});
