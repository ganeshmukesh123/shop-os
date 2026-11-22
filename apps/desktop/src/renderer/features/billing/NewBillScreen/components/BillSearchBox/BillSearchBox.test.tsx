import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Item } from "@shopos/core";
import { renderWithTheme } from "../../../../../../../tests/helpers/renderWithTheme";
import { BillSearchBox } from "./BillSearchBox";
import type { IBillSearchBoxProps } from "./types";

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

const ELBOW: Item = {
  ...PIPE,
  id: "item-2",
  name: "Pipe elbow",
  pricePaise: 4500,
  stockMilli: -3000,
  needsCorrection: true,
};

const SEARCH_LABEL = /Type 2 or more letters/;

function renderSearchBox(props: Partial<IBillSearchBoxProps> = {}) {
  const callbacks = { onQueryChange: vi.fn(), onHighlightChange: vi.fn(), onChoose: vi.fn() };
  renderWithTheme(
    <BillSearchBox
      query="pi"
      matches={[PIPE, ELBOW]}
      highlightedIndex={0}
      {...callbacks}
      {...props}
    />,
  );
  return callbacks;
}

async function pressKey(keyName: string) {
  await userEvent.type(screen.getByRole("textbox", { name: SEARCH_LABEL }), keyName);
}

describe("BillSearchBox: what it shows", () => {
  it("shows no dropdown until two letters are typed", () => {
    renderSearchBox({ query: "p", matches: [] });

    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("says so when nothing matches", () => {
    renderSearchBox({ query: "zz", matches: [] });

    expect(screen.getByText("No matching items")).toBeTruthy();
  });

  it("lists each match with its unit, price and stock, and says Negative for stock below zero", () => {
    renderSearchBox();

    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(screen.getByText(/₹120\.00 · stock 10/)).toBeTruthy();
    expect(screen.getByText(/₹45\.00 · stock -3 \(negative\)/)).toBeTruthy();
  });

  it("marks the highlighted match with aria-selected", () => {
    renderSearchBox({ highlightedIndex: 1 });

    const selectedStates = screen.getAllByRole("option").map((option) => option.ariaSelected);
    expect(selectedStates).toEqual(["false", "true"]);
  });
});

describe("BillSearchBox: keyboard and mouse", () => {
  it("reports each letter typed", async () => {
    const callbacks = renderSearchBox({ query: "", matches: [] });

    await pressKey("p");

    expect(callbacks.onQueryChange).toHaveBeenCalledWith("p");
  });

  it("moves the highlight down and up, never past the first or last match", async () => {
    const callbacks = renderSearchBox({ highlightedIndex: 1 });

    await pressKey("{ArrowDown}");
    await pressKey("{ArrowUp}");

    expect(callbacks.onHighlightChange).toHaveBeenNthCalledWith(1, 1);
    expect(callbacks.onHighlightChange).toHaveBeenNthCalledWith(2, 0);
  });

  it("chooses the highlighted match when Enter is pressed", async () => {
    const callbacks = renderSearchBox({ highlightedIndex: 1 });

    await pressKey("{Enter}");

    expect(callbacks.onChoose).toHaveBeenCalledWith(ELBOW);
  });

  it("chooses nothing on Enter when there are no matches", async () => {
    const callbacks = renderSearchBox({ query: "zz", matches: [] });

    await pressKey("{Enter}");

    expect(callbacks.onChoose).not.toHaveBeenCalled();
  });

  it("empties the query on Escape", async () => {
    const callbacks = renderSearchBox();

    await pressKey("{Escape}");

    expect(callbacks.onQueryChange).toHaveBeenCalledWith("");
  });

  it("chooses a match that is clicked, and highlights the one the mouse is over", async () => {
    const callbacks = renderSearchBox();
    const [, secondOption] = screen.getAllByRole("option");

    await userEvent.hover(secondOption!);
    await userEvent.click(secondOption!);

    expect(callbacks.onHighlightChange).toHaveBeenCalledWith(1);
    expect(callbacks.onChoose).toHaveBeenCalledWith(ELBOW);
  });
});
