import fs from "node:fs/promises";
import { CoreError, type PrintTarget } from "@shopos/core";
import type { BillRepository } from "../../repositories/BillRepository";
import type { SettingsRepository } from "../../repositories/SettingsRepository";
import { pageSpec, renderBillHtml } from "../billHtml";

/** The only Electron-specific part, so PrintService can be tested with a fake. */
export interface HtmlRenderer {
  print(html: string): Promise<{ success: boolean; reason?: string }>;
  toPdf(html: string, paper: "receipt" | "A4" | "A5", widthMm?: number): Promise<Buffer>;
}

/**
 * Printing and PDF export. A bill is committed before this runs, and nothing here ever writes to
 * the database, so a print or export failure cannot touch the saved bill.
 */
export class PrintService {
  constructor(
    private readonly bills: Pick<BillRepository, "get">,
    private readonly settings: Pick<SettingsRepository, "get">,
    private readonly renderer: HtmlRenderer,
  ) {}

  private html(id: string, target: PrintTarget) {
    const found = this.bills.get(id);
    if (!found) throw new CoreError("NOT_FOUND", "Bill not found");
    const profile = this.settings.get();
    return {
      html: renderBillHtml(found.bill, found.lines, profile, target),
      spec: pageSpec(target, profile),
    };
  }

  async print(id: string, target: PrintTarget): Promise<{ printed: boolean }> {
    const { html } = this.html(id, target);
    try {
      const renderResult = await this.renderer.print(html);
      if (!renderResult.success && renderResult.reason && renderResult.reason !== "cancelled")
        throw new Error(renderResult.reason);
      return { printed: renderResult.success };
    } catch (caughtError) {
      throw new CoreError(
        "PRINT_FAILED",
        `Printing failed: ${caughtError instanceof Error ? caughtError.message : String(caughtError)}. The bill is saved; try again or save a PDF.`,
      );
    }
  }

  async exportPdf(
    id: string,
    target: PrintTarget,
    filePath: string,
  ): Promise<{ filePath: string }> {
    const { html, spec } = this.html(id, target);
    try {
      const pdf = await this.renderer.toPdf(html, spec.paper, spec.widthMm);
      await fs.writeFile(filePath, pdf);
      return { filePath };
    } catch (caughtError) {
      throw new CoreError(
        "WRITE_FAILED",
        `Could not create the PDF: ${caughtError instanceof Error ? caughtError.message : String(caughtError)}`,
      );
    }
  }
}
