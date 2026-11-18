import type { IAppConfig } from "../../src/main/app/appConfig";
import {
  buildMainWindowOptions,
  createMainWindow,
  type IMainWindow,
} from "../../src/main/app/mainWindow";

const DEV_SERVER_URL = "http://localhost:5173";

const buildConfig = (overrides: Partial<IAppConfig> = {}): IAppConfig => ({
  isDev: false,
  rendererUrl: undefined,
  databasePath: "/tmp/shopos.sqlite",
  migrationsFolder: "/tmp/drizzle",
  preloadPath: "/app/preload/index.js",
  rendererHtmlPath: "/app/renderer/index.html",
  ...overrides,
});

/** A fake window that records what the app asked of it. */
function buildFakeWindow() {
  type NavigationListener = (navigationEvent: { preventDefault(): void }, url: string) => void;
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
      navigationListeners.get(eventName)?.({ preventDefault }, url);
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
    expect(calls.loadedFiles).toEqual(["/app/renderer/index.html"]);
    expect(calls.loadedUrls).toEqual([]);
  });
});
