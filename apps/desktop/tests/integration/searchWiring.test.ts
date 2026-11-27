import type { Item } from "@shopos/core";
import { buildHandlersFixture } from "../helpers/handlersFixture";

/**
 * Spec 002 T024: the search index lives with the services and the item commands keep it current,
 * so an item created or changed at the counter is found by the next search.
 */
async function createThroughCommand(
  fixture: ReturnType<typeof buildHandlersFixture>,
  name: string,
): Promise<Item> {
  const result = await fixture.handlers["items.create"]({
    name,
    unit: "pcs",
    pricePaise: 4_500,
    openingQtyMilli: 0,
  });
  if (!result.ok) throw new Error(result.message);
  return result.data.item;
}

const foundIds = (fixture: ReturnType<typeof buildHandlersFixture>, query: string) =>
  fixture.services.search.search(query).map((searchResult) => searchResult.id);

describe("the item commands keep search current (spec 002 T024)", () => {
  it("finds an item the moment items.create saves it", async () => {
    const fixture = buildHandlersFixture();

    const elbow = await createThroughCommand(fixture, "Elbow 1 inch");

    expect(foundIds(fixture, "elbow")).toEqual([elbow.id]);
  });

  it("finds a renamed item by its new name after items.update", async () => {
    const fixture = buildHandlersFixture();
    const elbow = await createThroughCommand(fixture, "Elbow 1 inch");

    await fixture.handlers["items.update"]({ id: elbow.id, name: "Bend 1 inch" });

    expect(foundIds(fixture, "bend")).toEqual([elbow.id]);
    expect(foundIds(fixture, "elbow")).toEqual([]);
  });

  it("drops an item deactivated through items.update", async () => {
    const fixture = buildHandlersFixture();
    const elbow = await createThroughCommand(fixture, "Elbow 1 inch");

    await fixture.handlers["items.update"]({ id: elbow.id, active: false });

    expect(foundIds(fixture, "elbow")).toEqual([]);
  });

  it("leaves search unchanged when a command is refused", async () => {
    const fixture = buildHandlersFixture();
    await createThroughCommand(fixture, "Elbow 1 inch");

    const duplicate = await fixture.handlers["items.create"]({
      name: "Elbow 1 inch",
      unit: "pcs",
      pricePaise: 4_500,
      openingQtyMilli: 0,
    });

    expect(duplicate.ok).toBe(false);
    expect(foundIds(fixture, "elbow")).toHaveLength(1);
  });
});
