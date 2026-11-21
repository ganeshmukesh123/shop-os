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

describe("backup.restore keeps bill numbers unique (task T083, FR-013b, EC-19, research D21)", () => {
  it("tells the owner the next number and the numbers recorded as lost, and gives the shell the plan", async () => {
    const fixture = buildHandlersFixture();
    const { backupFile, financialYear } = await shopWithOneBillAndBackup(fixture);

    const result = await fixture.handlers["backup.restore"]({
      filePath: backupFile,
      lastIssuedBillNo: `C1/${financialYear}/000005`,
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

  it("jumps 100 ahead, and says it was a guess, when the owner types nothing", async () => {
    const fixture = buildHandlersFixture();
    const { backupFile, financialYear } = await shopWithOneBillAndBackup(fixture);

    const result = await fixture.handlers["backup.restore"]({ filePath: backupFile });

    expect(result).toEqual({
      ok: true,
      data: {
        restored: true,
        nextBillNo: `C1/${financialYear}/000102`,
        gapRecorded: { seqFrom: 2, seqTo: 101, isEstimated: true },
      },
    });
  });

  it("treats a blank number like no number", async () => {
    const fixture = buildHandlersFixture();
    const { backupFile } = await shopWithOneBillAndBackup(fixture);

    const result = await fixture.handlers["backup.restore"]({
      filePath: backupFile,
      lastIssuedBillNo: "   ",
    });

    expect(result).toMatchObject({ ok: true, data: { gapRecorded: { isEstimated: true } } });
  });

  it("reports no lost numbers when the backup already has the last bill", async () => {
    const fixture = buildHandlersFixture();
    const { backupFile, financialYear } = await shopWithOneBillAndBackup(fixture);

    const result = await fixture.handlers["backup.restore"]({
      filePath: backupFile,
      lastIssuedBillNo: `C1/${financialYear}/000001`,
    });

    expect(result).toEqual({
      ok: true,
      data: { restored: true, nextBillNo: `C1/${financialYear}/000002` },
    });
  });

  it("refuses a number that is not in the shop's format, and schedules nothing", async () => {
    const fixture = buildHandlersFixture();
    const { backupFile } = await shopWithOneBillAndBackup(fixture);

    const result = await fixture.handlers["backup.restore"]({
      filePath: backupFile,
      lastIssuedBillNo: "126",
    });

    expect(result).toMatchObject({ ok: false, code: "INVALID_FIELD" });
    expect(fixture.shellCalls.restoredFiles).toEqual([]);
  });

  it("refuses a number in another series and a number with sequence 0", async () => {
    const fixture = buildHandlersFixture();
    const { backupFile, financialYear } = await shopWithOneBillAndBackup(fixture);

    const otherSeries = await fixture.handlers["backup.restore"]({
      filePath: backupFile,
      lastIssuedBillNo: `B2/${financialYear}/000005`,
    });
    const sequenceZero = await fixture.handlers["backup.restore"]({
      filePath: backupFile,
      lastIssuedBillNo: `C1/${financialYear}/000000`,
    });

    expect(otherSeries).toMatchObject({ ok: false, code: "INVALID_FIELD" });
    expect(sequenceZero).toMatchObject({ ok: false, code: "INVALID_FIELD" });
    expect(fixture.shellCalls.restoredFiles).toEqual([]);
  });
});
