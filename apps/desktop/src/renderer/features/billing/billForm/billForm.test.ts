import { installFakeShopos } from "../../../../../tests/helpers/fakeShopos";
import { emptyForm, isEmptyForm, loadDraftForm } from "./billForm";
import type { IBillForm } from "./types";

const LINE = { itemId: "item-1", name: "Pipe", unit: "pcs", qty: "2", rate: "120", disc: "" };
const formWith = (change: Partial<IBillForm["draft"]>, customerName = ""): IBillForm => ({
  ...emptyForm(),
  customerName,
  draft: { ...emptyForm().draft, ...change },
});

describe("isEmptyForm", () => {
  it("is empty with no lines, no customer name and no bill discount", () => {
    expect(isEmptyForm(emptyForm())).toBe(true);
  });

  it("is not empty once a line, a customer name or a bill discount is there", () => {
    expect(isEmptyForm(formWith({ lines: [LINE as never] }))).toBe(false);
    expect(isEmptyForm(formWith({}, "Ravi"))).toBe(false);
    expect(isEmptyForm(formWith({ billDisc: "10" }))).toBe(false);
  });
});

describe("emptyForm", () => {
  it("gives every new bill its own id", () => {
    expect(emptyForm().clientBillId).not.toBe(emptyForm().clientBillId);
  });
});

describe("loadDraftForm", () => {
  it("fills in the payment mode and a bill id that an older saved draft lacks", async () => {
    // An older draft: Ravi's 2 pcs of Pipe, saved before paymentMode and clientBillId existed.
    const savedDraft = { lines: [LINE], billDisc: "", billDiscMode: "rupees" };
    installFakeShopos({
      "bills.draft.load": () => ({ payload: { customerName: "Ravi", draft: savedDraft } }),
    });

    const loadedForm = await loadDraftForm();

    expect(loadedForm?.customerName).toBe("Ravi");
    expect(loadedForm?.draft).toEqual(savedDraft);
    expect(loadedForm?.paymentMode).toBe("cash");
    expect(loadedForm?.clientBillId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it.each([
    ["there is no draft", null],
    ["the draft has no lines", formWith({})],
    ["the draft has no bill part", { customerName: "x" }],
    ["the lines are not a list", { draft: { lines: 3 } }],
  ])("returns null when %s", async (_reason, payload) => {
    installFakeShopos({ "bills.draft.load": () => ({ payload }) });

    expect(await loadDraftForm()).toBeNull();
  });
});
