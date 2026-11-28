import { buildHandlersFixture } from "../helpers/handlersFixture";
import { insertCatalogueRow } from "../helpers/catalogueRows";

/**
 * Spec 002 T047, first part: items.checkDuplicates, items.lookupBarcode, items.merge and
 * items.merge.reverse through the real handlers, services and SQLite.
 */
async function shopWithTwoPipes() {
  const fixture = buildHandlersFixture();
  const create = async (name: string, openingQtyMilli: number) => {
    const created = await fixture.handlers["items.create"]({
      name,
      unit: "pcs",
      pricePaise: 12_000,
      openingQtyMilli,
    });
    if (!created.ok) throw new Error(created.message);
    return created.data.item;
  };
  const survivor = await create("PVC Pipe 1 inch", 10_000);
  const merged = await create("Pipe PVC one inch", 4_000);
  return { ...fixture, survivor, merged };
}

describe("items.checkDuplicates (spec 002 T047)", () => {
  it("lists an existing item whose name is the draft's words in another order", async () => {
    const { handlers, survivor } = await shopWithTwoPipes();

    const result = await handlers["items.checkDuplicates"]({
      draft: { name: "Pipe PVC 1 inch", axisSignature: "" },
    });

    expect(result).toMatchObject({
      ok: true,
      data: {
        candidates: expect.arrayContaining([
          { variantId: survivor.id, displayName: "PVC Pipe 1 inch", reason: "similar_name" },
        ]),
      },
    });
  });

  it("lists nothing for a new kind of item, and refuses a draft without a name", async () => {
    const { handlers } = await shopWithTwoPipes();

    expect(
      await handlers["items.checkDuplicates"]({ draft: { name: "Gate valve", axisSignature: "" } }),
    ).toEqual({ ok: true, data: { candidates: [] } });
    expect(await handlers["items.checkDuplicates"]({ draft: { axisSignature: "" } })).toMatchObject(
      {
        ok: false,
        code: "INVALID_FIELD",
      },
    );
  });
});

describe("items.merge and items.merge.reverse (spec 002 T047)", () => {
  it("merges, answers with the survivor's stock, and reverses", async () => {
    const { handlers, survivor, merged } = await shopWithTwoPipes();

    const mergeResult = await handlers["items.merge"]({
      survivorId: survivor.id,
      mergedId: merged.id,
      reason: "Entered twice",
    });
    if (!mergeResult.ok) throw new Error(mergeResult.message);
    expect(mergeResult.data.survivor.stockMilli).toBe(14_000);

    const reverseResult = await handlers["items.merge.reverse"]({
      mergeLogId: mergeResult.data.mergeLog.id,
      reason: "Merged by mistake",
    });
    expect(reverseResult).toMatchObject({ ok: true, data: { reverseLog: { action: "reverse" } } });
  });

  it("passes the service's refusals through as codes", async () => {
    const { handlers, survivor } = await shopWithTwoPipes();

    expect(
      await handlers["items.merge"]({
        survivorId: survivor.id,
        mergedId: survivor.id,
        reason: "x",
      }),
    ).toMatchObject({ ok: false, code: "SAME_ITEM" });
    expect(
      await handlers["items.merge.reverse"]({ mergeLogId: "no-such-merge", reason: "x" }),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("drops the merged item from the bill search and keeps the survivor", async () => {
    const { handlers, survivor, merged } = await shopWithTwoPipes();

    await handlers["items.merge"]({
      survivorId: survivor.id,
      mergedId: merged.id,
      reason: "Twice",
    });
    const searched = await handlers["items.search"]({ query: "pipe", limit: 10 });

    if (!searched.ok) throw new Error(searched.message);
    expect(searched.data.results.map((row) => row.id)).toEqual([survivor.id]);
  });
});

describe("items.lookupBarcode (spec 002 T047)", () => {
  it("returns the item a scanned code is on", async () => {
    const { handlers, testDb, survivor } = await shopWithTwoPipes();
    insertCatalogueRow(testDb.sqlite, "item_barcode", {
      variant_id: survivor.id,
      code: "8901234567890",
      source: "manufacturer",
    });

    const result = await handlers["items.lookupBarcode"]({ code: "8901234567890" });

    if (!result.ok) throw new Error(result.message);
    expect(result.data.variants.map((item) => item.id)).toEqual([survivor.id]);
  });
});
