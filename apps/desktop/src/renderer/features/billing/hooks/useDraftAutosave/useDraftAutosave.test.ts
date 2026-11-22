import { renderHook } from "@testing-library/react";
import { installFakeShopos } from "../../../../../../tests/helpers/fakeShopos";
import { emptyForm } from "../../billForm";
import type { IBillForm } from "../../billForm";
import { useDraftAutosave } from "./useDraftAutosave";

const LINE = { itemId: "item-1", name: "Pipe", unit: "pcs", qty: "2", rate: "120", disc: "" };
const AUTOSAVE_WAIT_MILLISECONDS = 300;

const setup = (initialForm: IBillForm, isEnabled = true) => {
  const fake = installFakeShopos({ "bills.draft.save": () => ({}) });
  const hook = renderHook((props) => useDraftAutosave(props.form, props.isEnabled), {
    initialProps: { form: initialForm, isEnabled },
  });
  const saves = () => fake.calls.filter((fakeCall) => fakeCall.commandName === "bills.draft.save");
  return { hook, saves };
};

describe("useDraftAutosave", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("saves nothing for the first form it sees", () => {
    const { saves } = setup(emptyForm());

    vi.advanceTimersByTime(AUTOSAVE_WAIT_MILLISECONDS * 2);

    expect(saves()).toHaveLength(0);
  });

  it("saves the form 300 ms after a change, and only the last of several quick changes", () => {
    const { hook, saves } = setup(emptyForm());
    const changed = { ...emptyForm(), customerName: "Ravi" };
    const changedAgain = { ...changed, customerName: "Ravi K" };

    hook.rerender({ form: changed, isEnabled: true });
    vi.advanceTimersByTime(AUTOSAVE_WAIT_MILLISECONDS - 1);
    hook.rerender({ form: changedAgain, isEnabled: true });
    vi.advanceTimersByTime(AUTOSAVE_WAIT_MILLISECONDS);

    expect(saves().map((save) => save.input)).toEqual([{ payload: changedAgain }]);
  });

  it("clears the stored draft (saves null) when the bill is back to empty", () => {
    const withLine = { ...emptyForm(), draft: { ...emptyForm().draft, lines: [LINE as never] } };
    const { hook, saves } = setup(withLine);

    hook.rerender({ form: emptyForm(), isEnabled: true });
    vi.advanceTimersByTime(AUTOSAVE_WAIT_MILLISECONDS);

    expect(saves().map((save) => save.input)).toEqual([{ payload: null }]);
  });

  it("saves nothing while it is switched off", () => {
    const { hook, saves } = setup(emptyForm(), false);

    hook.rerender({ form: { ...emptyForm(), customerName: "Ravi" }, isEnabled: false });
    vi.advanceTimersByTime(AUTOSAVE_WAIT_MILLISECONDS * 2);

    expect(saves()).toHaveLength(0);
  });

  it("keeps working when the save fails", () => {
    const fake = installFakeShopos();
    const hook = renderHook((props) => useDraftAutosave(props.form, true), {
      initialProps: { form: emptyForm() },
    });

    hook.rerender({ form: { ...emptyForm(), customerName: "Ravi" } });
    vi.advanceTimersByTime(AUTOSAVE_WAIT_MILLISECONDS);

    expect(fake.calls).toHaveLength(1);
  });
});
