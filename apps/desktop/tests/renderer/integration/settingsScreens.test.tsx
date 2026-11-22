import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { saveOneBill } from "../../helpers/handlersFixture";
import { createItemDirectly, freezeShopClock, installRealShopos } from "../../helpers/realShopos";
import { addToBill, PIPE, renderShopApp, saveWithKeyboard } from "./billingHarness";
import { openScreen } from "./inventoryHarness";

const hasDoneToast = (toastText: string) =>
  screen.getAllByRole("status").some((element) => element.textContent === `Done ${toastText}`);

async function replaceField(fieldLabel: RegExp | string, newValue: string) {
  const field = await screen.findByRole("textbox", { name: fieldLabel });
  await userEvent.clear(field);
  await userEvent.type(field, newValue);
}

beforeEach(() => {
  freezeShopClock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("screen to database: shop settings (US-4, FR-015 bill number format)", () => {
  it("IT-SET-01 a new series and number format are stored and used by the next bill", async () => {
    const realShopos = installRealShopos();
    await createItemDirectly(realShopos, PIPE);
    renderShopApp();
    await openScreen("Settings");
    await replaceField("Bill series code", "C2");
    // userEvent reads "{" as a key name, so "{{" types one literal brace.
    await replaceField(/Bill number format/, "{{series}-{{seq}");

    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() => expect(hasDoneToast("Settings saved")).toBe(true));
    expect(
      realShopos.countRows(
        "shop_profile",
        "series_code = 'C2' and number_template = '{series}-{seq}'",
      ),
    ).toBe(1);
    await openScreen("New bill");
    await addToBill("pip", "PVC pipe", "1");
    await saveWithKeyboard();
    expect(await screen.findByRole("heading", { name: "Bill saved: C2-000001" })).toBeTruthy();
  });
});

describe("screen to database: backup (US-5, FR-020 SQLite online backup)", () => {
  it("IT-SET-02 backs up to the chosen folder: a log row and a copy that holds the bill", async () => {
    const backupFolder = fs.mkdtempSync(path.join(os.tmpdir(), "shopos-screen-backup-"));
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
    expect(realShopos.countRows("shop_profile", `backup_folder = '${backupFolder}'`)).toBe(1);
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
    fs.rmSync(backupFolder, { recursive: true, force: true });
  });
});
