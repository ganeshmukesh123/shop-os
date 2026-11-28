import { buildHandlersFixture } from "../helpers/handlersFixture";

/** Spec 002 T047 and T045: variants.setBarcodes and variants.setSearchNames. */
async function shop() {
  const fixture = buildHandlersFixture();
  const create = async (name: string) => {
    const created = await fixture.handlers["items.create"]({
      name,
      unit: "pcs",
      pricePaise: 4_500,
      openingQtyMilli: 1_000,
    });
    if (!created.ok) throw new Error(created.message);
    return created.data.item;
  };
  return { ...fixture, create };
}

describe("variants.setBarcodes (spec 002 T047)", () => {
  it("replaces the item's codes and finds the item by its new code", async () => {
    const { handlers, create } = await shop();
    const elbow = await create("Elbow 1 inch");
    await handlers["variants.setBarcodes"]({
      variantId: elbow.id,
      barcodes: [{ code: "OLD-1", source: "shop_label" }],
    });

    const result = await handlers["variants.setBarcodes"]({
      variantId: elbow.id,
      barcodes: [{ code: "8901234567890", source: "manufacturer" }],
    });

    expect(result).toMatchObject({
      ok: true,
      data: { barcodes: [{ code: "8901234567890", source: "manufacturer" }], sharedWith: [] },
    });
    const found = await handlers["items.lookupBarcode"]({ code: "8901234567890" });
    const gone = await handlers["items.lookupBarcode"]({ code: "OLD-1" });
    expect([found, gone]).toMatchObject([
      { ok: true, data: { variants: [{ id: elbow.id }] } },
      { ok: true, data: { variants: [] } },
    ]);
  });

  it("says which other item shares a code, and opens one data issue for it", async () => {
    const { handlers, create, testDb } = await shop();
    const [first, second] = [await create("Elbow 1 inch"), await create("Elbow grey")];
    const code = { code: "8901234567890", source: "manufacturer" } as const;
    await handlers["variants.setBarcodes"]({ variantId: first.id, barcodes: [code] });

    const result = await handlers["variants.setBarcodes"]({
      variantId: second.id,
      barcodes: [code],
    });

    expect(result).toMatchObject({
      ok: true,
      data: {
        sharedWith: [{ code: "8901234567890", variantId: first.id, displayName: "Elbow 1 inch" }],
      },
    });
    expect(testDb.sqlite.prepare("select count(*) as issues from exception_event").get()).toEqual({
      issues: 1,
    });
  });

  it("refuses a code with spaces or symbols, and an unknown item", async () => {
    const { handlers, create } = await shop();
    const elbow = await create("Elbow 1 inch");

    expect(
      await handlers["variants.setBarcodes"]({
        variantId: elbow.id,
        barcodes: [{ code: "890 123#", source: "manufacturer" }],
      }),
    ).toMatchObject({ ok: false, code: "INVALID_BARCODE" });
    expect(
      await handlers["variants.setBarcodes"]({ variantId: "no-such-item", barcodes: [] }),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });
});

describe("variants.setSearchNames (spec 002 T047)", () => {
  it("gives two items the same names, found by the bill search", async () => {
    const { handlers, create } = await shop();
    const [half, one] = [await create("PVC Pipe 0.5 in"), await create("PVC Pipe 1 in")];

    const result = await handlers["variants.setSearchNames"]({
      variantIds: [half.id, one.id],
      names: [
        { name: "nali", language: "hinglish", kind: "alias" },
        { name: "NALI", language: "hi", kind: "spelling" },
      ],
    });

    if (!result.ok) throw new Error(result.message);
    expect(result.data.searchNames.map((row) => [row.variantId, row.name])).toEqual([
      [half.id, "nali"],
      [one.id, "nali"],
    ]);
    const searched = await handlers["items.search"]({ query: "nali", limit: 5 });
    if (!searched.ok) throw new Error(searched.message);
    expect(searched.data.results.map((row) => row.id).sort()).toEqual([half.id, one.id].sort());
  });

  it("refuses an unknown language", async () => {
    const { handlers, create } = await shop();
    const pipe = await create("PVC Pipe 1 in");

    expect(
      await handlers["variants.setSearchNames"]({
        variantIds: [pipe.id],
        names: [{ name: "nali", language: "ta", kind: "alias" }],
      }),
    ).toMatchObject({ ok: false, code: "INVALID_FIELD" });
  });
});
