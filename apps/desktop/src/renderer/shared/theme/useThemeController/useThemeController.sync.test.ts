import { act, renderHook, waitFor } from "@testing-library/react";
import { THEME_STORAGE_KEY } from "../constants";
import type { IThemeStore, ThemePreference } from "../types";
import { useThemeController } from "./useThemeController";

// Spec 018 T035: the database holds the choice; localStorage only makes the first paint right.
function buildFakeStore(savedTheme: ThemePreference | null) {
  const loadResult = { resolve: (_theme: ThemePreference | null) => {} };
  const pendingLoad = new Promise<ThemePreference | null>((resolve) => {
    loadResult.resolve = resolve;
  });
  const fakeStore = {
    load: vi.fn(() => pendingLoad),
    save: vi.fn(async (_preference: ThemePreference) => {}),
  };
  const answer = async () => {
    await act(async () => loadResult.resolve(savedTheme));
  };
  return { fakeStore: fakeStore as IThemeStore & typeof fakeStore, answer };
}

describe("useThemeController with the database store (spec 018 T035)", () => {
  it("paints the cached choice first, then shows the database choice and caches it", async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    const { fakeStore, answer } = buildFakeStore("dark");
    const { result } = renderHook(() => useThemeController(fakeStore));
    expect(result.current.preference).toBe("light");

    await answer();

    expect(result.current.preference).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(fakeStore.save).not.toHaveBeenCalled();
  });

  it("copies the old localStorage choice into an empty database, once", async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    const { fakeStore, answer } = buildFakeStore(null);
    const { result } = renderHook(() => useThemeController(fakeStore));

    await answer();

    expect(result.current.preference).toBe("dark");
    await waitFor(() => expect(fakeStore.save).toHaveBeenCalledWith("dark"));
    expect(fakeStore.save).toHaveBeenCalledTimes(1);
  });

  it("keeps a choice made before the database answered", async () => {
    const { fakeStore, answer } = buildFakeStore("dark");
    const { result } = renderHook(() => useThemeController(fakeStore));

    act(() => result.current.setPreference("light"));
    await answer();

    expect(result.current.preference).toBe("light");
    expect(fakeStore.save).toHaveBeenCalledWith("light");
  });

  it("saves a new choice to the database and the cache", async () => {
    const { fakeStore, answer } = buildFakeStore("system");
    const { result } = renderHook(() => useThemeController(fakeStore));
    await answer();

    act(() => result.current.setPreference("dark"));

    expect(fakeStore.save).toHaveBeenCalledWith("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("keeps the cached choice when the database cannot be read", async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    const failingStore: IThemeStore = {
      load: vi.fn(async () => Promise.reject(new Error("database is locked"))),
      save: vi.fn(async () => {}),
    };
    const { result } = renderHook(() => useThemeController(failingStore));

    await act(async () => {});

    expect(result.current.preference).toBe("dark");
    expect(failingStore.save).not.toHaveBeenCalled();
  });
});
