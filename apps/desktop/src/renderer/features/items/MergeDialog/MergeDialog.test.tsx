import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Item, ItemsMergeInput } from "@shopos/core";
import { installFakeShopos } from "../../../../../tests/helpers/fakeShopos";
import { buildItem } from "../../../../../tests/helpers/itemFixtures";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { uiText } from "../../../shared/text/strings";
import { MergeDialog } from "./MergeDialog";

/** Spec 002 T051 (FR-008, research D6): merge a duplicate into the item to keep. */
const DUPLICATE: Item = buildItem({ id: "pipe-b", name: "Pipe PVC one inch", stockMilli: 4_000 });
const KEEP: Item = buildItem({ id: "pipe-a", name: "PVC Pipe 1 inch", stockMilli: 10_000 });
const WIRE: Item = buildItem({ id: "wire", name: "Pipe wire", unit: "metre", stockMilli: 90_000 });

function renderMergeDialog() {
  const fake = installFakeShopos({
    "items.list": () => ({ items: [DUPLICATE, KEEP, WIRE], total: 3 }),
    "items.merge": () => ({
      mergeLog: {} as never,
      survivor: { ...KEEP, stockMilli: 14_000 },
    }),
  });
  const onMerged = vi.fn();
  renderWithTheme(<MergeDialog item={DUPLICATE} onClose={vi.fn()} onMerged={onMerged} />);
  return { fake, onMerged };
}

async function chooseKeep() {
  const text = uiText.merge;
  await userEvent.type(screen.getByRole("textbox", { name: text.findSurvivor }), "pipe");
  await userEvent.click(await screen.findByRole("radio", { name: "PVC Pipe 1 inch" }));
}

describe("MergeDialog (spec 002 T051)", () => {
  it("offers only other items counted in the same unit", async () => {
    renderMergeDialog();

    await chooseKeep();

    // The duplicate itself and the wire (metre, not pcs) are not offered
    expect(screen.getAllByRole("radio")).toHaveLength(1);
    expect(screen.queryByRole("radio", { name: "Pipe wire" })).toBeNull();
  });

  it("shows what moves before merging: 4 pcs, giving 14 pcs, old bills unchanged", async () => {
    renderMergeDialog();

    await chooseKeep();

    expect(
      screen.getByText("4 pcs move to PVC Pipe 1 inch, which will then have 14 pcs."),
    ).toBeTruthy();
    expect(
      screen.getByText(uiText.merge.billsStay.replace("{item}", "Pipe PVC one inch")),
    ).toBeTruthy();
  });

  it("needs a reason, then merges the duplicate into the chosen item", async () => {
    const { fake, onMerged } = renderMergeDialog();
    await chooseKeep();

    await userEvent.click(screen.getByRole("button", { name: uiText.merge.merge }));
    expect(await screen.findByText(uiText.merge.reasonRequired)).toBeTruthy();
    expect(fake.calls.some((sent) => sent.commandName === "items.merge")).toBe(false);

    await userEvent.type(
      screen.getByRole("textbox", { name: uiText.merge.reason }),
      "Entered twice",
    );
    await userEvent.click(screen.getByRole("button", { name: uiText.merge.merge }));

    const sent = fake.calls.find((call) => call.commandName === "items.merge")!
      .input as ItemsMergeInput;
    expect(sent).toEqual({ survivorId: "pipe-a", mergedId: "pipe-b", reason: "Entered twice" });
    expect(onMerged).toHaveBeenCalledWith(
      expect.objectContaining({ id: "pipe-a", stockMilli: 14_000 }),
    );
  });
});
