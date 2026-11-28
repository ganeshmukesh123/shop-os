import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { IMergeListRow, ItemsMergeReverseInput } from "@shopos/core";
import { installFakeShopos } from "../../../../../tests/helpers/fakeShopos";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { uiText } from "../../../shared/text/strings";
import { MergeLogButton } from "./MergeLogButton";
import { reversalDaysLeft } from "./reversalDaysLeft";

/** Spec 002 T051, log half: past merges, with Reverse and the days left until the window closes. */
const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.now();

function mergeRow(
  id: string,
  mergedName: string,
  overrides: Partial<IMergeListRow>,
): IMergeListRow {
  return {
    id,
    action: "merge",
    survivorId: "pipe-a",
    mergedId: `${id}-merged`,
    mergeLogId: null,
    moved: [],
    movedBatchIds: [],
    movedBarcodeIds: [],
    movedSearchNameIds: [],
    reason: "Entered twice",
    userLabel: "Owner",
    reversibleUntil: NOW + 20 * DAY_MS,
    createdAt: NOW - 10 * DAY_MS,
    survivorName: "PVC Pipe 1 inch",
    mergedName,
    isReversed: false,
    ...overrides,
  };
}

const ROWS = [
  mergeRow("open", "Pipe PVC one inch", {}),
  mergeRow("undone", "Pipe 1in", { isReversed: true }),
  mergeRow("closed", "PVC pipe 1", { reversibleUntil: NOW - DAY_MS, createdAt: NOW - 31 * DAY_MS }),
];

async function openLog() {
  const fake = installFakeShopos({
    "items.merge.list": () => ({ merges: ROWS, total: 3 }),
    "items.merge.reverse": () => ({ reverseLog: {} as never }),
  });
  const onReversed = vi.fn();
  renderWithTheme(<MergeLogButton onReversed={onReversed} />);
  await userEvent.click(screen.getByRole("button", { name: uiText.mergeLog.open }));
  return { fake, onReversed };
}

const rowOf = async (name: string) =>
  (await screen.findByRole("rowheader", { name: new RegExp(name) })).closest("tr")!;

describe("MergeLogButton (spec 002 T051)", () => {
  it("says for each merge whether it can still be reversed, and for how many days", async () => {
    await openLog();

    expect(within(await rowOf("Pipe PVC one inch")).getByText("20 days left")).toBeTruthy();
    expect(within(await rowOf("Pipe 1in")).getByText(uiText.mergeLog.reversed)).toBeTruthy();
    expect(within(await rowOf("PVC pipe 1")).getByText(uiText.mergeLog.closed)).toBeTruthy();
  });

  it("reverses an open merge with a reason, then reloads", async () => {
    const { fake, onReversed } = await openLog();
    const row = await rowOf("Pipe PVC one inch");

    await userEvent.click(within(row).getByRole("button", { name: uiText.mergeLog.reverse }));
    await userEvent.type(
      within(row).getByRole("textbox", { name: uiText.mergeLog.reason }),
      "Mistake",
    );
    await userEvent.click(within(row).getByRole("button", { name: uiText.mergeLog.confirm }));

    const sent = fake.calls.find((call) => call.commandName === "items.merge.reverse")!
      .input as ItemsMergeReverseInput;
    expect(sent).toEqual({ mergeLogId: "open", reason: "Mistake" });
    expect(onReversed).toHaveBeenCalled();
    expect(fake.calls.filter((call) => call.commandName === "items.merge.list")).toHaveLength(2);
  });
});

describe("reversalDaysLeft (spec 002 T051)", () => {
  it("counts part of a day as a day, and nothing once the window has closed", () => {
    expect(reversalDaysLeft(NOW + 29.5 * DAY_MS, NOW)).toBe(30);
    expect(reversalDaysLeft(NOW - 1, NOW)).toBe(0);
    expect(reversalDaysLeft(null, NOW)).toBe(0);
  });
});
