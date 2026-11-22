import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithTheme } from "../../../../../../../tests/helpers/renderWithTheme";
import type { IBillForm } from "../../../billForm";
import { RecoverDraftDialog } from "./RecoverDraftDialog";

function buildDraftForm(lineNames: string[]): IBillForm {
  return {
    clientBillId: "client-bill-1",
    draft: {
      lines: lineNames.map((lineName, lineIndex) => ({
        key: `line-${lineIndex}`,
        itemId: `item-${lineIndex}`,
        name: lineName,
        unit: "pcs",
        allowsDecimal: false,
        qty: "1",
        rate: "120.00",
        disc: "",
        discMode: "rupees",
      })),
      billDisc: "",
      billDiscMode: "rupees",
    },
    customerName: "",
    paymentMode: "cash",
  };
}

describe("RecoverDraftDialog", () => {
  it("says what was found: a Draft word, the line count and the item names", () => {
    renderWithTheme(
      <RecoverDraftDialog
        draftForm={buildDraftForm(["Pipe 20mm", "Elbow"])}
        onDiscard={() => {}}
        onContinue={() => {}}
      />,
    );

    expect(screen.getByText("Unsaved bill found")).toBeTruthy();
    expect(screen.getByText("Draft")).toBeTruthy();
    expect(screen.getByText(/2 lines: Pipe 20mm, Elbow/)).toBeTruthy();
  });

  it("uses the singular for a one-line bill", () => {
    renderWithTheme(
      <RecoverDraftDialog
        draftForm={buildDraftForm(["Pipe 20mm"])}
        onDiscard={() => {}}
        onContinue={() => {}}
      />,
    );

    expect(screen.getByText(/1 line: Pipe 20mm/)).toBeTruthy();
  });

  it("calls onContinue when Continue bill is pressed and onDiscard for Discard", async () => {
    const onContinue = vi.fn();
    const onDiscard = vi.fn();
    renderWithTheme(
      <RecoverDraftDialog
        draftForm={buildDraftForm(["Pipe 20mm"])}
        onDiscard={onDiscard}
        onContinue={onContinue}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Continue bill" }));
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });
});
