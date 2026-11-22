import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { saveOneBill } from "../../helpers/handlersFixture";
import { createItemDirectly, freezeShopClock, installRealShopos } from "../../helpers/realShopos";
import { checkLedgerAfterEachTest } from "../../helpers/stockLedger";
import { addToBill, PIPE, readBills, renderShopApp, saveWithKeyboard } from "./billingHarness";
import { openScreen } from "./inventoryHarness";

const hasDoneToast = (toastText: string) =>
  screen.getAllByRole("status").some((element) => element.textContent === `Done ${toastText}`);

async function replaceField(fieldLabel: RegExp | string, newValue: string) {
  const field = await screen.findByRole("textbox", { name: fieldLabel });
  await userEvent.clear(field);
  await userEvent.type(field, newValue);
}

async function saveSettings() {
  await userEvent.click(screen.getByRole("button", { name: "Save settings" }));
  await waitFor(() => expect(hasDoneToast("Settings saved")).toBe(true));
}

/** Temp backup folders made by a test, removed after it even when an assertion failed. */
const createdFolders: string[] = [];
const makeBackupFolder = () => {
  const backupFolder = fs.mkdtempSync(path.join(os.tmpdir(), "shopos-screen-backup-"));
  createdFolders.push(backupFolder);
  return backupFolder;
};

beforeEach(() => {
  freezeShopClock();
});

afterEach(() => {
  vi.useRealTimers();
  createdFolders.splice(0).forEach((backupFolder) => {
    fs.chmodSync(backupFolder, 0o700);
    fs.rmSync(backupFolder, { recursive: true, force: true });
  });
});

checkLedgerAfterEachTest();

describe("screen to database: shop settings (US-4, FR-015 bill number format, FR-010a)", () => {
  it("IT-SET-01 a new series and number format are stored and used by the next bill", async () => {
    const realShopos = installRealShopos();
    await createItemDirectly(realShopos, PIPE);
    renderShopApp();
    await openScreen("Settings");
    await replaceField("Bill series code", "C2");
    // userEvent reads "{" as a key name, so "{{" types one literal brace.
    await replaceField(/Bill number format/, "{{series}-{{seq}");

    await saveSettings();

    expect(
      realShopos.countRows(
        "shop_profile",
        "series_code = ? and number_template = ?",
        "C2",
        "{series}-{seq}",
      ),
    ).toBe(1);
    await openScreen("New bill");
    await addToBill("pip", "PVC pipe", "1");
    await saveWithKeyboard();
    expect(await screen.findByRole("heading", { name: "Bill saved: C2-000001" })).toBeTruthy();
  });

  it("IT-SET-03 a number format longer than 16 characters cannot be saved", async () => {
    const realShopos = installRealShopos();
    renderShopApp();
    await openScreen("Settings");

    await replaceField(/Bill number format/, "SHOP-INVOICE/{{fy}/{{seq}");

    expect(await screen.findByText(/Number could be \d+ characters/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save settings" })).toHaveProperty("disabled", true);
    expect(realShopos.countRows("shop_profile", "number_template = ?", "{series}/{fy}/{seq}")).toBe(
      1,
    );
  });

  it("IT-SET-05 with rounding turned off, ₹99.60 is saved exactly with no round-off", async () => {
    const realShopos = installRealShopos();
    await createItemDirectly(realShopos, { ...PIPE, name: "Hose clip", pricePaise: 3_320 });
    renderShopApp();
    await openScreen("Settings");
    await userEvent.click(
      screen.getByRole("switch", { name: "Round the bill total to the nearest rupee" }),
    );
    await saveSettings();
    expect(realShopos.countRows("shop_profile", "round_bill_total = 0")).toBe(1);

    await openScreen("New bill");
    await addToBill("hos", "Hose clip", "3");
    await saveWithKeyboard();

    await screen.findByRole("heading", { name: /Bill saved/ });
    expect(readBills(realShopos)).toMatchObject([{ round_off_paise: 0, total_paise: 9_960 }]);
  });
});

describe("screen to database: backup (US-5, FR-020 SQLite online backup)", () => {
  it("IT-SET-02 backs up to the chosen folder: a log row and a copy that holds the bill", async () => {
    const backupFolder = makeBackupFolder();
    const realShopos = installRealShopos({ pickedFolder: backupFolder });
    await saveOneBill(realShopos.fixture);
    renderShopApp();
    await openScreen("Settings");
    expect(screen.getByText("No backup yet")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Choose folder" }));
    await waitFor(() => expect(hasDoneToast("Settings saved")).toBe(true));
    await userEvent.click(screen.getByRole("button", { name: "Back up now" }));

    await waitFor(() => expect(hasDoneToast("Backup complete")).toBe(true));
    await waitFor(() => expect(screen.queryByText("No backup yet")).toBeNull());
    expect(realShopos.countRows("shop_profile", "backup_folder = ?", backupFolder)).toBe(1);
    expect(realShopos.countRows("backup_log", "status = 'ok'")).toBe(1);
    const [backupFile] = fs
      .readdirSync(backupFolder)
      .filter((fileName) => fileName.endsWith(".sqlite"));
    const backupCopy = new Database(path.join(backupFolder, backupFile!), { readonly: true });
    expect(backupCopy.prepare("select count(*) as rowCount from bill").get()).toEqual({
      rowCount: 1,
    });
    expect(backupCopy.pragma("integrity_check", { simple: true })).toBe("ok");
    backupCopy.close();
  });

  it("IT-SET-04 a backup that cannot be written is logged as failed and shown with its words", async () => {
    const backupFolder = makeBackupFolder();
    const realShopos = installRealShopos({ pickedFolder: backupFolder });
    renderShopApp();
    await openScreen("Settings");
    await userEvent.click(screen.getByRole("button", { name: "Choose folder" }));
    await waitFor(() => expect(hasDoneToast("Settings saved")).toBe(true));
    // A missing folder is simply created again, so make the folder read-only instead.
    fs.chmodSync(backupFolder, 0o500);

    await userEvent.click(screen.getByRole("button", { name: "Back up now" }));

    expect(await screen.findByText(/^Last backup failed/)).toBeTruthy();
    expect(realShopos.countRows("backup_log", "status = 'failed'")).toBe(1);
    expect(realShopos.countRows("backup_log", "status = 'ok'")).toBe(0);
  });
});
