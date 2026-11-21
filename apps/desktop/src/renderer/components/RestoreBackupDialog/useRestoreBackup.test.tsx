import { act, renderHook } from "@testing-library/react";
import type { ShopProfile } from "@shopos/core";
import { installFakeShopos } from "../../../../tests/helpers/fakeShopos";
import { useRestoreBackup } from "./useRestoreBackup";

const PROFILE: ShopProfile = {
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
const BACKUP_FILE = "/backups/shopos-20261120-231500.sqlite";

function setup(handlers: Parameters<typeof installFakeShopos>[0] = {}) {
  const fake = installFakeShopos({
    "system.pickBackupFile": () => ({ path: BACKUP_FILE }),
    "backup.restore": () => ({
      restored: true,
      nextBillNo: "C1/26-27/000127",
      gapRecorded: { seqFrom: 121, seqTo: 126, isEstimated: false },
    }),
    ...handlers,
  });
  const toast = vi.fn();
  const hook = renderHook(() => useRestoreBackup(PROFILE, toast));
  return { fake, toast, hook };
}

describe("useRestoreBackup (task T084)", () => {
  it("starts closed", () => {
    const { hook } = setup();

    expect(hook.result.current.dialog.isOpen).toBe(false);
  });

  it("opens the dialog with the file the owner picked and an example in the shop's format", async () => {
    const { hook } = setup();

    await act(() => hook.result.current.start());

    expect(hook.result.current.dialog.isOpen).toBe(true);
    expect(hook.result.current.dialog.backupFileName).toBe("shopos-20261120-231500.sqlite");
    expect(hook.result.current.dialog.example).toMatch(/^C1\/\d{2}-\d{2}\/000126$/);
  });

  it("stays closed when the owner cancels the file dialog", async () => {
    const { hook, fake } = setup({ "system.pickBackupFile": () => ({ path: null }) });

    await act(() => hook.result.current.start());

    expect(hook.result.current.dialog.isOpen).toBe(false);
    expect(fake.calls.map((call) => call.commandName)).toEqual(["system.pickBackupFile"]);
  });

  it("restores with the typed number, tells the owner the next bill, and closes", async () => {
    const { hook, fake, toast } = setup();
    await act(() => hook.result.current.start());

    await act(() => hook.result.current.dialog.onRestore("C1/26-27/000126"));

    expect(fake.calls.at(-1)).toEqual({
      commandName: "backup.restore",
      input: { filePath: BACKUP_FILE, lastIssuedBillNo: "C1/26-27/000126" },
    });
    expect(toast).toHaveBeenCalledWith(
      "success",
      "Restoring… the app will restart. The next bill will be C1/26-27/000127. Bill numbers 121 to 126 are recorded as lost in the restore.",
    );
    expect(hook.result.current.dialog.isOpen).toBe(false);
  });

  it("sends no number at all when the field is blank", async () => {
    const { hook, fake } = setup();
    await act(() => hook.result.current.start());

    await act(() => hook.result.current.dialog.onRestore(""));

    expect(fake.calls.at(-1)).toEqual({
      commandName: "backup.restore",
      input: { filePath: BACKUP_FILE },
    });
  });

  it("keeps the dialog open and shows the reason when the number is refused", async () => {
    // With no handler the fake answers with an error result, as the real command does for a refused number.
    const { hook } = setup({ "backup.restore": undefined });
    await act(() => hook.result.current.start());

    await act(() => hook.result.current.dialog.onRestore("126"));

    expect(hook.result.current.dialog.isOpen).toBe(true);
    expect(hook.result.current.dialog.errorMessage).toBe("no fake for backup.restore");
    expect(hook.result.current.dialog.isBusy).toBe(false);
  });

  it("clears the error and closes on cancel", async () => {
    const { hook } = setup({ "backup.restore": undefined });
    await act(() => hook.result.current.start());
    await act(() => hook.result.current.dialog.onRestore("126"));

    act(() => hook.result.current.dialog.onCancel());

    expect(hook.result.current.dialog.isOpen).toBe(false);
    expect(hook.result.current.dialog.errorMessage).toBeNull();
  });
});
