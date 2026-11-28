import type { IVariant } from "@shopos/core";
import { buildHandlersFixture } from "../helpers/handlersFixture";

/** Spec 002 T063: the tint.* commands through the real handlers, services and SQLite. */
const PAINT = {
  petroleumClass: "B",
  tradeLabel: null,
  warrantyMonths: null,
  isSerialTracked: false,
} as const;

async function tintDesk() {
  const fixture = buildHandlersFixture();
  const create = async (family: object, variants: object[]) => {
    const created = await fixture.handlers["families.create"]({
      family: { spec: {}, ...family },
      variants,
    });
    if (!created.ok) throw new Error(created.message);
    return created.data;
  };
  const royale = await create(
    { name: "Royale", kind: "base_paint", axisKeys: ["base_type", "pack_size"] },
    [
      {
        ...PAINT,
        axes: { base_type: "Pastel", pack_size: "4 L" },
        baseUom: "pcs",
        allowDecimal: false,
        sellingPricePaise: 145_000,
        openingQtyMilli: 5_000,
        declaredQtyMilli: 4_000,
        declaredUom: "litre",
        sealedPackOnly: true,
      },
    ],
  );
  const blue = (
    await create({ name: "Blue", kind: "colorant", axisKeys: [] }, [
      {
        ...PAINT,
        axes: {},
        baseUom: "ml",
        allowDecimal: true,
        sellingPricePaise: 300,
        openingQtyMilli: 500_000,
        declaredQtyMilli: 500_000,
        declaredUom: "ml",
        sealedPackOnly: false,
      },
    ])
  ).variants[0] as IVariant;
  return { ...fixture, royale, pastel: royale.variants[0] as IVariant, blue };
}

describe("tint.* commands (spec 002 T063)", () => {
  it("saves charges and a custom shade, resolves it, and lists it for the customer", async () => {
    const { handlers, royale, pastel, blue } = await tintDesk();

    await handlers["tint.charges.save"]({
      rules: [{ declaredQtyMilli: 4_000, declaredUom: "litre", chargePaise: 6_000 }],
    });
    const saved = await handlers["tint.customShade.save"]({
      shadeName: "Sky Blue",
      customerLabel: "Sharma",
      baseVariantId: pastel.id,
      lines: [{ colorantVariantId: blue.id, qtyMilli: 12_500 }],
    });
    if (!saved.ok) throw new Error(saved.message);
    const resolved = await handlers["tint.resolve"]({
      productFamilyId: royale.family.id,
      shadeId: saved.data.shade.id,
      packVariantId: pastel.id,
    });
    const repeats = await handlers["tint.repeat.list"]({ customerName: "sharma" });

    expect(resolved).toMatchObject({
      ok: true,
      data: { unitPricePaise: 151_000, chargePaise: 6_000 },
    });
    expect(repeats).toMatchObject({
      ok: true,
      data: { shades: [{ shade: { shadeName: "Sky Blue" } }] },
    });
    expect(await handlers["tint.shades.search"]({ query: "sky" })).toMatchObject({
      ok: true,
      data: { shades: [{ shadeName: "Sky Blue" }] },
    });
    expect(await handlers["tint.charges.list"]({})).toMatchObject({
      ok: true,
      data: { rules: [{ declaredQtyMilli: 4_000, chargePaise: 6_000 }] },
    });
  });

  it("saves a new formula version and passes the refusals through as codes", async () => {
    const { handlers, pastel, blue } = await tintDesk();
    const saved = await handlers["tint.customShade.save"]({
      shadeName: "Mint",
      siteLabel: "Gupta house",
      baseVariantId: pastel.id,
      lines: [{ colorantVariantId: blue.id, qtyMilli: 4_000 }],
    });
    if (!saved.ok) throw new Error(saved.message);

    expect(
      await handlers["tint.formula.saveVersion"]({
        shadeId: saved.data.shade.id,
        baseVariantId: pastel.id,
        lines: [{ colorantVariantId: blue.id, qtyMilli: 4_500 }],
      }),
    ).toMatchObject({ ok: true, data: { formula: { version: 2 } } });
    expect(
      await handlers["tint.customShade.save"]({
        shadeName: "Mint",
        baseVariantId: pastel.id,
        lines: [{ colorantVariantId: blue.id, qtyMilli: 4_000 }],
      }),
    ).toMatchObject({ ok: false, code: "LABEL_REQUIRED" });
  });
});
