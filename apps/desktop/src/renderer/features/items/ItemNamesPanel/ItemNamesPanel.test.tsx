import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  IFamilyDetail,
  VariantsSetBarcodesInput,
  VariantsSetSearchNamesInput,
} from "@shopos/core";
import { installFakeShopos } from "../../../../../tests/helpers/fakeShopos";
import { buildItem } from "../../../../../tests/helpers/itemFixtures";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { uiText } from "../../../shared/text/strings";
import { ItemNamesPanel } from "./ItemNamesPanel";

/** Spec 002 T049 (FR-007, EC-07): an item's search names and barcodes, with a shared-code warning. */
const ELBOW = buildItem({ id: "elbow", name: "Elbow 1 inch", familyId: "elbow-family" });
const DETAIL = {
  family: {} as IFamilyDetail["family"],
  variants: [],
  conversions: [],
  barcodes: [{ id: "code-1", variantId: "elbow", code: "OLD-1", source: "shop_label" }],
  searchNames: [{ id: "name-1", variantId: "elbow", name: "bend", language: "en", kind: "trade" }],
} satisfies IFamilyDetail;

function renderPanel() {
  const fake = installFakeShopos({
    "families.get": () => DETAIL,
    "variants.setSearchNames": () => ({ searchNames: [] }),
    "variants.setBarcodes": () => ({
      barcodes: [],
      sharedWith: [{ code: "8901234567890", variantId: "elbow-grey", displayName: "Elbow grey" }],
    }),
  });
  renderWithTheme(<ItemNamesPanel item={ELBOW} onClose={vi.fn()} />);
  return fake;
}

const sentInput = <TInput,>(fake: ReturnType<typeof renderPanel>, commandName: string) =>
  fake.calls.find((call) => call.commandName === commandName)?.input as TInput;

describe("ItemNamesPanel (spec 002 T049)", () => {
  it("shows the item's names with their language and kind, and its codes with their source", async () => {
    renderPanel();

    expect(await screen.findByText("bend")).toBeTruthy();
    expect(
      screen.getByText(`${uiText.names.languages.en}, ${uiText.names.kinds.trade}`),
    ).toBeTruthy();
    expect(screen.getByText("OLD-1")).toBeTruthy();
    expect(screen.getByText(uiText.names.sources.shop_label)).toBeTruthy();
  });

  it("saves an added name and code, then says which other item shares the code", async () => {
    const fake = renderPanel();
    await screen.findByText("bend");

    await userEvent.type(screen.getByRole("textbox", { name: uiText.names.newName }), "nali");
    await userEvent.click(screen.getByRole("button", { name: uiText.names.addName }));
    await userEvent.type(
      screen.getByRole("textbox", { name: uiText.names.newCode }),
      "8901234567890",
    );
    await userEvent.click(screen.getByRole("button", { name: uiText.names.addCode }));
    await userEvent.click(screen.getByRole("button", { name: uiText.names.save }));

    expect(sentInput<VariantsSetSearchNamesInput>(fake, "variants.setSearchNames")).toEqual({
      variantIds: ["elbow"],
      names: [
        { name: "bend", language: "en", kind: "trade" },
        { name: "nali", language: "hinglish", kind: "alias" },
      ],
    });
    expect(sentInput<VariantsSetBarcodesInput>(fake, "variants.setBarcodes")).toEqual({
      variantId: "elbow",
      barcodes: [
        { code: "OLD-1", source: "shop_label" },
        { code: "8901234567890", source: "manufacturer" },
      ],
    });
    expect(
      await screen.findByText(
        uiText.names.sharedWith.replace("{code}", "8901234567890").replace("{items}", "Elbow grey"),
      ),
    ).toBeTruthy();
  });

  it("leaves out a removed name", async () => {
    const fake = renderPanel();
    await screen.findByText("bend");

    await userEvent.click(
      screen.getByRole("button", { name: uiText.names.remove.replace("{value}", "bend") }),
    );
    await userEvent.click(screen.getByRole("button", { name: uiText.names.save }));

    expect(sentInput<VariantsSetSearchNamesInput>(fake, "variants.setSearchNames").names).toEqual(
      [],
    );
  });
});
