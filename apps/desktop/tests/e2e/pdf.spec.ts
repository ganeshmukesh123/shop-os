import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { launch } from "./launch";

// Real printToPDF through the packaged-style app (no printer needed). Covers FR-015's PDF export.
test("export a saved bill as PDF for receipt, A5 and A4", async () => {
  const { app, page } = await launch();
  try {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "shopos-pdf-"));
    const result = await page.evaluate(async (dir) => {
      const created = await window.shopos["items.create"]({
        name: "PVC Pipe",
        unit: "metre",
        pricePaise: 12050,
        openingQtyMilli: 20000,
      });
      if (!created.ok) throw new Error(created.message);
      const saved = await window.shopos["bills.save"]({
        clientBillId: crypto.randomUUID(),
        paymentMode: "upi",
        billDiscountPaise: 500,
        customerName: "Ravi",
        lines: [
          {
            itemId: created.data.item.id,
            quantityMilli: 2500,
            ratePaise: 12050,
            lineDiscountPaise: 0,
          },
        ],
      });
      if (!saved.ok) throw new Error(saved.message);
      const files: Record<string, unknown> = {};
      for (const target of ["receipt", "a5", "a4"] as const) {
        files[target] = await window.shopos["bills.exportPdf"]({
          id: saved.data.bill.id,
          target,
          filePath: `${dir}/${target}.pdf`,
        });
      }
      return files;
    }, out);
    for (const printTarget of ["receipt", "a5", "a4"]) {
      expect(result[printTarget]).toMatchObject({ ok: true });
      const buf = fs.readFileSync(path.join(out, `${printTarget}.pdf`));
      expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
      expect(buf.length).toBeGreaterThan(1000);
    }
  } finally {
    await app.close();
  }
});
