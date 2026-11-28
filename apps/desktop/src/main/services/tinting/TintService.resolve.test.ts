import { CoreError } from "@shopos/core";
import { tintShop } from "../../../../tests/helpers/tintShop";
import { TintService } from "./TintService";

/** Spec 002 T060 (FR-014, FR-015, contracts tint.resolve): what the tinting desk shows. */
function skyBlueShop() {
  const shop = tintShop();
  const tints = new TintService(shop.testDb.db, shop.testDb.ctx);
  tints.saveCharges({
    rules: [{ declaredQtyMilli: 4_000, declaredUom: "litre", chargePaise: 6_000 }],
  });
  const { shade } = tints.saveCustomShade({
    shadeName: "Sky Blue",
    customerLabel: "Sharma",
    baseVariantId: shop.pastel4l.id,
    lines: [
      { colorantVariantId: shop.blue.id, qtyMilli: 12_500 },
      { colorantVariantId: shop.black.id, qtyMilli: 750 },
    ],
  });
  return { ...shop, tints, shade };
}

describe("TintService.resolve (spec 002 T060)", () => {
  it("gives the can, the colorant amounts with their stock, and ₹1,450.00 + ₹60.00", () => {
    const { tints, shade, royale, pastel4l } = skyBlueShop();

    const resolved = tints.resolve({
      productFamilyId: royale.id,
      shadeId: shade.id,
      packVariantId: pastel4l.id,
    });

    expect(resolved.baseVariant.id).toBe(pastel4l.id);
    expect(
      resolved.lines.map(({ name, qtyMilli, stockMilli }) => [name, qtyMilli, stockMilli]),
    ).toEqual([
      ["Blue", 12_500, 1_000_000],
      ["Black", 750, 1_000_000],
    ]);
    expect([resolved.unitPricePaise, resolved.chargePaise, resolved.costPaise]).toEqual([
      151_000, 6_000, 113_225,
    ]);
  });

  it("says NO_FORMULA for a pack the shade has no formula for", () => {
    const { tints, shade, royale, white1l } = skyBlueShop();

    expect(() =>
      tints.resolve({ productFamilyId: royale.id, shadeId: shade.id, packVariantId: white1l.id }),
    ).toThrow(expect.objectContaining({ code: "NO_FORMULA" }) as CoreError);
  });
});
