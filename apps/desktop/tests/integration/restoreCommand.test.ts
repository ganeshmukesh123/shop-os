import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildHandlersFixture,
  saveOneBill,
  type IHandlersFixture,
} from "../helpers/handlersFixture";

/** The financial year the test shop's first bill was numbered in, so these tests do not depend on today's date. */
async function shopWithOneBillAndBackup(fixture: IHandlersFixture) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "shopos-restore-command-"));
  const profile = await fixture.handlers["settings.get"]({});
  if (!profile.ok) throw new Error(profile.message);
  await fixture.handlers["settings.update"]({ ...profile.data, backupFolder: folder });
  const billId = await saveOneBill(fixture);
  const savedBill = await fixture.handlers["bills.get"]({ id: billId });
  if (!savedBill.ok) throw new Error(savedBill.message);
  const backup = await fixture.handlers["backup.run"]({});
  if (!backup.ok) throw new Error(backup.message);
  const financialYear = savedBill.data.bill.number.split("/")[1]!;
  return { backupFile: backup.data.path, financialYear };
}

describe("backup.planRestore shows what a restore will do, before anything changes (task T083, FR-013b, EC-19, research D21)", () => {
  it("gives the next number and the numbers it will record as lost, and schedules nothing", async () => {
    const fixture = buildHandlersFixture();
    const { backupFile, financialYear } = await shopWithOneBillAndBackup(fixture);

    const preview = await fixture.handlers["backup.planRestore"]({
      filePath: backupFile,
      lastIssuedBillNo: `C1/${financialYear}/000005`,
    });

    expect(preview).toEqual({
      ok: true,
      data: {
        nextBillNo: `C1/${financialYear}/000006`,
        gapRecorded: { seqFrom: 2, seqTo: 5, isEstimated: false },
      },
    });
    expect(fixture.shellCalls.restoredFiles).toEqual([]);
  });

  it("jumps 100 ahead, and says it is a guess, when the owner types nothing", async () => {
    const fixture = buildHandlersFixture();
    const { backupFile, financialYear } = await shopWithOneBillAndBackup(fixture);

    const preview = await fixture.handlers["backup.planRestore"]({ filePath: backupFile });

    expect(preview).toEqual({
      ok: true,
      data: {
        nextBillNo: `C1/${financialYear}/000102`,
        gapRecorded: { seqFrom: 2, seqTo: 101, isEstimated: true },
      },
    });
  });

  it("treats a blank number like no number", async () => {
    const fixture = buildHandlersFixture();
    const { backupFile } = await shopWithOneBillAndBackup(fixture);

    const preview = await fixture.handlers["backup.planRestore"]({
      filePath: backupFile,
      lastIssuedBillNo: "   ",
    });

    expect(preview).toMatchObject({ ok: true, data: { gapRecorded: { isEstimated: true } } });
  });

  it("reports no lost numbers when the backup already has the last bill", async () => {
    const fixture = buildHandlersFixture();
    const { backupFile, financialYear } = await shopWithOneBillAndBackup(fixture);

    const preview = await fixture.handlers["backup.planRestore"]({
      filePath: backupFile,
      lastIssuedBillNo: `C1/${financialYear}/000001`,
    });

    expect(preview).toEqual({ ok: true, data: { nextBillNo: `C1/${financialYear}/000002` } });
  });

  it("refuses a number that is not in the shop's format, in another series, or with sequence 0", async () => {
    const fixture = buildHandlersFixture();
    const { backupFile, financialYear } = await shopWithOneBillAndBackup(fixture);
    const planWith = (lastIssuedBillNo: string) =>
      fixture.handlers["backup.planRestore"]({ filePath: backupFile, lastIssuedBillNo });

    expect(await planWith("126")).toMatchObject({ ok: false, code: "INVALID_FIELD" });
    expect(await planWith(`B2/${financialYear}/000005`)).toMatchObject({
      ok: false,
      code: "INVALID_FIELD",
    });
    expect(await planWith(`C1/${financialYear}/000000`)).toMatchObject({
      ok: false,
      code: "INVALID_FIELD",
    });
  });

  it("refuses a file that is not a backup", async () => {
    const fixture = buildHandlersFixture();

    const preview = await fixture.handlers["backup.planRestore"]({
      filePath: "/definitely/not/here.sqlite",
    });

    expect(preview).toMatchObject({ ok: false, code: "INVALID_BACKUP" });
  });
});

describe("backup.restore applies only the plan the owner confirmed (FR-013b, EC-19)", () => {
  it("schedules the plan when the confirmed next number still matches, and repeats what it will do", async () => {
    const fixture = buildHandlersFixture();
    const { backupFile, financialYear } = await shopWithOneBillAndBackup(fixture);

    const result = await fixture.handlers["backup.restore"]({
      filePath: backupFile,
      lastIssuedBillNo: `C1/${financialYear}/000005`,
      confirmedNextBillNo: `C1/${financialYear}/000006`,
    });

    expect(result).toEqual({
      ok: true,
      data: {
        restored: true,
        nextBillNo: `C1/${financialYear}/000006`,
        gapRecorded: { seqFrom: 2, seqTo: 5, isEstimated: false },
      },
    });
    expect(fixture.shellCalls.restoredFiles).toEqual([backupFile]);
    expect(fixture.shellCalls.restoredPlans[0]?.gap).toEqual({
      seqFrom: 2,
      seqTo: 5,
      newLastSeq: 5,
      isEstimated: false,
    });
  });

  it("refuses, and schedules nothing, when the plan no longer gives the number the owner confirmed", async () => {
    // The owner checked C1/…/000006, then the backup file was replaced with one that ends later.
    const fixture = buildHandlersFixture();
    const { backupFile, financialYear } = await shopWithOneBillAndBackup(fixture);

    const result = await fixture.handlers["backup.restore"]({
      filePath: backupFile,
      lastIssuedBillNo: `C1/${financialYear}/000005`,
      confirmedNextBillNo: `C1/${financialYear}/000003`,
    });

    expect(result).toMatchObject({ ok: false, code: "INVALID_BACKUP" });
    expect(fixture.shellCalls.restoredFiles).toEqual([]);
  });

  it("refuses a restore that was never checked first", async () => {
    const fixture = buildHandlersFixture();
    const { backupFile } = await shopWithOneBillAndBackup(fixture);

    const result = await fixture.handlers["backup.restore"]({ filePath: backupFile });

    expect(result).toMatchObject({ ok: false, code: "INVALID_FIELD" });
    expect(fixture.shellCalls.restoredFiles).toEqual([]);
  });
});
