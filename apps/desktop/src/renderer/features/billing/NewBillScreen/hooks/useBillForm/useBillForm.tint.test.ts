import { act, renderHook } from "@testing-library/react";
import type { Item } from "@shopos/core";
import { useBillForm } from "./useBillForm";

/** Spec 002 T064: a tinted can is its own line, at the price the tinting desk worked out. */
const PASTEL_4L: Item = {
  id: "royale-pastel-4l",
  name: "Royale Pastel 4 L",
  unit: "pcs",
  allowsDecimal: false,
  pricePaise: 145_000,
  stockMilli: 10_000,
  active: true,
  needsCorrection: false,
};

describe("useBillForm: tinted cans (spec 002 T064)", () => {
  it("adds a can at the tinted price with its tint and label, and never merges two shades", () => {
    const { result } = renderHook(() => useBillForm(vi.fn()));

    act(() =>
      result.current.addTintedItem(PASTEL_4L, {
        tint: { formulaId: "sky-v1" },
        ratePaise: 151_000,
        label: "Sky Blue: Blue 12.5 ml, Black 0.75 ml",
      }),
    );
    act(() =>
      result.current.addTintedItem(PASTEL_4L, {
        tint: { formulaId: "grey-v1" },
        ratePaise: 151_000,
        label: "Dove Grey: Blue 2.25 ml, Black 4 ml",
      }),
    );

    expect(result.current.form.draft.lines).toEqual([
      expect.objectContaining({
        itemId: "royale-pastel-4l",
        qty: "1",
        rate: "1510.00",
        tint: { formulaId: "sky-v1" },
        tintLabel: "Sky Blue: Blue 12.5 ml, Black 0.75 ml",
      }),
      expect.objectContaining({ tint: { formulaId: "grey-v1" } }),
    ]);
  });
});
