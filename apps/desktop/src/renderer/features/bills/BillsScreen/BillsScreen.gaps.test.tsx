import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { IRecordedNumberGap } from "@shopos/core";
import {
  installFakeShopos,
  type FakeCommandHandlers,
} from "../../../../../tests/helpers/fakeShopos";
import { buildBill } from "../../../../../tests/helpers/billFixtures";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { BillsScreen } from "./BillsScreen";

const CONFIRMED_GAP: IRecordedNumberGap = {
  id: "gap-1",
  fromNumber: "C1/26-27/000121",
  toNumber: "C1/26-27/000126",
  seqFrom: 121,
  seqTo: 126,
  isEstimated: false,
  recordedAt: "2026-11-15T10:00:00.000Z",
};
const GUESSED_GAP: IRecordedNumberGap = {
  ...CONFIRMED_GAP,
  id: "gap-2",
  fromNumber: "C1/26-27/000127",
  toNumber: "C1/26-27/000226",
  seqFrom: 127,
  seqTo: 226,
  isEstimated: true,
};

function renderBillsScreen(gaps: IRecordedNumberGap[], handlers: FakeCommandHandlers = {}) {
  installFakeShopos({
    "bills.list": () => ({ bills: [buildBill()], total: 1 }),
    "bills.gaps": () => ({ gaps }),
    ...handlers,
  });
  renderWithTheme(<BillsScreen />);
}

const lostRow = async (fromNumber: string) =>
  (await screen.findByRole("rowheader", { name: new RegExp(fromNumber) })).closest("tr")!;

describe("BillsScreen: numbers lost in a restore (FR-013b, T084)", () => {
  it("shows each lost run in the list with the words Lost in restore", async () => {
    renderBillsScreen([CONFIRMED_GAP]);

    const row = await lostRow("000121");

    expect(row.textContent).toContain("C1/26-27/000121 to C1/26-27/000126");
    expect(within(row).getByText("Lost in restore")).toBeTruthy();
    expect(screen.getByRole("button", { name: "C1/26-27/000001" })).toBeTruthy();
  });

  it("says when the run is only a block of 100 that was guessed, and not for a confirmed one", async () => {
    renderBillsScreen([CONFIRMED_GAP, GUESSED_GAP]);

    const guessedRow = await lostRow("000127");
    const confirmedRow = await lostRow("000121");

    expect(within(guessedRow).getByText(/block of 100 numbers/)).toBeTruthy();
    expect(within(confirmedRow).queryByText(/block of 100 numbers/)).toBeNull();
  });

  it("shows no lost-number row when a restore lost nothing", async () => {
    renderBillsScreen([]);

    await screen.findByRole("button", { name: "C1/26-27/000001" });

    expect(screen.queryByText("Lost in restore")).toBeNull();
  });

  it("hides the lost runs while a search is typed, because they have no customer or date", async () => {
    renderBillsScreen([CONFIRMED_GAP]);
    await lostRow("000121");

    await userEvent.type(screen.getByRole("textbox", { name: "Customer name" }), "ram");

    expect(screen.queryByText("Lost in restore")).toBeNull();
  });

  it("shows why the lost numbers could not be read", async () => {
    renderBillsScreen([], {
      "bills.gaps": () => {
        throw Object.assign(new Error("The database is busy"), { code: "INTERNAL" });
      },
    });

    expect((await screen.findByRole("alert")).textContent).toBe("Error The database is busy");
  });
});
