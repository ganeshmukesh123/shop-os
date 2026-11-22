import { listTrustedPageUrls, type IAppConfig } from "../../src/main/app/appConfig";
import {
  buildMainWindowOptions,
  createMainWindow,
  type IMainWindow,
} from "../../src/main/app/mainWindow";

const DEV_SERVER_URL = "http://localhost:5173";

const IS_WINDOWS = process.platform === "win32";
const RENDERER_HTML_PATH = IS_WINDOWS
  ? "C:\\app\\renderer\\index.html"
  : "/app/renderer/index.html";
const RENDERER_FILE_URL = IS_WINDOWS
  ? "file:///C:/app/renderer/index.html"
  : "file:///app/renderer/index.html";

const buildConfig = (overrides: Partial<IAppConfig> = {}): IAppConfig => ({
  isDev: false,
  rendererUrl: undefined,
  databasePath: "/tmp/shopos.sqlite",
  migrationsFolder: "/tmp/drizzle",
  preloadPath: "/app/preload/index.js",
  rendererHtmlPath: RENDERER_HTML_PATH,
  ...overrides,
});

/** A fake window that records what the app asked of it. */
function buildFakeWindow() {
  type NavigationListener = (navigationEvent: { url: string; preventDefault(): void }) => void;
  const navigationListeners = new Map<string, NavigationListener>();
  const calls = {
    openHandler: undefined as (() => { action: string }) | undefined,
    loadedUrls: [] as string[],
    loadedFiles: [] as string[],
  };
  const fakeWindow = {
    webContents: {
      setWindowOpenHandler: (handler: () => { action: string }) => {
        calls.openHandler = handler;
      },
      on: (eventName: string, listener: NavigationListener) => {
        navigationListeners.set(eventName, listener);
      },
    },
    loadURL: async (url: string) => void calls.loadedUrls.push(url),
    loadFile: async (filePath: string) => void calls.loadedFiles.push(filePath),
  } as unknown as IMainWindow;
  return {
    fakeWindow,
    calls,
    navigateTo: (url: string, eventName = "will-navigate") => {
      const preventDefault = vi.fn();
      navigationListeners.get(eventName)?.({ url, preventDefault });
      return { wasBlocked: preventDefault.mock.calls.length > 0 };
    },
  };
}

describe("main window options", () => {
  it("keeps the Electron security defaults: isolated, sandboxed, no Node", () => {
    const { webPreferences } = buildMainWindowOptions("/app/preload/index.js");
    expect(webPreferences).toEqual({
      preload: "/app/preload/index.js",
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    });
  });

  it("opens at 1280 by 800 with a 960 by 600 minimum", () => {
    expect(buildMainWindowOptions("/p")).toMatchObject({
      width: 1280,
      height: 800,
      minWidth: 960,
      minHeight: 600,
      title: "Shop OS",
    });
  });
});

describe("createMainWindow", () => {
  it("builds the window with the preload script and the security options", () => {
    const { fakeWindow } = buildFakeWindow();
    const createBrowserWindow = vi.fn(() => fakeWindow);
    createMainWindow(createBrowserWindow, buildConfig());
    expect(createBrowserWindow).toHaveBeenCalledWith(
      buildMainWindowOptions("/app/preload/index.js"),
    );
  });

  it("denies every new window the page tries to open", () => {
    const { fakeWindow, calls } = buildFakeWindow();
    createMainWindow(() => fakeWindow, buildConfig());
    expect(calls.openHandler?.()).toEqual({ action: "deny" });
  });

  it("blocks navigation away from the app and allows local files", () => {
    const { fakeWindow, navigateTo } = buildFakeWindow();
    createMainWindow(() => fakeWindow, buildConfig());
    expect(navigateTo("https://example.com").wasBlocked).toBe(true);
    expect(navigateTo("file:///app/renderer/index.html").wasBlocked).toBe(false);
  });

  it("blocks a redirect to a foreign address, with the same check as navigation", () => {
    const { fakeWindow, navigateTo } = buildFakeWindow();
    createMainWindow(() => fakeWindow, buildConfig());
    expect(navigateTo("https://evil.example/", "will-redirect").wasBlocked).toBe(true);
    expect(navigateTo("file:///etc/hosts", "will-redirect").wasBlocked).toBe(true);
    expect(navigateTo("file:///app/renderer/index.html", "will-redirect").wasBlocked).toBe(false);
  });

  it("loads the page from the dev server while developing", () => {
    const { fakeWindow, calls } = buildFakeWindow();
    createMainWindow(() => fakeWindow, buildConfig({ isDev: true, rendererUrl: DEV_SERVER_URL }));
    expect(calls.loadedUrls).toEqual([DEV_SERVER_URL]);
    expect(calls.loadedFiles).toEqual([]);
  });

  it("loads the built page from disk in a packaged app", () => {
    const { fakeWindow, calls } = buildFakeWindow();
    createMainWindow(() => fakeWindow, buildConfig());
    expect(calls.loadedFiles).toEqual([]);
    expect(calls.loadedUrls).toEqual([RENDERER_FILE_URL]);
  });

  it("loads the same encoded URL it trusts when the renderer path contains a percent sign", () => {
    const { fakeWindow, calls } = buildFakeWindow();
    const rendererHtmlPath = IS_WINDOWS
      ? "C:\\Shop 100%\\renderer\\index.html"
      : "/Shop 100%/renderer/index.html";
    const expectedFileUrl = IS_WINDOWS
      ? "file:///C:/Shop%20100%25/renderer/index.html"
      : "file:///Shop%20100%25/renderer/index.html";
    const config = buildConfig({ rendererHtmlPath });

    createMainWindow(() => fakeWindow, config);

    expect(calls.loadedUrls).toEqual([expectedFileUrl]);
    expect(calls.loadedUrls).toEqual(listTrustedPageUrls(config));
    expect(calls.loadedFiles).toEqual([]);
  });
});
