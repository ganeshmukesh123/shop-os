import { useState } from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ShopProfile } from "@shopos/core";
import { renderWithTheme } from "../../../../../../../tests/helpers/renderWithTheme";
import type { NumberTemplateCheck } from "../../numberTemplateCheck";
import { ShopProfileFields } from "./ShopProfileFields";

const PROFILE: ShopProfile = {
  name: "Prabhat Hardware",
  address: "",
  phone: "",
  seriesCode: "C1",
  numberTemplate: "{series}/{fy}/{seq}",
  footer: "",
  receiptWidth: "80mm",
  backupFolder: "",
  docTitle: "Estimate",
  roundBillTotal: true,
  timeZone: "Asia/Kolkata",
};

const GOOD_TEMPLATE: NumberTemplateCheck = { ok: true, example: "C1/26-27/000001" };

function Harness({ templateCheck = GOOD_TEMPLATE }: { templateCheck?: NumberTemplateCheck }) {
  const [profile, setProfile] = useState(PROFILE);
  return (
    <>
      <ShopProfileFields
        profile={profile}
        templateCheck={templateCheck}
        onChange={(patch) => setProfile({ ...profile, ...patch })}
      />
      <output data-testid="saved">{profile.name}</output>
    </>
  );
}

describe("ShopProfileFields", () => {
  it("shows the shop's details and an example number", () => {
    renderWithTheme(<Harness />);

    expect((screen.getByLabelText("Shop name") as HTMLInputElement).value).toBe("Prabhat Hardware");
    expect(screen.getByText("C1/26-27/000001")).toBeTruthy();
  });

  it("passes only the changed field up when the owner types", async () => {
    renderWithTheme(<Harness />);

    await userEvent.type(screen.getByLabelText("Shop name"), " Store");

    expect(screen.getByTestId("saved").textContent).toBe("Prabhat Hardware Store");
  });

  it("shows why the number format is refused, in words, instead of an example", () => {
    renderWithTheme(
      <Harness templateCheck={{ ok: false, reason: "Template must contain {seq}" }} />,
    );

    expect(screen.getByRole("alert").textContent).toContain("Template must contain {seq}");
    expect(screen.queryByText("C1/26-27/000001")).toBeNull();
  });
});
