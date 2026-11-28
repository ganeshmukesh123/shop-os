import { buildHandlersFixture } from "../helpers/handlersFixture";

/**
 * Spec 002 T038 backend (contracts items.search, families.grid): the bill search answers from the
 * in-memory index, one row per family of several variants, and the grid lays out that family.
 */
const pipe = (size: string, pipeClass: string, openingQtyMilli = 10_000) => ({
  axes: { size, class: pipeClass },
  baseUom: "pcs",
  allowDecimal: false,
  sellingPricePaise: 12_000,
  openingQtyMilli,
});

async function shopWithPipesAndElbow() {
  const fixture = buildHandlersFixture();
  const family = await fixture.handlers["families.create"]({
    family: { name: "PVC Pipe Supreme", kind: "general", axisKeys: ["size", "class"] },
    variants: [pipe("1 in", "4 kg"), pipe("1 in", "6 kg", 0), pipe("2 in", "4 kg")],
  });
  if (!family.ok) throw new Error(family.message);
  const elbow = await fixture.handlers["items.create"]({
    name: "Elbow 1 inch",
    unit: "pcs",
    pricePaise: 4_500,
    openingQtyMilli: 3_000,
  });
  if (!elbow.ok) throw new Error(elbow.message);
  return { ...fixture, familyId: family.data.family.id, elbowId: elbow.data.item.id };
}

describe("items.search (spec 002 T038)", () => {
  it("shows a family of several variants as one row, and a one-variant item as its own row", async () => {
    const { handlers, familyId, elbowId } = await shopWithPipesAndElbow();

    const pipes = await handlers["items.search"]({ query: "pipe", limit: 10 });
    const elbows = await handlers["items.search"]({ query: "elbow", limit: 10 });

    expect(pipes.ok && pipes.data.results).toEqual([
      expect.objectContaining({
        kind: "family",
        id: familyId,
        displayName: "PVC Pipe Supreme",
        matchedBy: "whole_word",
        stockMilli: 20_000,
      }),
    ]);
    expect(elbows.ok && elbows.data.results).toEqual([
      expect.objectContaining({
        kind: "variant",
        id: elbowId,
        displayName: "Elbow 1 inch",
        stockMilli: 3_000,
        pricePaise: 4_500,
        item: expect.objectContaining({ id: elbowId, unit: "pcs", allowsDecimal: false }),
      }),
    ]);
  });

  it("finds an item with a typo, and returns at most `limit` rows", async () => {
    const { handlers } = await shopWithPipesAndElbow();

    const typo = await handlers["items.search"]({ query: "elbo", limit: 10 });
    const none = await handlers["items.search"]({ query: "elbow", limit: 0 });

    expect(typo.ok && typo.data.results.map((row) => row.displayName)).toEqual(["Elbow 1 inch"]);
    expect(none).toMatchObject({ ok: false, code: "INVALID_FIELD" });
  });
});

describe("families.grid (spec 002 T038)", () => {
  it("lays the family out with sizes on rows and classes on columns, each cell billable", async () => {
    const { handlers, familyId } = await shopWithPipesAndElbow();

    const grid = await handlers["families.grid"]({ familyId });

    expect(grid.ok && grid.data.axisKeys).toEqual(["size", "class"]);
    expect(grid.ok && grid.data.tabs[0]!.rowValues).toEqual(["1 in", "2 in"]);
    expect(grid.ok && grid.data.tabs[0]!.columnValues).toEqual(["4 kg", "6 kg"]);
    expect(grid.ok && grid.data.tabs[0]!.cells[1]![1]).toBeNull();
    expect(grid.ok && grid.data.items.map((item) => item.stockMilli)).toEqual([10_000, 0, 10_000]);
  });

  it("says NOT_FOUND for a family that is not there", async () => {
    const { handlers } = await shopWithPipesAndElbow();

    expect(await handlers["families.grid"]({ familyId: "no-such-family" })).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
  });
});
