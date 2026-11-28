import { act, renderHook, waitFor } from "@testing-library/react";
import type { Item } from "@shopos/core";
import { installFakeShopos } from "../../../../../../../tests/helpers/fakeShopos";
import { searchRowOf } from "../../../../../../../tests/helpers/itemFixtures";
import { useItemSearch } from "./useItemSearch";

const PIPE: Item = {
  id: "item-1",
  name: "Pipe 20mm",
  unit: "pcs",
  allowsDecimal: false,
  pricePaise: 12000,
  stockMilli: 10000,
  active: true,
  needsCorrection: false,
};

const ELBOW: Item = { ...PIPE, id: "item-2", name: "Pipe elbow" };

const listCalls = (fake: ReturnType<typeof installFakeShopos>) =>
  fake.calls.filter((fakeCall) => fakeCall.commandName === "items.search");

describe("useItemSearch", () => {
  it("looks nothing up for fewer than two letters", () => {
    const fake = installFakeShopos({ "items.search": () => ({ results: [searchRowOf(PIPE)] }) });
    const { result } = renderHook(() => useItemSearch());

    act(() => result.current.setQuery("p"));

    expect(listCalls(fake)).toHaveLength(0);
    expect(result.current.matches).toEqual([]);
  });

  it("looks up the trimmed query, at most 8 matches, and highlights the first", async () => {
    const fake = installFakeShopos({
      "items.search": () => ({ results: [searchRowOf(PIPE), searchRowOf(ELBOW)] }),
    });
    const { result } = renderHook(() => useItemSearch());
    act(() => result.current.setHighlightedIndex(1));

    act(() => result.current.setQuery("  pi "));

    await waitFor(() =>
      expect(result.current.matches).toEqual([searchRowOf(PIPE), searchRowOf(ELBOW)]),
    );
    expect(listCalls(fake)[0]!.input).toEqual({ query: "pi", limit: 8 });
    expect(result.current.highlightedIndex).toBe(0);
  });

  it("keeps only the answer to the latest query when an earlier one arrives late", async () => {
    let releaseSlowAnswer: (items: Item[]) => void = () => {};
    const slowAnswer = new Promise<Item[]>((resolve) => (releaseSlowAnswer = resolve));
    installFakeShopos({
      "items.search": async (searchInput) =>
        searchInput.query === "pi"
          ? { results: (await slowAnswer).map(searchRowOf) }
          : { results: [searchRowOf(ELBOW)] },
    });
    const { result } = renderHook(() => useItemSearch());

    act(() => result.current.setQuery("pi"));
    act(() => result.current.setQuery("pip"));
    await waitFor(() => expect(result.current.matches).toEqual([searchRowOf(ELBOW)]));
    await act(async () => releaseSlowAnswer([PIPE]));

    expect(result.current.matches).toEqual([searchRowOf(ELBOW)]);
  });

  it("empties the query and the matches on clearSearch", async () => {
    installFakeShopos({ "items.search": () => ({ results: [searchRowOf(PIPE)] }) });
    const { result } = renderHook(() => useItemSearch());
    act(() => result.current.setQuery("pi"));
    await waitFor(() => expect(result.current.matches).toEqual([searchRowOf(PIPE)]));

    act(() => result.current.clearSearch());

    expect(result.current.query).toBe("");
    expect(result.current.matches).toEqual([]);
  });
});
