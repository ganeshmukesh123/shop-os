import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "./Toast";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";

function ToastButtons() {
  const toast = useToast();
  return (
    <>
      <button onClick={() => toast("error", "Disk is full")}>fail</button>
      <button onClick={() => toast("success", "Settings saved")}>succeed</button>
    </>
  );
}

describe("Toast (design guidelines 5.1, PRD NFR-011)", () => {
  it("a failure toast opens with the word Error and is announced as an alert", async () => {
    renderWithTheme(
      <ToastProvider>
        <ToastButtons />
      </ToastProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "fail" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Error Disk is full");
  });

  it("toasts sit in the styled viewport, not in an inline-styled box", async () => {
    renderWithTheme(
      <ToastProvider>
        <ToastButtons />
      </ToastProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "fail" }));
    await screen.findByRole("alert");

    expect(document.querySelector(".shopos-toast-viewport")).not.toBeNull();
    const toast = document.querySelector(".shopos-toast");
    expect(toast).not.toBeNull();
    expect(toast!.getAttribute("style") ?? "").not.toContain("list-style");
  });

  it("a success toast opens with the word Done and is announced politely", async () => {
    renderWithTheme(
      <ToastProvider>
        <ToastButtons />
      </ToastProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "succeed" }));

    const toastStatus = await screen.findAllByRole("status");
    expect(toastStatus.some((element) => element.textContent === "Done Settings saved")).toBe(true);
    const announcement = await waitFor(() => {
      const matchingAnnouncement = Array.from(document.querySelectorAll("[aria-live]")).find(
        (element) => element.textContent?.includes("Done Settings saved"),
      );
      expect(matchingAnnouncement).toBeDefined();
      return matchingAnnouncement;
    });
    expect(announcement?.getAttribute("aria-live")).toBe("polite");
  });

  it("a toast goes away when it is dismissed with the keyboard", async () => {
    renderWithTheme(
      <ToastProvider>
        <ToastButtons />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "fail" }));
    await screen.findByRole("alert");

    await userEvent.keyboard("{F8}{Escape}");

    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("a success toast is announced politely and a failure toast assertively", async () => {
    renderWithTheme(
      <ToastProvider>
        <ToastButtons />
      </ToastProvider>,
    );
    const announcementOf = (toastText: string) =>
      Array.from(document.querySelectorAll("[aria-live]")).find((element) =>
        element.textContent?.includes(toastText),
      );

    await userEvent.click(screen.getByRole("button", { name: "succeed" }));
    await screen.findAllByRole("status");
    await userEvent.click(screen.getByRole("button", { name: "fail" }));
    await screen.findByRole("alert");

    await waitFor(() =>
      expect(announcementOf("Settings saved")?.getAttribute("aria-live")).toBe("polite"),
    );
    await waitFor(() =>
      expect(announcementOf("Disk is full")?.getAttribute("aria-live")).toBe("assertive"),
    );
  });
});
