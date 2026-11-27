import { DATABASE_THEME_STORE } from "./themeStore";

describe("DATABASE_THEME_STORE", () => {
  afterEach(() => {
    delete (window as { shopos?: unknown }).shopos;
  });

  it("reads the saved theme through settings.getTheme", async () => {
    const getTheme = vi.fn(async () => ({ ok: true, data: { theme: "dark" } }));
    (window as { shopos?: unknown }).shopos = { "settings.getTheme": getTheme };

    const savedTheme = await DATABASE_THEME_STORE.load();

    expect(savedTheme).toBe("dark");
    expect(getTheme).toHaveBeenCalledWith({});
  });

  it("saves a choice through settings.setTheme", async () => {
    const setTheme = vi.fn(async () => ({ ok: true, data: { theme: "light" } }));
    (window as { shopos?: unknown }).shopos = { "settings.setTheme": setTheme };

    await DATABASE_THEME_STORE.save("light");

    expect(setTheme).toHaveBeenCalledWith({ theme: "light" });
  });

  it("rejects when the command fails, so the caller can keep the cached choice", async () => {
    const getTheme = vi.fn(async () => ({ ok: false, code: "INTERNAL", message: "down" }));
    (window as { shopos?: unknown }).shopos = { "settings.getTheme": getTheme };

    await expect(DATABASE_THEME_STORE.load()).rejects.toThrow("down");
  });
});
