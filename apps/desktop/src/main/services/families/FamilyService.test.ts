import { CoreError, type FamiliesCreateInput, type NewVariantInput } from "@shopos/core";
import { createTestDb } from "../../../../tests/helpers/testDb";
import { BillingService } from "../BillingService";
import { CatalogueService } from "../catalogue";
import { FamilyService } from "./FamilyService";

/**
 * Spec 002 T028 and T033: creating a family with its variants (quickstart scenario 1: PVC Pipe
 * Supreme, 3 sizes x 2 classes, 5 of the 6 stocked).
 */
const SIZES = ["0.5 in", "1 in", "2 in"];
const CLASSES = ["4 kg", "6 kg"];

const pipeVariant = (size: string, pipeClass: string, overrides: Partial<NewVariantInput> = {}) =>
  ({
    axes: { size, class: pipeClass },
    baseUom: "pcs",
    allowDecimal: false,
    sellingPricePaise: 12_000,
    openingQtyMilli: 10_000,
    sealedPackOnly: false,
    isSerialTracked: false,
    ...overrides,
  }) satisfies NewVariantInput;

/** Five of the six combinations: 2 in at 6 kg is not stocked. */
const FIVE_PIPES = SIZES.flatMap((size) =>
  CLASSES.map((pipeClass) => pipeVariant(size, pipeClass)),
).filter((variant) => !(variant.axes.size === "2 in" && variant.axes.class === "6 kg"));

const pipeFamily = (variants: NewVariantInput[] = FIVE_PIPES): FamiliesCreateInput => ({
  family: {
    name: "PVC Pipe Supreme",
    kind: "general",
    spec: {},
    axisKeys: ["size", "class"],
  },
  variants,
});

function shop() {
  const testDb = createTestDb();
  const refreshed: string[] = [];
  const families = new FamilyService(testDb.db, testDb.ctx, {
    refreshVariant: (variantId) => refreshed.push(variantId),
  });
  return { testDb, families, refreshed };
}

function codeOf(action: () => unknown): string | undefined {
  try {
    action();
  } catch (caughtError) {
    if (caughtError instanceof CoreError) return caughtError.code;
    throw caughtError;
  }
  return undefined;
}

describe("FamilyService.create (spec 002 T028)", () => {
  it("creates the family with 5 of 6 combinations, each with its own code and signature", () => {
    const { families } = shop();

    const { family, variants } = families.create(pipeFamily());

    expect(family).toMatchObject({
      name: "PVC Pipe Supreme",
      kind: "general",
      axisKeys: ["size", "class"],
    });
    expect(variants).toHaveLength(5);
    expect(variants.map((variant) => variant.axisSignature)).toContain("class=4 kg|size=0.5 in");
    expect(new Set(variants.map((variant) => variant.itemCode)).size).toBe(5);
    expect(variants.every((variant) => variant.familyId === family.id)).toBe(true);
  });

  it("writes one opening movement per variant that has opening stock, and none for zero", () => {
    const { testDb, families } = shop();
    const variants = [...FIVE_PIPES.slice(0, 4), { ...FIVE_PIPES[4]!, openingQtyMilli: 0 }];

    const created = families.create(pipeFamily(variants)).variants;

    const openings = testDb.sqlite
      .prepare(
        "select variant_id, qty_base_milli from stock_movement where movement_type = 'opening'",
      )
      .all();
    expect(openings).toHaveLength(4);
    expect(created.map((variant) => variant.stockMilli)).toEqual([
      10_000, 10_000, 10_000, 10_000, 0,
    ]);
  });

  it("refuses two variants with the same axis values with DUPLICATE_SIGNATURE and saves nothing", () => {
    const { testDb, families } = shop();
    const twice = [pipeVariant("1 in", "4 kg"), pipeVariant(" 1 in ", "4 kg")];

    expect(codeOf(() => families.create(pipeFamily(twice)))).toBe("DUPLICATE_SIGNATURE");
    expect(testDb.sqlite.prepare("select count(*) as families from item_family").get()).toEqual({
      families: 0,
    });
  });

  it("refuses a variant whose axes are not the family's axes", () => {
    const { families } = shop();

    expect(
      codeOf(() =>
        families.create(pipeFamily([{ ...pipeVariant("1 in", "4 kg"), axes: { size: "1 in" } }])),
      ),
    ).toBe("INVALID_FIELD");
  });

  it("refuses a second family of the same name with DUPLICATE_NAME", () => {
    const { families } = shop();
    families.create(pipeFamily());

    expect(codeOf(() => families.create(pipeFamily()))).toBe("DUPLICATE_NAME");
  });

  it("refuses a paint without its petroleum class, and a unit the shop does not have", () => {
    const { families } = shop();
    const paint: FamiliesCreateInput = {
      family: { name: "Apex Ultima", kind: "paint", spec: {}, axisKeys: [] },
      variants: [{ ...pipeVariant("", ""), axes: {}, baseUom: "litre", allowDecimal: true }],
    };

    expect(codeOf(() => families.create(paint))).toBe("MISSING_PAINT_FIELDS");
    expect(
      codeOf(() =>
        families.create(pipeFamily([pipeVariant("1 in", "4 kg", { baseUom: "furlong" })])),
      ),
    ).toBe("INVALID_FIELD");
  });

  it("refuses a fractional opening quantity on a whole-number unit", () => {
    const { families } = shop();

    expect(
      codeOf(() =>
        families.create(pipeFamily([pipeVariant("1 in", "4 kg", { openingQtyMilli: 500 })])),
      ),
    ).toBe("INVALID_QUANTITY");
  });

  it("names each variant from the category's title template", () => {
    const { testDb, families } = shop();
    const catalogue = new CatalogueService(testDb.db, testDb.ctx);
    const supreme = catalogue.saveBrand({ name: "Supreme" }).brand;
    const pipes = catalogue.saveCategory({
      name: "Pipes",
      titleTemplate: "{brand} PVC {size} {class}",
    }).category;
    const input = pipeFamily([pipeVariant("0.5 in", "4 kg")]);

    const { variants } = families.create({
      ...input,
      family: { ...input.family, brandId: supreme.id, categoryId: pipes.id },
    });

    expect(variants[0]!.displayName).toBe("Supreme PVC 0.5 in 4 kg");
  });

  it("names variants by family and axis values when there is no template, and tells search", () => {
    const { families, refreshed } = shop();

    const { variants } = families.create(pipeFamily([pipeVariant("1 in", "6 kg")]));

    expect(variants[0]!.displayName).toBe("PVC Pipe Supreme 1 in 6 kg");
    expect(refreshed).toEqual([variants[0]!.id]);
  });
});

describe("FamilyService.setActive (spec 002 T028)", () => {
  it("deactivates a variant without deleting it, even one on a saved bill, and the bill still reads it", () => {
    const { testDb, families } = shop();
    const [variant] = families.create(pipeFamily([pipeVariant("1 in", "4 kg")])).variants;
    const billing = new BillingService(testDb.db, testDb.ctx);
    const { bill } = billing.saveBill({
      clientBillId: "0193b5a2-7c1e-7d3a-8f00-000000000001",
      paymentMode: "cash",
      billDiscountPaise: 0,
      lines: [
        { itemId: variant!.id, quantityMilli: 2000, ratePaise: 12_000, lineDiscountPaise: 0 },
      ],
    });

    const { variant: inactive } = families.setActive({ id: variant!.id, isActive: false });

    expect(inactive.isActive).toBe(false);
    expect(testDb.sqlite.prepare("select count(*) as variants from item_variant").get()).toEqual({
      variants: 1,
    });
    expect(billing.getBill(bill.id).lines[0]).toMatchObject({
      itemNameSnapshot: "PVC Pipe Supreme 1 in 4 kg",
    });
  });
});
