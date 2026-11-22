import { screen } from "@testing-library/react";
import { installFakeShopos } from "../../../tests/helpers/fakeShopos";

describe("renderer entry (main.tsx)", () => {
  it("mounts the app into #root with the theme and toasts around it", async () => {
    document.body.innerHTML = '<div id="root"></div>';
    installFakeShopos({
      "items.list": () => ({ items: [], total: 0 }),
      "bills.draft.load": () => ({ payload: null }),
      "settings.clockCheck": () => ({ warnings: [] }),
    });

    await import("./main");

    expect(await screen.findByRole("navigation", { name: "Main" })).toBeTruthy();
    expect(document.querySelector(".radix-themes")).not.toBeNull();
  });
});
