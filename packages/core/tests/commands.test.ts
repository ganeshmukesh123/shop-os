import * as core from "../src/index";
import { COMMAND_NAMES } from "../src/commands";

/** The renderer-to-main commands in specs/001-shop-os-mvp/contracts/ipc-commands.md plus the native dialogs. */
const EXPECTED_COMMAND_NAMES = [
  "items.list",
  "items.create",
  "items.update",
  "stock.adjust",
  "bills.draft.save",
  "bills.draft.load",
  "bills.save",
  "bills.get",
  "bills.print",
  "bills.exportPdf",
  "settings.get",
  "settings.update",
  "settings.clockCheck",
  "backup.run",
  "backup.status",
  "backup.restore",
  "system.pickFolder",
  "system.pickBackupFile",
  "system.pickPdfPath",
];

describe("command list", () => {
  it("names exactly the commands of the contract, in contract order", () => {
    expect([...COMMAND_NAMES]).toEqual(EXPECTED_COMMAND_NAMES);
  });

  it("has no duplicate command name", () => {
    expect(new Set(COMMAND_NAMES).size).toBe(COMMAND_NAMES.length);
  });

  it("uses the area.action form for every command", () => {
    expect(COMMAND_NAMES.every((commandName) => /^[a-z]+\.[A-Za-z.]+$/.test(commandName))).toBe(
      true,
    );
  });
});

describe("package entry point", () => {
  it("re-exports the rules, the schemas and the command list", () => {
    expect(core.CoreError).toBeTypeOf("function");
    expect(core.formatRupees).toBeTypeOf("function");
    expect(core.parseQuantity).toBeTypeOf("function");
    expect(core.computeBill).toBeTypeOf("function");
    expect(core.foldMovements).toBeTypeOf("function");
    expect(core.financialYear).toBeTypeOf("function");
    expect(core.evaluateDraft).toBeTypeOf("function");
    expect(core.billsSaveInput).toBeTypeOf("object");
    expect(core.COMMAND_NAMES).toBe(COMMAND_NAMES);
  });

  it("exposes a CoreError that carries a stable code", () => {
    const error = new core.CoreError("EMPTY_BILL", "a bill needs at least one line");
    expect(error.code).toBe("EMPTY_BILL");
    expect(error.name).toBe("CoreError");
    expect(error).toBeInstanceOf(Error);
  });
});
