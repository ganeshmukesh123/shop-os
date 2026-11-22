import {
  MOVEMENT_REASONS,
  PAYMENT_MODES,
  backupPlanRestoreInput,
  backupRestoreInput,
  billLineInput,
  billsCancelInput,
  billsExportPdfInput,
  billsGetInput,
  billsListInput,
  billsPrintInput,
  billsSaveInput,
  draftSaveInput,
  importCommitInput,
  importPreviewInput,
  itemsCreateInput,
  itemsListInput,
  itemsUpdateInput,
  paymentModeSchema,
  settingsUpdateInput,
  stockAdjustInput,
} from "../src/types";

const A_VALID_UUID = "3f2b8c1e-5a47-4d9e-8b1a-2c6f0d9e7a31";

/** Small builders so each test shows only the field it is about. */
const buildBillLine = (overrides: object = {}) => ({
  itemId: "item-1",
  quantityMilli: 2000,
  ratePaise: 12000,
  lineDiscountPaise: 0,
  ...overrides,
});
const buildBillsSave = (overrides: object = {}) => ({
  clientBillId: A_VALID_UUID,
  paymentMode: "cash",
  billDiscountPaise: 0,
  lines: [buildBillLine()],
  ...overrides,
});
const buildSettings = (overrides: object = {}) => ({
  name: "Prabhat Hardware",
  address: "12 Main Road",
  phone: "9876543210",
  seriesCode: "C1",
  numberTemplate: "{series}/{fy}/{seq}",
  footer: "Thank you",
  receiptWidth: "80mm",
  backupFolder: "/Volumes/Backup",
  docTitle: "Estimate",
  roundBillTotal: true,
  timeZone: "Asia/Kolkata",
  ...overrides,
});
const isAccepted = (
  schema: { safeParse: (input: unknown) => { success: boolean } },
  input: unknown,
) => schema.safeParse(input).success;

describe("constants", () => {
  it("lists the four payment modes and the four movement reasons", () => {
    expect([...PAYMENT_MODES]).toEqual(["cash", "upi", "card", "unpaid"]);
    expect([...MOVEMENT_REASONS]).toEqual(["opening", "adjustment", "sale", "sale_cancel"]);
  });

  it("accepts each payment mode and rejects anything else", () => {
    expect(PAYMENT_MODES.every((mode) => isAccepted(paymentModeSchema, mode))).toBe(true);
    expect(isAccepted(paymentModeSchema, "bitcoin")).toBe(false);
  });
});

describe("items.list input", () => {
  it("accepts a minimal page request", () => {
    expect(isAccepted(itemsListInput, { limit: 50, offset: 0 })).toBe(true);
  });

  it("limits the page size to 1..1000 and the offset to 0 or more", () => {
    expect(isAccepted(itemsListInput, { limit: 0, offset: 0 })).toBe(false);
    expect(isAccepted(itemsListInput, { limit: 1001, offset: 0 })).toBe(false);
    expect(isAccepted(itemsListInput, { limit: 1000, offset: 0 })).toBe(true);
    expect(isAccepted(itemsListInput, { limit: 10, offset: -1 })).toBe(false);
  });

  it("rejects a search text over 120 characters", () => {
    expect(isAccepted(itemsListInput, { limit: 10, offset: 0, query: "x".repeat(121) })).toBe(
      false,
    );
  });
});

describe("items.create input", () => {
  const validItem = { name: "PVC Pipe", unit: "pcs", pricePaise: 12000, openingQtyMilli: 0 };

  it("trims the name and the unit", () => {
    const parsed = itemsCreateInput.parse({ ...validItem, name: "  PVC Pipe  ", unit: " pcs " });
    expect(parsed.name).toBe("PVC Pipe");
    expect(parsed.unit).toBe("pcs");
  });

  it("requires a name of 1 to 120 characters after trimming", () => {
    expect(isAccepted(itemsCreateInput, { ...validItem, name: "   " })).toBe(false);
    expect(isAccepted(itemsCreateInput, { ...validItem, name: "n".repeat(120) })).toBe(true);
    expect(isAccepted(itemsCreateInput, { ...validItem, name: "n".repeat(121) })).toBe(false);
  });

  it("requires a unit of 1 to 20 characters", () => {
    expect(isAccepted(itemsCreateInput, { ...validItem, unit: "" })).toBe(false);
    expect(isAccepted(itemsCreateInput, { ...validItem, unit: "u".repeat(21) })).toBe(false);
  });

  it("rejects a negative or fractional price and a negative opening quantity", () => {
    expect(isAccepted(itemsCreateInput, { ...validItem, pricePaise: -1 })).toBe(false);
    expect(isAccepted(itemsCreateInput, { ...validItem, pricePaise: 10.5 })).toBe(false);
    expect(isAccepted(itemsCreateInput, { ...validItem, openingQtyMilli: -1 })).toBe(false);
  });

  it("makes allowsDecimal optional", () => {
    expect(isAccepted(itemsCreateInput, { ...validItem, allowsDecimal: true })).toBe(true);
    expect(isAccepted(itemsCreateInput, validItem)).toBe(true);
  });
});

describe("items.update input", () => {
  it("needs only an id; every other field is optional", () => {
    expect(isAccepted(itemsUpdateInput, { id: "item-1" })).toBe(true);
    expect(isAccepted(itemsUpdateInput, { id: "" })).toBe(false);
  });

  it("applies the same name, unit and price rules as create", () => {
    expect(isAccepted(itemsUpdateInput, { id: "item-1", name: " " })).toBe(false);
    expect(isAccepted(itemsUpdateInput, { id: "item-1", unit: "u".repeat(21) })).toBe(false);
    expect(isAccepted(itemsUpdateInput, { id: "item-1", pricePaise: -5, active: true })).toBe(
      false,
    );
  });
});

describe("stock.adjust input", () => {
  const validAdjust = { itemId: "item-1", mode: "add", quantityMilli: 5000, note: "delivery" };

  it("accepts add and set only", () => {
    expect(isAccepted(stockAdjustInput, validAdjust)).toBe(true);
    expect(isAccepted(stockAdjustInput, { ...validAdjust, mode: "set" })).toBe(true);
    expect(isAccepted(stockAdjustInput, { ...validAdjust, mode: "subtract" })).toBe(false);
  });

  it("limits the note to 200 characters and needs an item id", () => {
    expect(isAccepted(stockAdjustInput, { ...validAdjust, note: "n".repeat(201) })).toBe(false);
    expect(isAccepted(stockAdjustInput, { ...validAdjust, itemId: "" })).toBe(false);
  });
});

describe("import and draft inputs", () => {
  it("requires a file path to preview and a preview id to commit", () => {
    expect(isAccepted(importPreviewInput, { filePath: "/tmp/items.xlsx" })).toBe(true);
    expect(isAccepted(importPreviewInput, { filePath: "" })).toBe(false);
    expect(isAccepted(importCommitInput, { previewId: "p1" })).toBe(true);
    expect(isAccepted(importCommitInput, { previewId: "" })).toBe(false);
  });

  it("accepts any payload, including null, but the payload key must be present", () => {
    expect(isAccepted(draftSaveInput, { payload: { lines: [] } })).toBe(true);
    expect(isAccepted(draftSaveInput, { payload: null })).toBe(true);
    expect(isAccepted(draftSaveInput, {})).toBe(false); // zod 4: missing unknown-typed keys are rejected
  });
});

describe("bills.save input", () => {
  it("accepts a complete bill", () => {
    expect(isAccepted(billsSaveInput, buildBillsSave())).toBe(true);
  });

  it("requires clientBillId to be a UUID", () => {
    expect(isAccepted(billsSaveInput, buildBillsSave({ clientBillId: "not-a-uuid" }))).toBe(false);
    expect(isAccepted(billsSaveInput, buildBillsSave({ clientBillId: "" }))).toBe(false);
    const withoutId: Record<string, unknown> = buildBillsSave();
    delete withoutId.clientBillId;
    expect(isAccepted(billsSaveInput, withoutId)).toBe(false);
  });

  it("rejects an unknown payment mode", () => {
    expect(isAccepted(billsSaveInput, buildBillsSave({ paymentMode: "cheque" }))).toBe(false);
  });

  it("trims the customer name and limits it to 80 characters", () => {
    const parsed = billsSaveInput.parse(buildBillsSave({ customerName: "  Ravi Kumar  " }));
    expect(parsed.customerName).toBe("Ravi Kumar");
    expect(isAccepted(billsSaveInput, buildBillsSave({ customerName: "c".repeat(81) }))).toBe(
      false,
    );
  });

  it("drops unknown keys instead of passing them on (customerPhone no longer exists)", () => {
    const parsed = billsSaveInput.parse(buildBillsSave({ customerPhone: "9876543210" }));
    expect("customerPhone" in parsed).toBe(false);
  });

  it("rejects fractional or negative money", () => {
    expect(isAccepted(billsSaveInput, buildBillsSave({ billDiscountPaise: 10.5 }))).toBe(false);
    expect(isAccepted(billsSaveInput, buildBillsSave({ billDiscountPaise: -1 }))).toBe(false);
  });

  it("leaves an empty bill to the domain rule (EMPTY_BILL), not the schema", () => {
    expect(isAccepted(billsSaveInput, buildBillsSave({ lines: [] }))).toBe(true);
  });
});

describe("bill line input", () => {
  it("accepts integer money and quantity and rejects fractions and negative amounts", () => {
    expect(isAccepted(billLineInput, buildBillLine())).toBe(true);
    expect(isAccepted(billLineInput, buildBillLine({ ratePaise: 99.5 }))).toBe(false);
    expect(isAccepted(billLineInput, buildBillLine({ lineDiscountPaise: -1 }))).toBe(false);
    expect(isAccepted(billLineInput, buildBillLine({ quantityMilli: 1.5 }))).toBe(false);
    expect(isAccepted(billLineInput, buildBillLine({ itemId: "" }))).toBe(false);
  });
});

describe("other bill commands", () => {
  it("limits the bill list page to 1..500 and the status to posted or cancelled", () => {
    expect(isAccepted(billsListInput, { limit: 500, offset: 0, status: "posted" })).toBe(true);
    expect(isAccepted(billsListInput, { limit: 10, offset: 0, status: "cancelled" })).toBe(true);
    expect(isAccepted(billsListInput, { limit: 10, offset: 0, status: "saved" })).toBe(false);
    expect(isAccepted(billsListInput, { limit: 501, offset: 0 })).toBe(false);
    expect(isAccepted(billsListInput, { limit: 10, offset: 0, status: "deleted" })).toBe(false);
  });

  it("needs a bill id to get, cancel, print or export", () => {
    expect(isAccepted(billsGetInput, { id: "b1" })).toBe(true);
    expect(isAccepted(billsGetInput, { id: "" })).toBe(false);
    expect(isAccepted(billsCancelInput, { id: "b1", reason: "wrong item" })).toBe(true);
    expect(isAccepted(billsPrintInput, { id: "b1", target: "a4" })).toBe(true);
    expect(isAccepted(billsPrintInput, { id: "b1", target: "poster" })).toBe(false);
  });

  it("needs a print target and a file path to export a PDF", () => {
    expect(
      isAccepted(billsExportPdfInput, { id: "b1", target: "a5", filePath: "/tmp/b.pdf" }),
    ).toBe(true);
    expect(isAccepted(billsExportPdfInput, { id: "b1", target: "a5", filePath: "" })).toBe(false);
  });

  it("needs a file path to plan a restore", () => {
    expect(isAccepted(backupPlanRestoreInput, { filePath: "/tmp/backup.sqlite" })).toBe(true);
    expect(isAccepted(backupPlanRestoreInput, { filePath: "" })).toBe(false);
  });

  it("restores only with the whole plan the owner confirmed: next number and lost range", () => {
    const confirmed = {
      filePath: "/tmp/backup.sqlite",
      confirmedPreview: {
        nextBillNo: "C1/26-27/000127",
        gapRecorded: { seqFrom: 121, seqTo: 126, isEstimated: false },
      },
    };

    expect(isAccepted(backupRestoreInput, confirmed)).toBe(true);
    expect(isAccepted(backupRestoreInput, { filePath: "/tmp/backup.sqlite" })).toBe(false);
    expect(
      isAccepted(backupRestoreInput, { ...confirmed, confirmedPreview: { nextBillNo: "" } }),
    ).toBe(false);
  });
});

describe("settings.update input", () => {
  it("accepts a complete profile and trims text fields", () => {
    const parsed = settingsUpdateInput.parse(buildSettings({ name: "  Prabhat Hardware  " }));
    expect(parsed.name).toBe("Prabhat Hardware");
  });

  it("requires a shop name of at most 80 characters", () => {
    expect(isAccepted(settingsUpdateInput, buildSettings({ name: "  " }))).toBe(false);
    expect(isAccepted(settingsUpdateInput, buildSettings({ name: "n".repeat(81) }))).toBe(false);
  });

  it("limits series code (8), template (40), address (200), phone (20), footer (200), folder (1000)", () => {
    expect(isAccepted(settingsUpdateInput, buildSettings({ seriesCode: "S".repeat(9) }))).toBe(
      false,
    );
    expect(isAccepted(settingsUpdateInput, buildSettings({ numberTemplate: "t".repeat(41) }))).toBe(
      false,
    );
    expect(isAccepted(settingsUpdateInput, buildSettings({ address: "a".repeat(201) }))).toBe(
      false,
    );
    expect(isAccepted(settingsUpdateInput, buildSettings({ phone: "9".repeat(21) }))).toBe(false);
    expect(isAccepted(settingsUpdateInput, buildSettings({ footer: "f".repeat(201) }))).toBe(false);
    expect(isAccepted(settingsUpdateInput, buildSettings({ backupFolder: "b".repeat(1001) }))).toBe(
      false,
    );
  });

  it("accepts receipt widths 58mm, 80mm, a4 and a5 only", () => {
    expect(isAccepted(settingsUpdateInput, buildSettings({ receiptWidth: "58mm" }))).toBe(true);
    expect(isAccepted(settingsUpdateInput, buildSettings({ receiptWidth: "a4" }))).toBe(true);
    expect(isAccepted(settingsUpdateInput, buildSettings({ receiptWidth: "a5" }))).toBe(true);
    expect(isAccepted(settingsUpdateInput, buildSettings({ receiptWidth: "100mm" }))).toBe(false);
  });

  it("returns the document title, the rounding switch and the time zone (FR-010a, FR-015a, FR-019a)", () => {
    const parsed = settingsUpdateInput.parse(buildSettings({ docTitle: "  Cash Memo  " }));

    expect(parsed.docTitle).toBe("Cash Memo");
    expect(parsed.roundBillTotal).toBe(true);
    expect(parsed.timeZone).toBe("Asia/Kolkata");
  });

  it("requires a document title of 1 to 30 characters", () => {
    expect(isAccepted(settingsUpdateInput, buildSettings({ docTitle: "  " }))).toBe(false);
    expect(isAccepted(settingsUpdateInput, buildSettings({ docTitle: "t".repeat(31) }))).toBe(
      false,
    );
    expect(isAccepted(settingsUpdateInput, buildSettings({ docTitle: "t".repeat(30) }))).toBe(true);
  });

  it("refuses a time zone the platform does not know", () => {
    expect(isAccepted(settingsUpdateInput, buildSettings({ timeZone: "Mars/Olympus" }))).toBe(
      false,
    );
  });

  it("refuses a profile that leaves out the document title, rounding or time zone", () => {
    expect(isAccepted(settingsUpdateInput, buildSettings({ docTitle: undefined }))).toBe(false);
    expect(isAccepted(settingsUpdateInput, buildSettings({ roundBillTotal: undefined }))).toBe(
      false,
    );
    expect(isAccepted(settingsUpdateInput, buildSettings({ timeZone: undefined }))).toBe(false);
  });
});
