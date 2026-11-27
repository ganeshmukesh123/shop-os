import { BrowserWindow, type BrowserWindowConstructorOptions } from "electron";
import type { HtmlRenderer } from "../PrintService";

const MILLIMETRES_PER_INCH = 25.4;
const DEFAULT_RECEIPT_WIDTH_MILLIMETRES = 80;
const RECEIPT_HEIGHT_INCHES = 11.7;

/** An offscreen page that can run scripts for nobody: sandboxed, isolated, no Node, no JavaScript. */
export const OFFSCREEN_WINDOW_OPTIONS: BrowserWindowConstructorOptions = {
  show: false,
  webPreferences: {
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false,
    javascript: false,
  },
};

export type IOffscreenWindow = Pick<BrowserWindow, "loadURL" | "destroy"> & {
  webContents: Pick<BrowserWindow["webContents"], "print" | "printToPDF">;
};
export type CreateOffscreenWindow = () => IOffscreenWindow;

/** Renders bill HTML in an offscreen window, runs one action on it, and always destroys the window. */
async function withWindow<Result>(
  createWindow: CreateOffscreenWindow,
  html: string,
  action: (offscreenWindow: IOffscreenWindow) => Promise<Result>,
): Promise<Result> {
  const offscreenWindow = createWindow();
  try {
    await offscreenWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    return await action(offscreenWindow);
  } finally {
    offscreenWindow.destroy();
  }
}

/** Prints bill HTML through the operating system dialog, or turns it into a PDF. */
export function createElectronRenderer(createWindow: CreateOffscreenWindow): HtmlRenderer {
  return {
    print: (html) =>
      withWindow(
        createWindow,
        html,
        (offscreenWindow) =>
          new Promise((resolve) => {
            offscreenWindow.webContents.print(
              { silent: false, printBackground: true },
              (success, reason) => resolve({ success, reason }),
            );
          }),
      ),
    toPdf: (html, paper, widthMillimetres) =>
      withWindow(createWindow, html, (offscreenWindow) =>
        offscreenWindow.webContents.printToPDF({
          printBackground: true,
          preferCSSPageSize: true,
          ...(paper === "receipt"
            ? {
                pageSize: {
                  width:
                    (widthMillimetres ?? DEFAULT_RECEIPT_WIDTH_MILLIMETRES) / MILLIMETRES_PER_INCH,
                  height: RECEIPT_HEIGHT_INCHES,
                },
              }
            : { pageSize: paper }),
        }),
      ),
  };
}

export const electronRenderer = createElectronRenderer(
  () => new BrowserWindow(OFFSCREEN_WINDOW_OPTIONS),
);
