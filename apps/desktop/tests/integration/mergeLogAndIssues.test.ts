import { buildHandlersFixture } from "../helpers/handlersFixture";
import { insertCatalogueRow } from "../helpers/catalogueRows";

/** Spec 002 T047, part: items.merge.list, exceptions.list and exceptions.resolve. */
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

describe("items.merge.list (spec 002 T047)", () => {
  it("lists merges newest first, with both names and whether each was reversed", async () => {
    const { handlers, create } = await shop();
    const [pipeA, pipeB, pipeC] = [
      await create("Pipe A"),
      await create("Pipe B"),
      await create("Pipe C"),
    ];
    const first = await handlers["items.merge"]({
      survivorId: pipeA.id,
      mergedId: pipeB.id,
      reason: "Twice",
    });
    if (!first.ok) throw new Error(first.message);
    await handlers["items.merge.reverse"]({
      mergeLogId: first.data.mergeLog.id,
      reason: "Mistake",
    });
    await handlers["items.merge"]({ survivorId: pipeA.id, mergedId: pipeC.id, reason: "Twice" });

    const listed = await handlers["items.merge.list"]({ limit: 10, offset: 0 });

    if (!listed.ok) throw new Error(listed.message);
    expect(listed.data.total).toBe(2);
    expect(
      listed.data.merges.map((row) => [row.survivorName, row.mergedName, row.isReversed]),
    ).toEqual([
      ["Pipe A", "Pipe C", false],
      ["Pipe A", "Pipe B", true],
    ]);
  });

  it("pages with limit and offset", async () => {
    const { handlers, create } = await shop();
    const survivor = await create("Pipe A");
    await handlers["items.merge"]({
      survivorId: survivor.id,
      mergedId: (await create("Pipe B")).id,
      reason: "x",
    });
    await handlers["items.merge"]({
      survivorId: survivor.id,
      mergedId: (await create("Pipe C")).id,
      reason: "x",
    });

    const page = await handlers["items.merge.list"]({ limit: 1, offset: 1 });

    expect(page).toMatchObject({
      ok: true,
      data: { total: 2, merges: [{ mergedName: "Pipe B" }] },
    });
  });
});

describe("exceptions.list and exceptions.resolve (spec 002 T047)", () => {
  async function shopWithSharedCode() {
    const fixture = await shop();
    const [first, second] = [
      await fixture.create("Elbow 1 inch"),
      await fixture.create("Elbow grey"),
    ];
    [first, second].forEach((item, itemIndex) =>
      insertCatalogueRow(fixture.testDb.sqlite, "item_barcode", {
        variant_id: item.id,
        code: "8901234567890",
        source: itemIndex === 0 ? "manufacturer" : "shop_label",
      }),
    );
    await fixture.handlers["items.lookupBarcode"]({ code: "8901234567890" });
    return fixture;
  }

  it("lists the open duplicate-barcode issue, then resolves it with a note", async () => {
    const { handlers } = await shopWithSharedCode();

    const open = await handlers["exceptions.list"]({ status: "open" });
    if (!open.ok) throw new Error(open.message);
    expect(open.data.events).toMatchObject([
      { kind: "duplicate_barcode", detail: "8901234567890", status: "open" },
    ]);

    const resolved = await handlers["exceptions.resolve"]({
      id: open.data.events[0]!.id,
      note: "Grey elbow relabelled",
    });

    expect(resolved).toMatchObject({
      ok: true,
      data: { event: { status: "resolved", resolutionNote: "Grey elbow relabelled" } },
    });
    expect(await handlers["exceptions.list"]({ status: "open" })).toEqual({
      ok: true,
      data: { events: [] },
    });
  });

  it("needs a note and an issue that exists; resolving twice keeps the first note", async () => {
    const { handlers } = await shopWithSharedCode();
    const open = await handlers["exceptions.list"]({});
    if (!open.ok) throw new Error(open.message);
    const issueId = open.data.events[0]!.id;

    expect(await handlers["exceptions.resolve"]({ id: issueId, note: " " })).toMatchObject({
      ok: false,
      code: "INVALID_FIELD",
    });
    expect(await handlers["exceptions.resolve"]({ id: "no-such-issue", note: "x" })).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
    await handlers["exceptions.resolve"]({ id: issueId, note: "First" });
    expect(await handlers["exceptions.resolve"]({ id: issueId, note: "Second" })).toMatchObject({
      ok: true,
      data: { event: { resolutionNote: "First" } },
    });
  });
});
