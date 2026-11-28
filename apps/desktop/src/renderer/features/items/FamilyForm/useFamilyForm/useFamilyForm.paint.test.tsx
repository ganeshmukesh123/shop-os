import { act, renderHook } from "@testing-library/react";
import type { FamiliesCreateInput } from "@shopos/core";
import { installFakeShopos } from "../../../../../../tests/helpers/fakeShopos";
import { uiText } from "../../../../shared/text/strings";
import { useFamilyForm } from "./useFamilyForm";

/** Spec 002 T079 (FR-009, FR-010): paint fields, warranty and serial tracking in the family form. */
function renderPaintForm() {
  const fake = installFakeShopos({
    "families.previewVariants": () => ({
      combinations: [{ axes: {}, axisSignature: "", displayName: "" }],
    }),
    "families.create": (input) => ({
      family: {
        id: "family-1",
        name: input.family.name,
        kind: input.family.kind,
        categoryId: null,
        brandId: null,
        spec: {},
        axisKeys: [],
      },
      variants: [],
      duplicates: [],
    }),
  });
  const view = renderHook(() => useFamilyForm({ onSaved: () => {} }));
  const createInputs = () =>
    fake.calls
      .filter((sent) => sent.commandName === "families.create")
      .map((sent) => sent.input as FamiliesCreateInput);
  return { ...view, createInputs };
}

async function fillPaint(form: ReturnType<typeof renderPaintForm>["result"]) {
  act(() => {
    form.current.setName("Apex Ultima White");
    form.current.setKind("paint");
    form.current.setUnit("pcs");
  });
  await act(() => form.current.preview());
  act(() => form.current.setRowPrice("", "2600"));
}

describe("useFamilyForm paint and warranty fields (spec 002 T079)", () => {
  it("refuses a paint without its petroleum class, with the spec's message, and sends nothing", async () => {
    const { result, createInputs } = renderPaintForm();
    await fillPaint(result);

    await act(() => result.current.save());

    expect(result.current.errors).toContain(uiText.family.paint.classRequired);
    expect(uiText.family.paint.classRequired).toBe(
      "Petroleum class is required for paint, thinner and solvent items",
    );
    expect(createInputs()).toEqual([]);
  });

  it("refuses a paint without its declared quantity and unit", async () => {
    const { result } = renderPaintForm();
    await fillPaint(result);

    act(() => result.current.setPaint({ petroleumClass: "B" }));
    await act(() => result.current.save());

    expect(result.current.errors).toContain(uiText.family.paint.declaredRequired);
  });

  it("sends the paint, warranty and serial fields with every kept variant", async () => {
    const { result, createInputs } = renderPaintForm();
    await fillPaint(result);

    act(() =>
      result.current.setPaint({
        petroleumClass: "B",
        declaredQtyText: "4",
        declaredUom: "litre",
        tradeLabel: "Apex",
        sealedPackOnly: true,
        warrantyText: "12",
        isSerialTracked: true,
      }),
    );
    await act(() => result.current.save());

    expect(createInputs()[0]!.variants[0]).toMatchObject({
      petroleumClass: "B",
      declaredQtyMilli: 4_000,
      declaredUom: "litre",
      tradeLabel: "Apex",
      sealedPackOnly: true,
      warrantyMonths: 12,
      isSerialTracked: true,
    });
  });

  it("refuses a warranty over 120 months, and sends no paint fields for a general item", async () => {
    const { result, createInputs } = renderPaintForm();
    await fillPaint(result);
    act(() => result.current.setKind("general"));

    act(() => result.current.setPaint({ petroleumClass: "B", warrantyText: "121" }));
    await act(() => result.current.save());
    const refused = result.current.errors;
    act(() => result.current.setPaint({ warrantyText: "24" }));
    await act(() => result.current.save());

    expect(refused).toContain(uiText.family.paint.warrantyInvalid);
    expect(createInputs()[0]!.variants[0]).toMatchObject({
      petroleumClass: null,
      warrantyMonths: 24,
    });
  });
});
