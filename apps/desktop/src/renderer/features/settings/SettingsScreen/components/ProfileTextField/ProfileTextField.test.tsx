import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithTheme } from "../../../../../../../tests/helpers/renderWithTheme";
import { ProfileTextField } from "./ProfileTextField";

describe("ProfileTextField", () => {
  it("shows the value under its label and reports the typed text", async () => {
    const onTextChange = vi.fn();
    renderWithTheme(
      <ProfileTextField label="Phone" value="98" maxLength={20} onTextChange={onTextChange} />,
    );

    await userEvent.type(screen.getByLabelText("Phone"), "7");

    expect(onTextChange).toHaveBeenCalledWith("987");
  });

  it("stops the owner typing past the limit", () => {
    renderWithTheme(
      <ProfileTextField label="Series" value="" maxLength={8} onTextChange={() => {}} />,
    );

    expect((screen.getByLabelText("Series") as HTMLInputElement).maxLength).toBe(8);
  });
});
