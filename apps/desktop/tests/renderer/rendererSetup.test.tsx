import { describe, expect, it } from "vitest";
import { Button } from "@radix-ui/themes";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { call } from "../../src/renderer/state/api";
import { installFakeMatchMedia } from "../helpers/fakeMatchMedia";
import { installFakeShopos } from "../helpers/fakeShopos";
import { renderWithTheme } from "../helpers/renderWithTheme";

describe("renderer test setup (spec 017 T027)", () => {
  it("renders a Radix component in jsdom inside the app theme", async () => {
    let clickCount = 0;
    renderWithTheme(<Button onClick={() => (clickCount += 1)}>Save bill</Button>);

    await userEvent.click(screen.getByRole("button", { name: "Save bill" }));

    expect(clickCount).toBe(1);
  });

  it("answers a command from the fake window.shopos and records the call", async () => {
    const fakeShopos = installFakeShopos({
      "system.pickFolder": () => ({ path: "/backups" }),
    });

    const pickResult = await call("system.pickFolder", {});

    expect(pickResult).toEqual({ path: "/backups" });
    expect(fakeShopos.calls).toEqual([{ commandName: "system.pickFolder", input: {} }]);
  });

  it("answers a command nobody faked with an error the screen can show", async () => {
    installFakeShopos();

    await expect(call("backup.status", {})).rejects.toThrow("no fake for backup.status");
  });

  it("lets a test switch the operating-system theme and tells listeners", () => {
    const fakeMatchMedia = installFakeMatchMedia(false);
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const receivedChanges: boolean[] = [];
    query.addEventListener("change", (changeEvent) => receivedChanges.push(changeEvent.matches));

    fakeMatchMedia.setSystemDark(true);

    expect(query.matches).toBe(true);
    expect(receivedChanges).toEqual([true]);
  });
});
