import { act, renderHook, waitFor } from "@testing-library/react";
import type { Item } from "@shopos/core";
import { installFakeShopos } from "../../../../../../tests/helpers/fakeShopos";
import { useItems } from "./useItems";
import type { IItemFilter } from "./types";

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
const NO_FILTER: IItemFilter = { query: "", includeInactive: false, needsCorrection: false };

describe("useItems", () => {
  it("loads the list and its total, and asks for the filter it was given", async () => {
    const fake = installFakeShopos({ "items.list": () => ({ items: [PIPE], total: 41 }) });

    const { result } = renderHook(() => useItems({ ...NO_FILTER, query: "pipe" }, 50));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([PIPE]);
    expect(result.current.total).toBe(41);
    expect(fake.calls[0]!.input).toEqual({
      query: "pipe",
      includeInactive: false,
      needsCorrection: false,
      limit: 50,
      offset: 0,
    });
  });

  it("sends no query when the search box is empty", async () => {
    const fake = installFakeShopos({ "items.list": () => ({ items: [], total: 0 }) });

    renderHook(() => useItems(NO_FILTER));

    await waitFor(() => expect(fake.calls).toHaveLength(1));
    expect((fake.calls[0]!.input as { query?: string }).query).toBeUndefined();
  });

  it("reads the list again when reload is called", async () => {
    const fake = installFakeShopos({ "items.list": () => ({ items: [PIPE], total: 1 }) });
    const { result } = renderHook(() => useItems(NO_FILTER));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.reload());

    await waitFor(() => expect(fake.calls).toHaveLength(2));
  });

  it("ignores an answer that arrives after the filter has changed", async () => {
    type Answer = { items: Item[]; total: number };
    const answers = new Map<string, (answer: Answer) => void>();
    installFakeShopos({
      "items.list": (input) =>
        new Promise<Answer>((resolve) => answers.set(input.query ?? "", resolve)),
    });
    const { result, rerender } = renderHook((props) => useItems(props.filter), {
      initialProps: { filter: { ...NO_FILTER, query: "old" } },
    });

    rerender({ filter: { ...NO_FILTER, query: "new" } });
    await waitFor(() => expect(answers.has("new")).toBe(true));
    await act(async () => {
      answers.get("new")!({ items: [PIPE], total: 1 });
      answers.get("old")!({ items: [], total: 0 });
    });

    expect(result.current.items).toEqual([PIPE]);
    expect(result.current.total).toBe(1);
  });
});
