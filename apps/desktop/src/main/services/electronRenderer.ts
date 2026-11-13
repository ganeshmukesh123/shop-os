import { BrowserWindow } from "electron";
import type { HtmlRenderer } from "./PrintService";

/** Renders bill HTML in an offscreen, locked-down window and prints it or turns it into a PDF. */
async function withWindow<T>(
  html: string,
  fn: (browserWindow: BrowserWindow) => Promise<T>,
): Promise<T> {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      javascript: false,
    },
  });
  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    return await fn(win);
  } finally {
    win.destroy();
  }
}

export const electronRenderer: HtmlRenderer = {
  print: (html) =>
    withWindow(
      html,
      (browserWindow) =>
        new Promise((resolve) => {
          browserWindow.webContents.print(
            { silent: false, printBackground: true },
            (success, reason) => resolve({ success, reason }),
          );
        }),
    ),
  toPdf: (html, paper, widthMm) =>
    withWindow(html, (browserWindow) =>
      browserWindow.webContents.printToPDF({
        printBackground: true,
        preferCSSPageSize: true,
        ...(paper === "receipt"
          ? { pageSize: { width: (widthMm ?? 80) / 25.4, height: 11.7 } }
          : { pageSize: paper }),
      }),
    ),
};
