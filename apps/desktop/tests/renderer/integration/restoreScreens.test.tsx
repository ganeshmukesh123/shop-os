import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { IFixtureOptions } from "../../helpers/handlersFixture";
import { saveOneBill } from "../../helpers/handlersFixture";
import { freezeShopClock, installRealShopos, type IRealShopos } from "../../helpers/realShopos";
import { checkLedgerAfterEachTest } from "../../helpers/stockLedger";
import { renderShopApp } from "./billingHarness";
import { openScreen } from "./inventoryHarness";

const createdFolders: string[] = [];

/** A shop with bill 000001 in a backup, then bills 000002 and 000003 printed after it. */
async function shopWithBackupThenTwoMoreBills() {
  const backupFolder = fs.mkdtempSync(path.join(os.tmpdir(), "shopos-screen-restore-"));
  createdFolders.push(backupFolder);
  const fixtureOptions: IFixtureOptions = {};
  const realShopos = installRealShopos(fixtureOptions);
  const handlers = realShopos.fixture.handlers;
  const profile = await handlers["settings.get"]({});
  if (!profile.ok) throw new Error(profile.message);
  await handlers["settings.update"]({ ...profile.data, backupFolder });
  await saveOneBill(realShopos.fixture, "PVC pipe");
  const backup = await handlers["backup.run"]({});
  if (!backup.ok) throw new Error(backup.message);
  await saveOneBill(realShopos.fixture, "PVC elbow");
  await saveOneBill(realShopos.fixture, "Wire");
  // The fixture reads this when the dialog asks for a file, so it can be set after the backup exists.
  fixtureOptions.pickedBackupFile = backup.data.path;
  return realShopos;
}

async function openRestoreDialog() {
  renderShopApp();
  await openScreen("Settings");
  await userEvent.click(screen.getByRole("button", { name: "Restore from file" }));
  return screen.findByRole("alertdialog");
}

const hasDoneToastStarting = (toastStart: string) =>
  screen
    .queryAllByRole("status")
    .some((element) => element.textContent?.startsWith(`Done ${toastStart}`) ?? false);

beforeEach(() => {
  freezeShopClock();
});

afterEach(() => {
  vi.useRealTimers();
  createdFolders
    .splice(0)
    .forEach((backupFolder) => fs.rmSync(backupFolder, { recursive: true, force: true }));
});

checkLedgerAfterEachTest();

describe("screen to database: restoring a backup without reusing a bill number (US-5, FR-013b)", () => {
  it("IT-RES-01 the last printed bill 000003 makes the next bill 000004 and records 2 to 3 as lost", async () => {
    const realShopos = await shopWithBackupThenTwoMoreBills();
    await openRestoreDialog();

    await userEvent.type(screen.getByLabelText("Last bill number you printed"), "C1/26-27/000003");
    await userEvent.click(screen.getByRole("button", { name: "Check bill numbers" }));
    expect(
      await screen.findByText(/Bill numbers 2 to 3 will be recorded as lost in the restore\./),
    ).toBeTruthy();
    expect(screen.getByText(/The next bill will be C1\/26-27\/000004\./)).toBeTruthy();
    expect(realShopos.fixture.shellCalls.restoredFiles).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: "Restore and restart" }));

    await waitFor(() => expect(realShopos.fixture.shellCalls.restoredFiles).toHaveLength(1));
    expect(realShopos.fixture.shellCalls.restoredPlans[0]).toMatchObject({
      restoredLastSeq: 1,
      nextBillNo: "C1/26-27/000004",
      gap: { seqFrom: 2, seqTo: 3, newLastSeq: 3, isEstimated: false },
    });
    await waitFor(() =>
      expect(
        hasDoneToastStarting(
          "Restoring… the app will restart. The next bill will be C1/26-27/000004.",
        ),
      ).toBe(true),
    );
    // Nothing changes before the restart: the live database still has all three bills.
    expect(realShopos.countRows("bill")).toBe(3);
  });

  it("IT-RES-02 with no last bill typed, the next 100 numbers are skipped and the plan says it is a guess", async () => {
    const realShopos: IRealShopos = await shopWithBackupThenTwoMoreBills();
    await openRestoreDialog();

    await userEvent.click(screen.getByRole("button", { name: "Check bill numbers" }));

    expect(
      await screen.findByText(/Bill numbers 2 to 101 will be recorded as lost in the restore\./),
    ).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Restore and restart" }));
    await waitFor(() =>
      expect(realShopos.fixture.shellCalls.restoredPlans[0]).toMatchObject({
        nextBillNo: "C1/26-27/000102",
        gap: { seqFrom: 2, seqTo: 101, newLastSeq: 101, isEstimated: true },
      }),
    );
  });
});
