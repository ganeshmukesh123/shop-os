import type { MenuItemConstructorOptions } from "electron";
import { buildAppMenuTemplate, installAppMenu } from "./appMenu";
import { KEEP_DEFAULT_MENU } from "./constants";
import type { IMenuApi } from "./types";

// Spec 018 FR-009, decision D2 (Mac is the main platform): Mac keeps Quit and the Edit shortcuts;
// packaged builds lose the default View menu (Reload, Toggle Developer Tools).
function listRoles(template: readonly MenuItemConstructorOptions[]): unknown[] {
  return template.map((menuItem) => menuItem.role);
}

describe("buildAppMenuTemplate (FR-009)", () => {
  it("gives a packaged Mac build only the app menu and the Edit menu", () => {
    const menuTemplate = buildAppMenuTemplate({ platform: "darwin", isPackaged: true });

    expect(Array.isArray(menuTemplate) && listRoles(menuTemplate)).toEqual(["appMenu", "editMenu"]);
  });

  it.each(["win32", "linux"] as const)("removes the menu from a packaged %s build", (platform) => {
    const menuTemplate = buildAppMenuTemplate({ platform, isPackaged: true });

    expect(menuTemplate).toBeNull();
  });

  it.each(["darwin", "win32", "linux"] as const)(
    "keeps Electron's default menu when unpackaged on %s (developers need DevTools)",
    (platform) => {
      const menuTemplate = buildAppMenuTemplate({ platform, isPackaged: false });

      expect(menuTemplate).toBe(KEEP_DEFAULT_MENU);
    },
  );
});

describe("installAppMenu", () => {
  function buildFakeMenu() {
    const fakeMenu = {
      buildFromTemplate: vi.fn((menuTemplate: unknown) => ({ builtFrom: menuTemplate })),
      setApplicationMenu: vi.fn(),
    };
    return { ...fakeMenu, asMenuApi: fakeMenu as unknown as IMenuApi };
  }

  it("sets the built Mac menu", () => {
    const fakeMenu = buildFakeMenu();

    installAppMenu(fakeMenu.asMenuApi, { platform: "darwin", isPackaged: true });

    expect(fakeMenu.setApplicationMenu).toHaveBeenCalledWith({
      builtFrom: [{ role: "appMenu" }, { role: "editMenu" }],
    });
  });

  it("sets no menu at all on a packaged Windows build", () => {
    const fakeMenu = buildFakeMenu();

    installAppMenu(fakeMenu.asMenuApi, { platform: "win32", isPackaged: true });

    expect(fakeMenu.setApplicationMenu).toHaveBeenCalledWith(null);
  });

  it("leaves the default menu alone when unpackaged", () => {
    const fakeMenu = buildFakeMenu();

    installAppMenu(fakeMenu.asMenuApi, { platform: "darwin", isPackaged: false });

    expect(fakeMenu.setApplicationMenu).not.toHaveBeenCalled();
  });
});
