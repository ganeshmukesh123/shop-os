import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ILikelyDuplicate, IUnit, ItemsCheckDuplicatesInput } from "@shopos/core";
import { installFakeShopos } from "../../../../../tests/helpers/fakeShopos";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { uiText } from "../../../shared/text/strings";
import { FamilyForm } from "./FamilyForm";

/** Spec 002 T050 (FR-008, US2 scenario 4): likely duplicates are shown before the family is saved. */
const UNITS: IUnit[] = [{ code: "pcs", label: "Pieces", dimension: "count", allowDecimal: false }];
const EXISTING: ILikelyDuplicate = {
  variantId: "pipe-1",
  displayName: "PVC Pipe 1 in",
  reason: "similar_name",
};

function renderWithExisting(candidates = [EXISTING]) {
  const fake = installFakeShopos({
    "families.previewVariants": () => ({
      combinations: [{ axes: { size: "1 in" }, axisSignature: "size=1 in", displayName: "1 in" }],
    }),
    "items.checkDuplicates": () => ({ candidates }),
    "families.create": (input) => ({
      family: {
        id: "family-1",
        name: input.family.name,
        kind: "general",
        categoryId: null,
        brandId: null,
        spec: {},
        axisKeys: [],
      },
      variants: [],
      duplicates: [],
    }),
  });
  const onSaved = vi.fn();
  const onOpenExisting = vi.fn();
  renderWithTheme(
    <FamilyForm
      categories={[]}
      brands={[]}
      units={UNITS}
      onClose={vi.fn()}
      onSaved={onSaved}
      onOpenExisting={onOpenExisting}
    />,
  );
  return { fake, onSaved, onOpenExisting };
}

async function fillAndSave() {
  await userEvent.type(screen.getByRole("textbox", { name: uiText.family.name }), "Pipe PVC");
  await userEvent.click(screen.getByRole("combobox", { name: uiText.family.unit }));
  await userEvent.click(await screen.findByRole("option", { name: "Pieces" }));
  await userEvent.click(screen.getByRole("checkbox", { name: /^Size$/ }));
  await userEvent.type(
    screen.getByRole("textbox", { name: "Values for Size, separated by commas" }),
    "1 in",
  );
  await userEvent.click(screen.getByRole("button", { name: uiText.family.preview }));
  await userEvent.type(await screen.findByRole("textbox", { name: "Price (₹) for 1 in" }), "120");
  await userEvent.click(screen.getByRole("button", { name: uiText.family.save }));
}

const created = (fake: ReturnType<typeof renderWithExisting>["fake"]) =>
  fake.calls.filter((sent) => sent.commandName === "families.create");

describe("FamilyForm likely duplicates (spec 002 T050)", () => {
  it("checks each kept variant by its full name and shows the match with its reason, saving nothing", async () => {
    const { fake } = renderWithExisting();

    await fillAndSave();

    const checked = fake.calls.find((sent) => sent.commandName === "items.checkDuplicates")!
      .input as ItemsCheckDuplicatesInput;
    expect(checked.draft).toMatchObject({ name: "Pipe PVC 1 in", axisSignature: "size=1 in" });
    await screen.findByText(uiText.family.duplicates.intro);
    expect(screen.getByText(/PVC Pipe 1 in \(/).textContent).toBe(
      `PVC Pipe 1 in (${uiText.family.duplicates.reasons.similar_name})`,
    );
    expect(created(fake)).toEqual([]);
  });

  it("saves after Save anyway, without asking again", async () => {
    const { fake, onSaved } = renderWithExisting();
    await fillAndSave();

    await userEvent.click(
      await screen.findByRole("button", { name: uiText.family.duplicates.saveAnyway }),
    );

    expect(created(fake)).toHaveLength(1);
    expect(onSaved).toHaveBeenCalled();
  });

  it("opens the existing item instead", async () => {
    const { onOpenExisting } = renderWithExisting();
    await fillAndSave();

    await userEvent.click(
      await screen.findByRole("button", {
        name: `${uiText.family.duplicates.openExisting}: PVC Pipe 1 in`,
      }),
    );

    expect(onOpenExisting).toHaveBeenCalledWith(EXISTING);
  });

  it("saves straight away when nothing looks the same", async () => {
    const { fake } = renderWithExisting([]);

    await fillAndSave();

    expect(created(fake)).toHaveLength(1);
  });
});
