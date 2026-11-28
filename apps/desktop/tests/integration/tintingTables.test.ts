import type Database from "better-sqlite3";
import { insertCatalogueRow } from "../helpers/catalogueRows";
import { insertTargetSeriesAndBill } from "../helpers/schemaRows";
import { createTestDb } from "../helpers/testDb";

/**
 * Spec 002 T020, second half (migration 0022): the tinting tables, the new bill_line columns,
 * bill_line_tint, and the triggers that freeze a formula once a bill uses it
 * (data-model.md "Tinting", "Sales (changed)").
 */
function paintShop() {
  const { sqlite, ctx } = createTestDb();
  const variantOf = (familyName: string, kind: string, code: string) => {
    const familyId = insertCatalogueRow(sqlite, "item_family", { name: familyName, kind });
    return insertCatalogueRow(sqlite, "item_variant", {
      family_id: familyId,
      item_code: code,
      display_name: familyName,
      base_uom: "litre",
      allow_decimal: 1,
      selling_price_paise: 50_000,
    });
  };
  const baseCan = variantOf("Apex White Base 4 L", "base_paint", "ITM-B4");
  const blue = variantOf("Colorant Blue", "colorant", "ITM-CB");
  const red = variantOf("Colorant Red", "colorant", "ITM-CR");
  const shade = insertCatalogueRow(sqlite, "tint_shade", {
    shade_code: "8123",
    shade_name: "Sky Blue",
    source: "library",
  });
  const formulaVersion = (version: number) =>
    insertCatalogueRow(sqlite, "tint_formula", {
      shade_id: shade,
      base_variant_id: baseCan,
      version,
    });
  const formulaLine = (formulaId: string, colorantId: string, qtyMilli = 12_500) =>
    insertCatalogueRow(sqlite, "tint_formula_line", {
      formula_id: formulaId,
      colorant_variant_id: colorantId,
      qty_milli: qtyMilli,
    });
  return { sqlite, ctx, baseCan, blue, red, shade, formulaVersion, formulaLine };
}

/** A posted bill with one tinted line that uses `formulaId`; returns the line id. */
function billUsingFormula(
  shop: ReturnType<typeof paintShop>,
  formulaId: string,
  lineColumns: Record<string, unknown> = {},
): string {
  insertTargetSeriesAndBill(shop.sqlite, shop.ctx);
  return insertTintedLine(shop, formulaId, lineColumns);
}

/** One tinted line of 2 cans on bill-1 (which must exist); returns the line id. */
function insertTintedLine(
  shop: ReturnType<typeof paintShop>,
  formulaId: string,
  lineColumns: Record<string, unknown> = {},
): string {
  return insertCatalogueRow(shop.sqlite, "bill_line", {
    bill_id: "bill-1",
    line_no: 1,
    variant_id: shop.baseCan,
    item_name_snapshot: "Apex White Base 4 L",
    unit_snapshot: "litre",
    qty_base_milli: 2000,
    unit_price_paise: 50_000,
    line_discount_paise: 0,
    amount_paise: 100_000,
    tint_formula_id: formulaId,
    tint_charge_paise: 5_000,
    cost_paise: 80_000,
    is_returnable: 0,
    ...lineColumns,
  });
}

const run =
  (sqlite: Database.Database, statement: string, ...values: unknown[]) =>
  () =>
    sqlite.prepare(statement).run(...values);

describe("tint_shade (spec 002 T020)", () => {
  it("refuses a second library shade with the same code for a brand, but allows a custom one", () => {
    const { sqlite } = paintShop();
    const brandId = insertCatalogueRow(sqlite, "brand", { name: "Apex" });
    const shadeRow = (columns: Record<string, unknown>) => () =>
      insertCatalogueRow(sqlite, "tint_shade", {
        shade_code: "8124",
        shade_name: "Sea Green",
        brand_id: brandId,
        ...columns,
      });

    expect(shadeRow({ source: "library" })).not.toThrow();
    expect(shadeRow({ source: "library" })).toThrow(/UNIQUE/);
    expect(shadeRow({ source: "custom", customer_label: "Mr Sharma" })).not.toThrow();
  });

  it("needs a nonblank customer or site label on a custom shade", () => {
    const { sqlite } = paintShop();
    const customShade = (columns: Record<string, unknown>) => () =>
      insertCatalogueRow(sqlite, "tint_shade", {
        shade_code: "C-1",
        shade_name: "Sharma bedroom",
        source: "custom",
        ...columns,
      });

    expect(customShade({})).toThrow(/CHECK/);
    expect(customShade({ customer_label: "" })).toThrow(/tint_shade_custom_labelled/);
    expect(customShade({ site_label: " \t\n " })).toThrow(/tint_shade_custom_labelled/);
    expect(customShade({ customer_label: " ", site_label: " Plot 12 " })).not.toThrow();
  });
});

describe("tint formulas (spec 002 T020)", () => {
  it("keeps versions apart and refuses version 0 or the same version twice", () => {
    const { formulaVersion } = paintShop();
    formulaVersion(1);

    expect(() => formulaVersion(2)).not.toThrow();
    expect(() => formulaVersion(2)).toThrow(/UNIQUE/);
    expect(() => formulaVersion(0)).toThrow(/CHECK/);
  });

  it("refuses a colorant line of zero, or the same colorant twice in one formula", () => {
    const { formulaVersion, formulaLine, blue } = paintShop();
    const formulaId = formulaVersion(1);
    formulaLine(formulaId, blue);

    expect(() => formulaLine(formulaId, blue)).toThrow(/UNIQUE/);
    expect(() => formulaLine(formulaVersion(2), blue, 0)).toThrow(/CHECK/);
  });

  it("freezes a formula and its lines once a bill uses it", () => {
    const shop = paintShop();
    const formulaId = shop.formulaVersion(1);
    shop.formulaLine(formulaId, shop.blue);
    billUsingFormula(shop, formulaId);
    const { sqlite } = shop;

    expect(run(sqlite, "update tint_formula set version = 9 where id = ?", formulaId)).toThrow(
      /used on a bill/,
    );
    expect(run(sqlite, "delete from tint_formula where id = ?", formulaId)).toThrow(
      /used on a bill/,
    );
    expect(run(sqlite, "update tint_formula_line set qty_milli = 1")).toThrow(/used on a bill/);
    expect(run(sqlite, "delete from tint_formula_line")).toThrow(/used on a bill/);
    expect(() => shop.formulaLine(formulaId, shop.red)).toThrow(/used on a bill/);
  });

  it("lets a new version take lines, but no line may move into a used formula", () => {
    const shop = paintShop();
    const usedFormula = shop.formulaVersion(1);
    shop.formulaLine(usedFormula, shop.blue);
    billUsingFormula(shop, usedFormula);
    const newVersion = shop.formulaVersion(2);
    const redLine = shop.formulaLine(newVersion, shop.red);

    expect(() => shop.formulaLine(newVersion, shop.blue)).not.toThrow();
    expect(
      run(
        shop.sqlite,
        "update tint_formula_line set formula_id = ? where id = ?",
        usedFormula,
        redLine,
      ),
    ).toThrow(/used on a bill/);
  });

  it("still lets an unused formula be edited", () => {
    const shop = paintShop();
    const formulaId = shop.formulaVersion(1);
    shop.formulaLine(formulaId, shop.blue);

    expect(run(shop.sqlite, "update tint_formula_line set qty_milli = 10000")).not.toThrow();
  });
});

describe("charges and shade prices (spec 002 T020)", () => {
  it("holds one charge per pack size, never negative", () => {
    const { sqlite } = paintShop();
    const charge = (chargePaise: number) => () =>
      insertCatalogueRow(sqlite, "tint_charge_rule", {
        declared_qty_milli: 4000,
        declared_uom: "litre",
        charge_paise: chargePaise,
      });

    expect(charge(5_000)).not.toThrow();
    expect(charge(6_000)).toThrow(/UNIQUE/);
    expect(() =>
      insertCatalogueRow(sqlite, "tint_charge_rule", {
        declared_qty_milli: 1000,
        declared_uom: "litre",
        charge_paise: -1,
      }),
    ).toThrow(/CHECK/);
  });

  it("needs a shade price above zero, one per shade and base can", () => {
    const { sqlite, shade, baseCan } = paintShop();
    const shadePrice = (pricePaise: number) => () =>
      insertCatalogueRow(sqlite, "tint_shade_price", {
        shade_id: shade,
        base_variant_id: baseCan,
        price_paise: pricePaise,
      });

    expect(shadePrice(0)).toThrow(/CHECK/);
    expect(shadePrice(260_000)).not.toThrow();
    expect(shadePrice(270_000)).toThrow(/UNIQUE/);
  });
});

describe("tinted bill lines (spec 002 T020)", () => {
  it("stores a tinted line with its charge and cost, not returnable, and its colorant snapshot", () => {
    const shop = paintShop();
    const formulaId = shop.formulaVersion(1);
    const lineId = billUsingFormula(shop, formulaId);

    expect(() =>
      insertCatalogueRow(shop.sqlite, "bill_line_tint", {
        bill_line_id: lineId,
        colorant_variant_id: shop.blue,
        colorant_name_snapshot: "Colorant Blue",
        qty_milli: 12_500,
        cost_paise: 1_200,
      }),
    ).not.toThrow();
    expect(
      shop.sqlite
        .prepare("select tint_charge_paise, cost_paise, is_returnable from bill_line where id = ?")
        .get(lineId),
    ).toEqual({ tint_charge_paise: 5_000, cost_paise: 80_000, is_returnable: 0 });
  });

  it("allows each colorant only once per bill line", () => {
    const shop = paintShop();
    const formulaId = shop.formulaVersion(1);
    const firstLineId = billUsingFormula(shop, formulaId);
    const secondLineId = insertTintedLine(shop, formulaId, { line_no: 2 });
    const addColorant = (lineId: string, colorantId: string) => () =>
      insertCatalogueRow(shop.sqlite, "bill_line_tint", {
        bill_line_id: lineId,
        colorant_variant_id: colorantId,
        colorant_name_snapshot: "Colorant",
        qty_milli: 12_500,
        cost_paise: 1_200,
      });

    expect(addColorant(firstLineId, shop.blue)).not.toThrow();
    expect(addColorant(firstLineId, shop.blue)).toThrow(/UNIQUE constraint failed/);
    expect(addColorant(firstLineId, shop.red)).not.toThrow();
    expect(addColorant(secondLineId, shop.blue)).not.toThrow();
  });

  it("refuses an update or delete of a colorant snapshot", () => {
    const shop = paintShop();
    const lineId = billUsingFormula(shop, shop.formulaVersion(1));
    insertCatalogueRow(shop.sqlite, "bill_line_tint", {
      bill_line_id: lineId,
      colorant_variant_id: shop.blue,
      colorant_name_snapshot: "Colorant Blue",
      qty_milli: 12_500,
      cost_paise: 1_200,
    });

    expect(run(shop.sqlite, "update bill_line_tint set qty_milli = 1")).toThrow(/append-only/);
    expect(run(shop.sqlite, "delete from bill_line_tint")).toThrow(/append-only/);
  });

  it("refuses a negative charge or cost, a returnable flag other than 0 or 1, and a half-entered unit", () => {
    const shop = paintShop();
    const formulaId = shop.formulaVersion(1);
    insertTargetSeriesAndBill(shop.sqlite, shop.ctx);
    const badLine = (columns: Record<string, unknown>) => () =>
      insertTintedLine(shop, formulaId, columns);

    expect(badLine({ tint_charge_paise: -1 })).toThrow(/bill_line:/);
    expect(badLine({ cost_paise: -1 })).toThrow(/bill_line:/);
    expect(badLine({ is_returnable: 2 })).toThrow(/bill_line:/);
    expect(badLine({ entered_uom: "box" })).toThrow(/bill_line:/);
  });

  it("gives an ordinary 001-style line no tint and makes it returnable", () => {
    const shop = paintShop();
    insertTargetSeriesAndBill(shop.sqlite, shop.ctx);
    const lineId = insertCatalogueRow(shop.sqlite, "bill_line", {
      bill_id: "bill-1",
      line_no: 1,
      variant_id: shop.baseCan,
      item_name_snapshot: "Apex White Base 4 L",
      unit_snapshot: "litre",
      qty_base_milli: 1000,
      unit_price_paise: 50_000,
      line_discount_paise: 0,
      amount_paise: 50_000,
    });

    expect(
      shop.sqlite
        .prepare(
          "select entered_uom, qty_entered_milli, tint_formula_id, tint_charge_paise, cost_paise, is_returnable from bill_line where id = ?",
        )
        .get(lineId),
    ).toEqual({
      entered_uom: null,
      qty_entered_milli: null,
      tint_formula_id: null,
      tint_charge_paise: null,
      cost_paise: null,
      is_returnable: 1,
    });
  });
});
