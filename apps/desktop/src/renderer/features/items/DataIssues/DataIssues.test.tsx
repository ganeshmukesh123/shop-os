import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ExceptionsListInput, ExceptionsResolveInput, IExceptionEvent } from "@shopos/core";
import { installFakeShopos } from "../../../../../tests/helpers/fakeShopos";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { uiText } from "../../../shared/text/strings";
import { DataIssuesButton } from "./DataIssuesButton";

/** Spec 002 T052: data issues, open and resolved, resolved with a note. */
const SHARED_CODE: IExceptionEvent = {
  id: "issue-1",
  kind: "duplicate_barcode",
  subjectIds: ["elbow", "elbow-grey"],
  subjectNames: ["Elbow 1 inch", "Elbow grey"],
  detail: "8901234567890",
  status: "open",
  resolvedAt: null,
  resolutionNote: null,
  createdAt: Date.now(),
};
const RESOLVED: IExceptionEvent = {
  ...SHARED_CODE,
  id: "issue-2",
  detail: "8900000000001",
  status: "resolved",
  resolvedAt: Date.now(),
  resolutionNote: "Relabelled the grey one",
};

async function openIssues() {
  const fake = installFakeShopos({
    "exceptions.list": (input: ExceptionsListInput) => ({
      events: [SHARED_CODE, RESOLVED].filter((event) => event.status === input.status),
    }),
    "exceptions.resolve": () => ({ event: { ...SHARED_CODE, status: "resolved" } }),
  });
  renderWithTheme(<DataIssuesButton />);
  await userEvent.click(screen.getByRole("button", { name: uiText.dataIssues.open }));
  return fake;
}

describe("DataIssuesButton (spec 002 T052)", () => {
  it("lists the open issue in words: shared barcode, the code and both items", async () => {
    await openIssues();

    const row = (
      await screen.findByRole("rowheader", { name: uiText.dataIssues.kinds.duplicate_barcode })
    ).closest("tr")!;
    expect(within(row).getByText("8901234567890")).toBeTruthy();
    expect(within(row).getByText("Elbow 1 inch, Elbow grey")).toBeTruthy();
  });

  it("resolves an issue with a note and reloads", async () => {
    const fake = await openIssues();
    const row = (
      await screen.findByRole("rowheader", { name: uiText.dataIssues.kinds.duplicate_barcode })
    ).closest("tr")!;

    await userEvent.click(within(row).getByRole("button", { name: uiText.dataIssues.resolve }));
    await userEvent.type(
      within(row).getByRole("textbox", { name: uiText.dataIssues.note }),
      "Relabelled",
    );
    await userEvent.click(within(row).getByRole("button", { name: uiText.dataIssues.confirm }));

    const sent = fake.calls.find((call) => call.commandName === "exceptions.resolve")!
      .input as ExceptionsResolveInput;
    expect(sent).toEqual({ id: "issue-1", note: "Relabelled" });
    expect(
      fake.calls.filter((call) => call.commandName === "exceptions.list").length,
    ).toBeGreaterThan(1);
  });

  it("shows resolved issues with their note on the Resolved tab", async () => {
    await openIssues();

    // Radix Themes repeats a tab's label in a hidden span that keeps its width, so match the start
    await userEvent.click(
      await screen.findByRole("tab", { name: new RegExp(`^${uiText.dataIssues.resolvedTab}`) }),
    );

    expect(await screen.findByText("Relabelled the grey one")).toBeTruthy();
  });
});
