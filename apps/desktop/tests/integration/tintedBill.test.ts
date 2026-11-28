import { CoreError, type BillsSaveInput } from "@shopos/core";
import { BillingService } from "../../src/main/services/BillingService";
import { TintService } from "../../src/main/services/tinting";
import { tintShop } from "../helpers/tintShop";
import type { TestDb } from "../helpers/testDb";

/**
 * Spec 002 T056 (FR-014, FR-015, contracts "Bills (changed)"): a tinted line is one base can and
 * its colorants, saved with every movement in one transaction. Example: 2 cans of Sky Blue in
 * Royale Pastel 4 L, formula Blue 12.5 ml + Black 0.75 ml per can, 4 L charge ₹60.00.
 */
let billNumber = 0;
function nextClientBillId() {
  billNumber += 1;
  return `0193b5a2-7c1e-7d3a-8f00-${String(billNumber).padStart(12, "0")}`;
}

function skyBlueShop() {
  const shop = tintShop();
  const tints = new TintService(shop.testDb.db, shop.testDb.ctx);
  tints.saveCharges({
    rules: [{ declaredQtyMilli: 4_000, declaredUom: "litre", chargePaise: 6_000 }],
  });
  const { shade, formula } = tints.saveCustomShade({
    shadeName: "Sky Blue",
    customerLabel: "Sharma",
    baseVariantId: shop.pastel4l.id,
    lines: [
      { colorantVariantId: shop.blue.id, qtyMilli: 12_500 },
      { colorantVariantId: shop.black.id, qtyMilli: 750 },
    ],
  });
  const billing = new BillingService(shop.testDb.db, shop.testDb.ctx);
  const sellTinted = (
    tint: NonNullable<BillsSaveInput["lines"][number]["tint"]>,
    cans = 2,
    itemId = shop.pastel4l.id,
  ) =>
    billing.saveBill({
      clientBillId: nextClientBillId(),
      paymentMode: "cash",
      billDiscountPaise: 0,
      customerName: "Sharma",
      lines: [
        { itemId, quantityMilli: cans * 1_000, ratePaise: 151_000, lineDiscountPaise: 0, tint },
      ],
    });
  return { ...shop, tints, shade, formula, billing, sellTinted };
}

const rows = (testDb: TestDb, sql: string, ...parameters: unknown[]) =>
  testDb.sqlite.prepare(sql).all(...parameters) as Record<string, unknown>[];

const writesCount = (testDb: TestDb) =>
  rows(
    testDb,
    "select (select count(*) from bill) + (select count(*) from stock_movement where movement_type = 'sale') as writes",
  )[0]!.writes;

function codeOf(action: () => unknown): string | undefined {
  try {
    action();
  } catch (caughtError) {
    if (caughtError instanceof CoreError) return caughtError.code;
    throw caughtError;
  }
  return undefined;
}

describe("a tinted bill line (spec 002 T056)", () => {
  it("saves the base line with its formula, charge, cost and no return, plus one row per colorant", () => {
    const { testDb, sellTinted, formula, blue, black } = skyBlueShop();

    const { lines } = sellTinted({ formulaId: formula.id });

    expect(
      rows(
        testDb,
        "select tint_formula_id, tint_charge_paise, cost_paise, is_returnable from bill_line where id = ?",
        lines[0]!.id,
      ),
    ).toEqual([
      {
        tint_formula_id: formula.id,
        tint_charge_paise: 6_000,
        cost_paise: 113_225,
        is_returnable: 0,
      },
    ]);
    expect(
      rows(
        testDb,
        "select colorant_variant_id, colorant_name_snapshot, qty_milli, cost_paise from bill_line_tint order by qty_milli desc",
      ),
    ).toEqual([
      {
        colorant_variant_id: blue.id,
        colorant_name_snapshot: "Blue",
        qty_milli: 12_500,
        cost_paise: 3_000,
      },
      {
        colorant_variant_id: black.id,
        colorant_name_snapshot: "Black",
        qty_milli: 750,
        cost_paise: 225,
      },
    ]);
  });

  it("writes one sale for the 2 cans and one per colorant, for both cans", () => {
    const { testDb, sellTinted, formula, pastel4l, blue, black } = skyBlueShop();

    sellTinted({ formulaId: formula.id });

    const sales = rows(
      testDb,
      "select variant_id, qty_base_milli from stock_movement where movement_type = 'sale' order by qty_base_milli desc",
    );
    expect(sales).toEqual([
      { variant_id: blue.id, qty_base_milli: 25_000 },
      { variant_id: pastel4l.id, qty_base_milli: 2_000 },
      { variant_id: black.id, qty_base_milli: 1_500 },
    ]);
    expect(rows(testDb, "select stock_milli from item_variant where id = ?", blue.id)).toEqual([
      { stock_milli: 975_000 },
    ]);
  });

  it("writes nothing new on a retry with the same clientBillId", () => {
    const { testDb, billing, formula, pastel4l } = skyBlueShop();
    const input: BillsSaveInput = {
      clientBillId: nextClientBillId(),
      paymentMode: "cash",
      billDiscountPaise: 0,
      lines: [
        {
          itemId: pastel4l.id,
          quantityMilli: 1_000,
          ratePaise: 151_000,
          lineDiscountPaise: 0,
          tint: { formulaId: formula.id },
        },
      ],
    };
    billing.saveBill(input);
    const afterFirst = writesCount(testDb);

    billing.saveBill(input);

    expect(writesCount(testDb)).toBe(afterFirst);
    expect(rows(testDb, "select count(*) as tints from bill_line_tint")).toEqual([{ tints: 2 }]);
  });

  it("saves when the base is out of stock and lists it as below zero", () => {
    const { sellTinted, formula, pastel4l } = skyBlueShop();

    const saved = sellTinted({ formulaId: formula.id }, 11);

    expect(saved.negativeStockItems.map((item) => item.id)).toEqual([pastel4l.id]);
  });
});

describe("a tinted bill line: refusals with no writes (spec 002 T056)", () => {
  it("refuses a superseded formula with FORMULA_NOT_CURRENT", () => {
    const { testDb, sellTinted, tints, shade, formula, pastel4l, blue } = skyBlueShop();
    tints.saveVersion({
      shadeId: shade.id,
      baseVariantId: pastel4l.id,
      lines: [{ colorantVariantId: blue.id, qtyMilli: 13_000 }],
    });

    expect(codeOf(() => sellTinted({ formulaId: formula.id }))).toBe("FORMULA_NOT_CURRENT");
    expect(writesCount(testDb)).toBe(0);
  });

  it("refuses a formula for another base with FORMULA_BASE_MISMATCH", () => {
    const { testDb, sellTinted, formula, white1l } = skyBlueShop();

    expect(codeOf(() => sellTinted({ formulaId: formula.id }, 1, white1l.id))).toBe(
      "FORMULA_BASE_MISMATCH",
    );
    expect(writesCount(testDb)).toBe(0);
  });
});

describe("a repeat of a billed shade (spec 002 T056)", () => {
  it("uses the source line's formula and colorant amounts even after the formula changed", () => {
    const { testDb, sellTinted, tints, shade, formula, pastel4l, blue } = skyBlueShop();
    const first = sellTinted({ formulaId: formula.id }, 1);
    tints.saveVersion({
      shadeId: shade.id,
      baseVariantId: pastel4l.id,
      lines: [{ colorantVariantId: blue.id, qtyMilli: 13_000 }],
    });

    const repeat = sellTinted({ sourceBillLineId: first.lines[0]!.id }, 1);

    expect(
      rows(testDb, "select tint_formula_id from bill_line where id = ?", repeat.lines[0]!.id),
    ).toEqual([{ tint_formula_id: formula.id }]);
    expect(
      rows(
        testDb,
        "select qty_base_milli from stock_movement where variant_id = ? and doc_id = ?",
        blue.id,
        repeat.bill.id,
      ),
    ).toEqual([{ qty_base_milli: 12_500 }]);
  });

  it("refuses another base with FORMULA_BASE_MISMATCH and an unknown source with INVALID_TINT_REPEAT_SOURCE", () => {
    const { testDb, sellTinted, formula, white1l } = skyBlueShop();
    const first = sellTinted({ formulaId: formula.id }, 1);
    const writes = writesCount(testDb);

    expect(codeOf(() => sellTinted({ sourceBillLineId: first.lines[0]!.id }, 1, white1l.id))).toBe(
      "FORMULA_BASE_MISMATCH",
    );
    expect(codeOf(() => sellTinted({ sourceBillLineId: "no-such-line" }, 1))).toBe(
      "INVALID_TINT_REPEAT_SOURCE",
    );
    expect(writesCount(testDb)).toBe(writes);
  });
});

describe("a saved tinted line read back (spec 002 T067)", () => {
  it("is returned tinted by the save itself, so the bill shown after saving says so", () => {
    const { sellTinted, formula } = skyBlueShop();

    const { lines } = sellTinted({ formulaId: formula.id }, 1);

    expect(lines[0]!.tint?.colorants.map((colorant) => colorant.name)).toEqual(["Blue", "Black"]);
  });

  it("carries its colorants per can, so the bill view and print can show them", () => {
    const { sellTinted, formula, billing } = skyBlueShop();
    const { bill } = sellTinted({ formulaId: formula.id }, 1);

    const { lines } = billing.getBill(bill.id);

    expect(lines[0]!.tint).toEqual({
      colorants: [
        { name: "Blue", qtyMilli: 12_500 },
        { name: "Black", qtyMilli: 750 },
      ],
    });
  });
});

describe("a formula a bill used is frozen (spec 002 T058)", () => {
  it("refuses a direct UPDATE of the used formula's line", () => {
    const { testDb, sellTinted, formula } = skyBlueShop();
    sellTinted({ formulaId: formula.id }, 1);

    expect(() =>
      testDb.sqlite
        .prepare("update tint_formula_line set qty_milli = 13000 where formula_id = ?")
        .run(formula.id),
    ).toThrow(/used on a bill; save a new version/);
  });
});
