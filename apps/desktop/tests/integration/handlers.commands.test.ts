import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ZodError, z } from "zod";
import { CoreError } from "@shopos/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toFailure } from "../../src/main/ipc/handlers";
import {
  buildHandlersFixture,
  saveOneBill,
  type IHandlersFixture,
} from "../helpers/handlersFixture";

const makeTempFolder = () => fs.mkdtempSync(path.join(os.tmpdir(), "shopos-handlers-"));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("item and stock commands", () => {
  async function createItemThroughHandler(fixture: IHandlersFixture) {
    const created = await fixture.handlers["items.create"]({
      name: "PVC Pipe",
      unit: "pcs",
      pricePaise: 12000,
      openingQtyMilli: 10000,
    });
    if (!created.ok) throw new Error(created.message);
    return created.data.item;
  }

  it("updates an item's price", async () => {
    const fixture = buildHandlersFixture();
    const pipe = await createItemThroughHandler(fixture);
    const result = await fixture.handlers["items.update"]({ id: pipe.id, pricePaise: 13500 });
    expect(result).toMatchObject({ ok: true, data: { item: { id: pipe.id, pricePaise: 13500 } } });
  });

  it("answers NOT_FOUND when updating an item that does not exist", async () => {
    const { handlers } = buildHandlersFixture();
    expect(await handlers["items.update"]({ id: "missing", pricePaise: 100 })).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
  });

  it("adjusts stock and returns the item with the new movement", async () => {
    const fixture = buildHandlersFixture();
    const pipe = await createItemThroughHandler(fixture);
    const result = await fixture.handlers["stock.adjust"]({
      itemId: pipe.id,
      mode: "add",
      quantityMilli: 5000,
      note: "delivery",
    });
    expect(result).toMatchObject({
      ok: true,
      data: {
        item: { stockMilli: 15000 },
        movement: { reason: "adjustment", quantityMilli: 5000 },
      },
    });
  });

  it("refuses a stock adjustment without a note", async () => {
    const fixture = buildHandlersFixture();
    const pipe = await createItemThroughHandler(fixture);
    const result = await fixture.handlers["stock.adjust"]({
      itemId: pipe.id,
      mode: "add",
      quantityMilli: 1000,
      note: "",
    });
    expect(result).toMatchObject({ ok: false, code: "NOTE_REQUIRED" });
  });
});

describe("draft commands", () => {
  it("saves a draft and loads it back", async () => {
    const { handlers } = buildHandlersFixture();
    const draftPayload = { lines: [{ name: "Pipe" }] };
    expect(await handlers["bills.draft.save"]({ payload: draftPayload })).toEqual({
      ok: true,
      data: {},
    });
    expect(await handlers["bills.draft.load"]({})).toEqual({
      ok: true,
      data: { payload: draftPayload },
    });
  });

  it("loads null when no draft was saved", async () => {
    const { handlers } = buildHandlersFixture();
    expect(await handlers["bills.draft.load"]({})).toEqual({ ok: true, data: { payload: null } });
  });
});

describe("bill commands", () => {
  it("returns a saved bill with its lines", async () => {
    const fixture = buildHandlersFixture();
    const billId = await saveOneBill(fixture);
    const result = await fixture.handlers["bills.get"]({ id: billId });
    expect(result).toMatchObject({
      ok: true,
      data: { bill: { id: billId }, lines: [{ lineNo: 1 }] },
    });
  });

  it("answers NOT_FOUND for a bill that does not exist", async () => {
    const { handlers } = buildHandlersFixture();
    expect(await handlers["bills.get"]({ id: "missing" })).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
  });

  it("prints a bill and reports that it printed", async () => {
    const fixture = buildHandlersFixture();
    const billId = await saveOneBill(fixture);
    expect(await fixture.handlers["bills.print"]({ id: billId, target: "receipt" })).toEqual({
      ok: true,
      data: { printed: true },
    });
  });

  it("exports a PDF to the chosen path", async () => {
    const fixture = buildHandlersFixture();
    const billId = await saveOneBill(fixture);
    const filePath = path.join(makeTempFolder(), "bill.pdf");
    const result = await fixture.handlers["bills.exportPdf"]({
      id: billId,
      target: "a4",
      filePath,
    });
    expect(result).toEqual({ ok: true, data: { filePath } });
    expect(fs.readFileSync(filePath, "utf8")).toBe("%PDF-fake");
  });
});

describe("settings commands", () => {
  it("gets the default profile and saves a changed one", async () => {
    const { handlers } = buildHandlersFixture();
    const current = await handlers["settings.get"]({});
    if (!current.ok) throw new Error(current.message);
    const updated = await handlers["settings.update"]({
      ...current.data,
      name: "Prabhat Hardware",
    });
    expect(updated).toMatchObject({ ok: true, data: { name: "Prabhat Hardware" } });
  });
});

describe("backup commands", () => {
  async function chooseBackupFolder(fixture: IHandlersFixture): Promise<string> {
    const folder = makeTempFolder();
    const current = await fixture.handlers["settings.get"]({});
    if (!current.ok) throw new Error(current.message);
    await fixture.handlers["settings.update"]({ ...current.data, backupFolder: folder });
    return folder;
  }

  it("reports no successful backup yet on a fresh shop", async () => {
    const { handlers } = buildHandlersFixture();
    expect(await handlers["backup.status"]({})).toMatchObject({
      ok: true,
      data: { lastOkAt: null },
    });
  });

  it("runs a backup into the chosen folder", async () => {
    const fixture = buildHandlersFixture();
    const folder = await chooseBackupFolder(fixture);
    const result = await fixture.handlers["backup.run"]({});
    if (!result.ok) throw new Error(result.message);
    expect(path.dirname(result.data.path)).toBe(folder);
    expect(fs.existsSync(result.data.path)).toBe(true);
  });

  it("schedules a restore from a valid backup file", async () => {
    const fixture = buildHandlersFixture();
    await chooseBackupFolder(fixture);
    const backup = await fixture.handlers["backup.run"]({});
    if (!backup.ok) throw new Error(backup.message);
    const result = await fixture.handlers["backup.restore"]({ filePath: backup.data.path });
    expect(result).toEqual({ ok: true, data: { restored: true } });
    expect(fixture.shellCalls.restoredFiles).toEqual([backup.data.path]);
  });

  it("refuses a file that is not a backup and schedules nothing", async () => {
    const fixture = buildHandlersFixture();
    const notABackup = path.join(makeTempFolder(), "notes.sqlite");
    fs.writeFileSync(notABackup, "not a database");
    const result = await fixture.handlers["backup.restore"]({ filePath: notABackup });
    expect(result).toMatchObject({ ok: false, code: "INVALID_BACKUP" });
    expect(fixture.shellCalls.restoredFiles).toEqual([]);
  });
});

describe("system dialogs", () => {
  it("returns the folder the owner picked, or null when cancelled", async () => {
    const picked = buildHandlersFixture({ pickedFolder: "/Volumes/Backup" });
    expect(await picked.handlers["system.pickFolder"]({})).toEqual({
      ok: true,
      data: { path: "/Volumes/Backup" },
    });
    const cancelled = buildHandlersFixture();
    expect(await cancelled.handlers["system.pickFolder"]({})).toEqual({
      ok: true,
      data: { path: null },
    });
  });

  it("returns the backup file the owner picked", async () => {
    const { handlers } = buildHandlersFixture({ pickedBackupFile: "/Volumes/Backup/a.sqlite" });
    expect(await handlers["system.pickBackupFile"]({})).toEqual({
      ok: true,
      data: { path: "/Volumes/Backup/a.sqlite" },
    });
  });

  it("passes the default file name to the save dialog", async () => {
    const fixture = buildHandlersFixture({ pickedPdfPath: "/tmp/C1-000123.pdf" });
    const result = await fixture.handlers["system.pickPdfPath"]({ defaultName: "C1-000123.pdf" });
    expect(result).toEqual({ ok: true, data: { path: "/tmp/C1-000123.pdf" } });
    expect(fixture.shellCalls.pickedPdfNames).toEqual(["C1-000123.pdf"]);
  });
});

describe("toFailure", () => {
  it("keeps the code, message and details of a CoreError", () => {
    const failure = toFailure(new CoreError("DUPLICATE_NAME", "Name exists", [{ id: "x" }]));
    expect(failure).toEqual({
      ok: false,
      code: "DUPLICATE_NAME",
      message: "Name exists",
      details: [{ id: "x" }],
    });
  });

  it("joins the messages of a validation error as INVALID_FIELD", () => {
    const parseFailure = z
      .object({ name: z.string().min(1, "Name is required") })
      .safeParse({ name: "" });
    const zodError = parseFailure.error as ZodError;
    expect(toFailure(zodError)).toEqual({
      ok: false,
      code: "INVALID_FIELD",
      message: "Name is required",
    });
  });

  it("hides an unexpected error behind a safe INTERNAL message and logs it", () => {
    const logError = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = toFailure(new Error("database exploded: secret detail"));
    expect(failure.code).toBe("INTERNAL");
    expect(failure.message).not.toContain("secret detail");
    expect(logError).toHaveBeenCalledOnce();
  });
});
