import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { evaluateDraft, type DraftBill, type DraftLine } from "@shopos/core";
import { renderWithTheme } from "../../../../../../../tests/helpers/renderWithTheme";
import { emptyForm, type IBillForm } from "../../../billForm";
import { BillSummaryPanel } from "./BillSummaryPanel";

const PIPE_LINE: DraftLine = {
  key: "line-1",
  itemId: "item-1",
  name: "Pipe 20mm",
  unit: "pcs",
  allowsDecimal: false,
  qty: "2",
  rate: "120",
  disc: "",
  discMode: "rupees",
};

function buildForm(draftPatch: Partial<DraftBill> = {}): IBillForm {
  const startingForm = emptyForm();
  return {
    ...startingForm,
    draft: { ...startingForm.draft, lines: [PIPE_LINE], ...draftPatch },
  };
}

function renderPanel(form: IBillForm, overrides: Partial<{ isSaving: boolean }> = {}) {
  const callbacks = {
    onFormChange: vi.fn(),
    onDraftChange: vi.fn(),
    onClear: vi.fn(),
    onSave: vi.fn(),
  };
  renderWithTheme(
    <BillSummaryPanel
      form={form}
      evaluation={evaluateDraft(form.draft)}
      isSaving={overrides.isSaving ?? false}
      {...callbacks}
    />,
  );
  return callbacks;
}

describe("BillSummaryPanel", () => {
  it("shows the lines total and the grand total in rupees", () => {
    renderPanel(buildForm());

    expect(screen.getByText("Grand total: ₹240.00")).toBeTruthy();
    expect(
      screen.getByText((_text, element) => element?.textContent === "Total: ₹240.00"),
    ).toBeTruthy();
  });

  it("shows the discount taken off, and the lower grand total", () => {
    renderPanel(buildForm({ billDisc: "40" }));

    expect(screen.getByText("-₹40.00")).toBeTruthy();
    expect(screen.getByText("Grand total: ₹200.00")).toBeTruthy();
  });

  it("says Error and the reason when the discount is more than the total", () => {
    renderPanel(buildForm({ billDisc: "500" }));

    const errorMessage = screen.getByRole("alert");
    expect(errorMessage.textContent).toMatch(/^Error /);
  });

  it("calls onSave when Save bill is pressed on a valid bill", async () => {
    const callbacks = renderPanel(buildForm());
    await userEvent.click(screen.getByRole("button", { name: /Save bill/ }));
    expect(callbacks.onSave).toHaveBeenCalledTimes(1);
  });

  it("keeps Save disabled for an empty bill", () => {
    renderPanel({ ...emptyForm() });

    expect((screen.getByRole("button", { name: /Save bill/ }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("keeps Clear bill disabled for an empty bill", async () => {
    renderPanel({ ...emptyForm() });
    expect((screen.getByRole("button", { name: "Clear bill" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("calls onClear when Clear bill is pressed on a bill with lines", async () => {
    const callbacks = renderPanel(buildForm());

    await userEvent.click(screen.getByRole("button", { name: "Clear bill" }));

    expect(callbacks.onClear).toHaveBeenCalledTimes(1);
  });

  it("reports the typed customer name and the typed discount", async () => {
    const callbacks = renderPanel(buildForm());

    await userEvent.type(screen.getByRole("textbox", { name: /Customer name/ }), "A");
    await userEvent.type(screen.getByRole("textbox", { name: "Bill discount" }), "5");

    expect(callbacks.onFormChange).toHaveBeenCalledWith({ customerName: "A" });
    expect(callbacks.onDraftChange).toHaveBeenCalledWith({ billDisc: "5" });
  });
});
