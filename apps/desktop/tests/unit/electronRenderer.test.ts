import {
  OFFSCREEN_WINDOW_OPTIONS,
  createElectronRenderer,
  type IOffscreenWindow,
} from "../../src/main/services/electronRenderer";

const BILL_HTML = "<p>Bill ₹240.00 & more</p>";

/** A fake offscreen window; the options let a test make loading or printing misbehave. */
function buildFakeWindow(
  behaviour: {
    failLoading?: boolean;
    printResult?: { success: boolean; reason: string };
  } = {},
) {
  const calls = {
    loadedUrl: "",
    destroyCount: 0,
    printOptions: undefined as object | undefined,
    pdfOptions: undefined as Record<string, unknown> | undefined,
  };
  const fakeWindow = {
    loadURL: async (url: string) => {
      calls.loadedUrl = url;
      if (behaviour.failLoading) throw new Error("load failed");
    },
    destroy: () => void (calls.destroyCount += 1),
    webContents: {
      print: (options: object, callback: (success: boolean, reason: string) => void) => {
        calls.printOptions = options;
        const result = behaviour.printResult ?? { success: true, reason: "" };
        callback(result.success, result.reason);
      },
      printToPDF: async (options: Record<string, unknown>) => {
        calls.pdfOptions = options;
        return Buffer.from("%PDF");
      },
    },
  } as unknown as IOffscreenWindow;
  return { fakeWindow, calls };
}

describe("offscreen window options", () => {
  it("is sandboxed, isolated, hidden, and runs no JavaScript", () => {
    expect(OFFSCREEN_WINDOW_OPTIONS).toEqual({
      show: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        javascript: false,
      },
    });
  });
});

describe("createElectronRenderer.print", () => {
  it("loads the bill as an encoded data page and prints it with the system dialog", async () => {
    const { fakeWindow, calls } = buildFakeWindow();
    const result = await createElectronRenderer(() => fakeWindow).print(BILL_HTML);
    expect(result).toEqual({ success: true, reason: "" });
    expect(calls.loadedUrl).toBe(`data:text/html;charset=utf-8,${encodeURIComponent(BILL_HTML)}`);
    expect(calls.printOptions).toEqual({ silent: false, printBackground: true });
  });

  it("reports the reason when the dialog was cancelled or printing failed", async () => {
    const { fakeWindow } = buildFakeWindow({
      printResult: { success: false, reason: "cancelled" },
    });
    const result = await createElectronRenderer(() => fakeWindow).print(BILL_HTML);
    expect(result).toEqual({ success: false, reason: "cancelled" });
  });

  it("destroys the window after printing", async () => {
    const { fakeWindow, calls } = buildFakeWindow();
    await createElectronRenderer(() => fakeWindow).print(BILL_HTML);
    expect(calls.destroyCount).toBe(1);
  });

  it("destroys the window even when loading the page fails", async () => {
    const { fakeWindow, calls } = buildFakeWindow({ failLoading: true });
    await expect(createElectronRenderer(() => fakeWindow).print(BILL_HTML)).rejects.toThrowError(
      "load failed",
    );
    expect(calls.destroyCount).toBe(1);
  });
});

describe("createElectronRenderer.toPdf", () => {
  it("makes a receipt PDF as wide as the paper roll", async () => {
    const { fakeWindow, calls } = buildFakeWindow();
    await createElectronRenderer(() => fakeWindow).toPdf(BILL_HTML, "receipt", 58);
    expect(calls.pdfOptions).toMatchObject({ printBackground: true, preferCSSPageSize: true });
    expect(calls.pdfOptions?.["pageSize"]).toEqual({ width: 58 / 25.4, height: 11.7 });
  });

  it("assumes an 80 mm roll when no width is given", async () => {
    const { fakeWindow, calls } = buildFakeWindow();
    await createElectronRenderer(() => fakeWindow).toPdf(BILL_HTML, "receipt");
    expect(calls.pdfOptions?.["pageSize"]).toEqual({ width: 80 / 25.4, height: 11.7 });
  });

  it("uses the named page size for A4 and A5", async () => {
    const { fakeWindow, calls } = buildFakeWindow();
    await createElectronRenderer(() => fakeWindow).toPdf(BILL_HTML, "A4", undefined);
    expect(calls.pdfOptions?.["pageSize"]).toBe("A4");
  });

  it("returns the PDF bytes and destroys the window", async () => {
    const { fakeWindow, calls } = buildFakeWindow();
    const pdf = await createElectronRenderer(() => fakeWindow).toPdf(BILL_HTML, "A5", undefined);
    expect(pdf.toString()).toBe("%PDF");
    expect(calls.destroyCount).toBe(1);
  });
});

describe("the real renderer", () => {
  it("creates its offscreen windows with the locked-down options", async () => {
    vi.resetModules();
    const constructedWith: unknown[] = [];
    vi.doMock("electron", () => ({
      BrowserWindow: class {
        constructor(options: unknown) {
          constructedWith.push(options);
        }
        loadURL = async () => {};
        destroy = () => {};
        webContents = { printToPDF: async () => Buffer.from("%PDF") };
      },
    }));
    const { electronRenderer } = await import("../../src/main/services/electronRenderer");
    await electronRenderer.toPdf(BILL_HTML, "A4", undefined);
    expect(constructedWith).toEqual([OFFSCREEN_WINDOW_OPTIONS]);
    vi.doUnmock("electron");
  });
});
