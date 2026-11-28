import type Database from "better-sqlite3";
import { buildHandlersFixture } from "../helpers/handlersFixture";

/**
 * Spec 002 T029: billing in an alternate unit (2 rolls of wire at 90 m a roll). Written ahead of
 * T034 (BillingService for entered units, built on top of #126) and un-skipped with it.
 */
const WIRE_PRICE_PAISE = 2_500;
let clientBillNumber = 0;
const clientBillId = () =>
  `0193b5a2-7c1e-7d3a-8f00-${String((clientBillNumber += 1)).padStart(12, "0")}`;

async function wireWithRoll(factorMilli: number, name = "Copper Wire") {
  const fixture = buildHandlersFixture();
  const created = await fixture.handlers["families.create"]({
    family: { name, kind: "general", axisKeys: [] },
    variants: [
      {
        axes: {},
        baseUom: "metre",
        allowDecimal: true,
        sellingPricePaise: WIRE_PRICE_PAISE,
        openingQtyMilli: 500_000,
      },
    ],
  });
  if (!created.ok) throw new Error(created.message);
  const wire = created.data.variants[0]!;
  await fixture.handlers["variants.setConversions"]({
    variantId: wire.id,
    conversions: [{ uomCode: "roll", factorMilli }],
  });
  return { ...fixture, wire };
}

const saveLine = (
  fixture: Awaited<ReturnType<typeof wireWithRoll>>,
  line: { enteredUom?: string; quantityMilli: number },
) =>
  fixture.handlers["bills.save"]({
    clientBillId: clientBillId(),
    paymentMode: "cash",
    billDiscountPaise: 0,
    lines: [
      { itemId: fixture.wire.id, ratePaise: WIRE_PRICE_PAISE, lineDiscountPaise: 0, ...line },
    ],
  });

const lineRows = (sqlite: Database.Database) =>
  sqlite.prepare("select entered_uom, qty_entered_milli, qty_base_milli from bill_line").all();

const stockOf = (sqlite: Database.Database, variantId: string) =>
  (
    sqlite.prepare("select stock_milli from item_variant where id = ?").get(variantId) as {
      stock_milli: number;
    }
  ).stock_milli;

describe("bills in an alternate unit (spec 002 T029, built in T034)", () => {
  it("stores 2 rolls as entered 2000 and base 180000 milli, and deducts 180 m", async () => {
    const fixture = await wireWithRoll(90_000);

    const saved = await saveLine(fixture, { enteredUom: "roll", quantityMilli: 2_000 });

    expect(saved.ok).toBe(true);
    expect(lineRows(fixture.testDb.sqlite)).toEqual([
      { entered_uom: "roll", qty_entered_milli: 2_000, qty_base_milli: 180_000 },
    ]);
    expect(stockOf(fixture.testDb.sqlite, fixture.wire.id)).toBe(500_000 - 180_000);
  });

  it("stores 0.33 roll at 90 m as 330 entered and 29700 base milli, and deducts 29.7 m", async () => {
    const fixture = await wireWithRoll(90_000);

    await saveLine(fixture, { enteredUom: "roll", quantityMilli: 330 });

    expect(lineRows(fixture.testDb.sqlite)).toEqual([
      { entered_uom: "roll", qty_entered_milli: 330, qty_base_milli: 29_700 },
    ]);
    expect(stockOf(fixture.testDb.sqlite, fixture.wire.id)).toBe(500_000 - 29_700);
  });

  it("refuses 0.333 roll at 90.5 m with INEXACT_CONVERSION and writes nothing", async () => {
    const fixture = await wireWithRoll(90_500, "Aluminium Wire");

    const saved = await saveLine(fixture, { enteredUom: "roll", quantityMilli: 333 });

    expect(saved).toMatchObject({ ok: false, code: "INEXACT_CONVERSION" });
    expect(lineRows(fixture.testDb.sqlite)).toEqual([]);
    expect(stockOf(fixture.testDb.sqlite, fixture.wire.id)).toBe(500_000);
  });

  it("refuses a unit the item has no conversion for with UNKNOWN_UNIT", async () => {
    const fixture = await wireWithRoll(90_000);

    const saved = await saveLine(fixture, { enteredUom: "box", quantityMilli: 1_000 });

    expect(saved).toMatchObject({ ok: false, code: "UNKNOWN_UNIT" });
  });
});
