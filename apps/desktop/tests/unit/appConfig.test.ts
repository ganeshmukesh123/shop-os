import path from "node:path";
import { applyUserDataOverride, readAppConfig } from "../../src/main/app/appConfig";

const LOCATIONS = {
  resourcesPath: "/Applications/Shop OS.app/Resources",
  baseDirectory: "/work/apps/desktop/out/main",
};
const DEV_SERVER_URL = "http://localhost:5173";

const buildApp = (isPackaged: boolean) => ({
  isPackaged,
  getPath: () => "/Users/shop/Library/Application Support/Shop OS",
});

describe("applyUserDataOverride", () => {
  it("points the app at the folder named in SHOPOS_USER_DATA", () => {
    const setPath = vi.fn();
    applyUserDataOverride({ setPath }, { SHOPOS_USER_DATA: "/tmp/throwaway" });
    expect(setPath).toHaveBeenCalledWith("userData", "/tmp/throwaway");
  });

  it("leaves the data folder alone when the variable is missing or empty", () => {
    const setPath = vi.fn();
    applyUserDataOverride({ setPath }, {});
    applyUserDataOverride({ setPath }, { SHOPOS_USER_DATA: "" });
    expect(setPath).not.toHaveBeenCalled();
  });
});

describe("readAppConfig", () => {
  it("uses the real database and the packaged resources in a packaged app", () => {
    const config = readAppConfig(buildApp(true), {}, LOCATIONS);
    expect(config.isDev).toBe(false);
    expect(config.databasePath).toBe(
      path.join("/Users/shop/Library/Application Support/Shop OS", "shopos.sqlite"),
    );
    expect(config.migrationsFolder).toBe(path.join(LOCATIONS.resourcesPath, "drizzle"));
  });

  it("uses a throwaway dev database when running from the dev server", () => {
    const config = readAppConfig(
      buildApp(false),
      { ELECTRON_RENDERER_URL: DEV_SERVER_URL },
      LOCATIONS,
    );
    expect(config.isDev).toBe(true);
    expect(config.rendererUrl).toBe(DEV_SERVER_URL);
    expect(path.basename(config.databasePath)).toBe("shopos-dev.sqlite");
  });

  it("is not dev without a dev server address, so it never touches the dev database by accident", () => {
    const config = readAppConfig(buildApp(false), {}, LOCATIONS);
    expect(config.isDev).toBe(false);
    expect(path.basename(config.databasePath)).toBe("shopos.sqlite");
  });

  it("never treats a packaged app as dev, even with a dev server address set", () => {
    const config = readAppConfig(
      buildApp(true),
      { ELECTRON_RENDERER_URL: DEV_SERVER_URL },
      LOCATIONS,
    );
    expect(config.isDev).toBe(false);
  });

  it("finds migrations, preload and the page relative to the main bundle when not packaged", () => {
    const config = readAppConfig(buildApp(false), {}, LOCATIONS);
    expect(config.migrationsFolder).toBe(path.resolve(LOCATIONS.baseDirectory, "../../drizzle"));
    expect(config.preloadPath).toBe(path.join(LOCATIONS.baseDirectory, "../preload/index.js"));
    expect(config.rendererHtmlPath).toBe(
      path.join(LOCATIONS.baseDirectory, "../renderer/index.html"),
    );
  });
});
