import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Table } from "@radix-ui/themes";
import type { DraftLine, Item, ShopProfile } from "@shopos/core";
import { AdjustStockDialog } from "../../../src/renderer/components/AdjustStockDialog";
import { BillLineRow } from "../../../src/renderer/components/BillLineRow";
import { ToastProvider, useToast } from "../../../src/renderer/components/Toast";
import { ItemsScreen } from "../../../src/renderer/screens/ItemsScreen";
import { SettingsScreen } from "../../../src/renderer/screens/SettingsScreen";
import { installFakeShopos } from "../../helpers/fakeShopos";
import { renderWithTheme } from "../../helpers/renderWithTheme";

const SHOP_PROFILE: ShopProfile = {
  name: "Prabhat Hardware",
  address: "",
  phone: "",
  seriesCode: "C1",
  numberTemplate: "{series}/{fy}/{seq}",
  footer: "",
  receiptWidth: "80mm",
  backupFolder: "/backups",
  docTitle: "Estimate",
  roundBillTotal: true,
  timeZone: "Asia/Kolkata",
};

const NEGATIVE_INACTIVE_ITEM: Item = {
  id: "item-1",
  name: "Elbow 1 inch",
  unit: "pcs",
  allowsDecimal: false,
  pricePaise: 4500,
  stockMilli: -3000,
  active: false,
  needsCorrection: true,
};

const BILL_LINE: DraftLine = {
  key: "line-1",
  itemId: "item-2",
  name: "Pipe",
  unit: "pcs",
  allowsDecimal: false,
  qty: "0",
  rate: "120",
  disc: "",
  discMode: "rupees",
};

function ToastButtons() {
  const toast = useToast();
  return (
    <>
      <button onClick={() => toast("error", "Disk is full")}>fail</button>
      <button onClick={() => toast("success", "Settings saved")}>succeed</button>
    </>
  );
}

describe("status words in the screens (design guidelines 5.1, PRD NFR-011)", () => {
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

  it("a failed backup shows the words 'Last backup failed' before the reason", async () => {
    installFakeShopos({
      "settings.get": () => SHOP_PROFILE,
      "backup.status": () => ({ lastOkAt: null, lastError: "Folder is missing", folder: "" }),
    });

    renderWithTheme(
      <ToastProvider>
        <SettingsScreen />
      </ToastProvider>,
    );

    const backupAlert = await screen.findByRole("alert");
    expect(backupAlert.textContent).toBe("Last backup failed Folder is missing");
  });

  it("a bill number format that is too long is a labelled error, not only red text", async () => {
    installFakeShopos({
      "settings.get": () => ({ ...SHOP_PROFILE, numberTemplate: "SHOP-INVOICE/{seq}" }),
      "backup.status": () => ({ lastOkAt: null, lastError: null, folder: "" }),
    });

    renderWithTheme(
      <ToastProvider>
        <SettingsScreen />
      </ToastProvider>,
    );

    const templateAlert = await screen.findByRole("alert");
    expect(templateAlert.textContent).toMatch(/^Error Number could be \d+ characters/);
  });

  it("a bill line with a problem says Error, the item and the reason", () => {
    renderWithTheme(
      <Table.Root>
        <Table.Body>
          <BillLineRow
            line={BILL_LINE}
            result={{ amountPaise: null, error: "Quantity must be more than 0" }}
            onChange={() => {}}
            onRemove={() => {}}
            onEnterQty={() => {}}
          />
        </Table.Body>
      </Table.Root>,
    );

    expect(screen.getByRole("alert").textContent).toBe("Error Pipe: Quantity must be more than 0");
  });

  it("an adjustment without a note says Error and what is missing", async () => {
    installFakeShopos();
    renderWithTheme(
      <ToastProvider>
        <AdjustStockDialog item={NEGATIVE_INACTIVE_ITEM} onClose={() => {}} onDone={() => {}} />
      </ToastProvider>,
    );

    await userEvent.type(screen.getByRole("textbox", { name: "Quantity (pcs)" }), "5");
    await userEvent.click(screen.getByRole("button", { name: "Save adjustment" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Error A note is required");
  });

  it("an item with negative stock and an inactive item each carry a word", async () => {
    installFakeShopos({
      "items.list": () => ({ items: [NEGATIVE_INACTIVE_ITEM], total: 1 }),
    });

    renderWithTheme(
      <ToastProvider>
        <ItemsScreen />
      </ToastProvider>,
    );

    expect(await screen.findByText("Negative stock: needs correction")).toBeTruthy();
    expect(screen.getByText("Inactive")).toBeTruthy();
  });
});
