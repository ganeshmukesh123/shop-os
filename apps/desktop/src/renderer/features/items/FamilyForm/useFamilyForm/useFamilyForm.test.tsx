import { act, renderHook } from "@testing-library/react";
import type { FamiliesCreateInput } from "@shopos/core";
import { installFakeShopos } from "../../../../../../tests/helpers/fakeShopos";
import { uiText } from "../../../../shared/text/strings";
import { useFamilyForm } from "./useFamilyForm";

/** Spec 002 T036: the logic behind the family form (quickstart scenario 1). */
const PREVIEW = {
  combinations: [
    {
      axes: { size: "0.5 in", class: "4 kg" },
      axisSignature: "class=4 kg|size=0.5 in",
      displayName: "0.5 in 4 kg",
    },
    {
      axes: { size: "0.5 in", class: "6 kg" },
      axisSignature: "class=6 kg|size=0.5 in",
      displayName: "0.5 in 6 kg",
    },
  ],
};

function renderForm(handlers: Parameters<typeof installFakeShopos>[0] = {}) {
  const saved: string[] = [];
  const fake = installFakeShopos({
    "families.previewVariants": () => PREVIEW,
    "families.create": (input) => ({
      family: {
        id: "family-1",
        name: input.family.name,
        kind: input.family.kind,
        categoryId: null,
        brandId: null,
        spec: {},
        axisKeys: input.family.axisKeys,
      },
      variants: [],
      duplicates: [],
    }),
    ...handlers,
  });
  const view = renderHook(() => useFamilyForm({ onSaved: (family) => saved.push(family.id) }));
  const createInputs = () =>
    fake.calls
      .filter((sent) => sent.commandName === "families.create")
      .map((sent) => sent.input as FamiliesCreateInput);
  return { ...view, fake, saved, createInputs };
}

async function fillPipeFamily(form: ReturnType<typeof renderForm>["result"]) {
  act(() => {
    form.current.setName("PVC Pipe Supreme");
    form.current.setUnit("pcs");
    form.current.toggleAxis("size");
    form.current.toggleAxis("class");
    form.current.setAxisValuesText("size", "0.5 in, ");
    form.current.setAxisValuesText("class", "4 kg, 6 kg");
  });
  await act(() => form.current.preview());
}

describe("useFamilyForm (spec 002 T036)", () => {
  it("allows 4 attributes and says why a fifth is refused", () => {
    const { result } = renderForm();

    act(() => {
      ["size", "class", "brand", "length", "colour"].forEach((key) =>
        result.current.toggleAxis(key),
      );
    });

    expect(result.current.axisKeys).toEqual(["size", "class", "brand", "length"]);
    expect(result.current.axisLimitReason).toBe(uiText.family.axisLimit);
  });

  it("previews the combinations of the typed values, every row ticked", async () => {
    const { result, fake } = renderForm();

    await fillPipeFamily(result);

    expect(fake.calls[0]).toEqual({
      commandName: "families.previewVariants",
      input: {
        axisKeys: ["size", "class"],
        axisValues: { size: ["0.5 in"], class: ["4 kg", "6 kg"] },
      },
    });
    expect(result.current.rows.map((row) => [row.displayName, row.isChosen])).toEqual([
      ["0.5 in 4 kg", true],
      ["0.5 in 6 kg", true],
    ]);
  });

  it("saves only the ticked rows, with price in paise and opening stock in thousandths", async () => {
    const { result, createInputs, saved } = renderForm();
    await fillPipeFamily(result);

    act(() => {
      result.current.toggleRow("class=6 kg|size=0.5 in");
      result.current.setRowPrice("class=4 kg|size=0.5 in", "120.50");
      result.current.setRowOpening("class=4 kg|size=0.5 in", "10");
    });
    await act(() => result.current.save());

    expect(createInputs()).toEqual([
      {
        family: {
          name: "PVC Pipe Supreme",
          kind: "general",
          spec: {},
          axisKeys: ["size", "class"],
        },
        variants: [
          {
            axes: { size: "0.5 in", class: "4 kg" },
            baseUom: "pcs",
            allowDecimal: false,
            sellingPricePaise: 12_050,
            openingQtyMilli: 10_000,
          },
        ],
      },
    ]);
    expect(saved).toEqual(["family-1"]);
  });

  it("refuses to save with no name, no ticked row or a bad price, and sends nothing", async () => {
    const { result, createInputs } = renderForm();
    await fillPipeFamily(result);

    act(() => {
      result.current.setName(" ");
      result.current.setRowPrice("class=4 kg|size=0.5 in", "abc");
    });
    await act(() => result.current.save());

    expect(result.current.errors).toEqual(
      expect.arrayContaining([uiText.family.nameRequired, uiText.family.priceInvalid]),
    );
    expect(createInputs()).toEqual([]);
  });

  it("shows the reason when the preview is refused", async () => {
    const { result } = renderForm({
      "families.previewVariants": () => {
        throw Object.assign(
          new Error("These values make 600 variants; one step makes at most 500"),
          {
            code: "TOO_MANY_COMBINATIONS",
          },
        );
      },
    });

    await fillPipeFamily(result);

    expect(result.current.errors).toEqual([
      "These values make 600 variants; one step makes at most 500",
    ]);
    expect(result.current.rows).toEqual([]);
  });
});
