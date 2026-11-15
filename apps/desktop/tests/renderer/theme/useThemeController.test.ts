import { act, renderHook } from "@testing-library/react";
import { THEME_STORAGE_KEY } from "../../../src/renderer/shared/theme/theme.constants";
import { useThemeController } from "../../../src/renderer/shared/theme/useThemeController";
import { installFakeMatchMedia } from "../../helpers/fakeMatchMedia";

describe("useThemeController (design guidelines section 3)", () => {
  it("starts from the saved choice", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");

    const { result } = renderHook(() => useThemeController());

    expect(result.current.preference).toBe("dark");
    expect(result.current.appearance).toBe("dark");
  });

  it("resolves System to the operating system's light or dark, and follows it", () => {
    const fakeMatchMedia = installFakeMatchMedia(false);
    const { result } = renderHook(() => useThemeController());
    expect(result.current).toMatchObject({ preference: "system", appearance: "light" });

    act(() => fakeMatchMedia.setSystemDark(true));

    expect(result.current.appearance).toBe("dark");
  });

  it("applies a new choice and saves it for the next start", () => {
    const { result } = renderHook(() => useThemeController());

    act(() => result.current.setPreference("dark"));

    expect(result.current).toMatchObject({ preference: "dark", appearance: "dark" });
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("sets the browser's colour scheme to the shown appearance", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");

    renderHook(() => useThemeController());

    expect(document.documentElement.style.colorScheme).toBe("dark");
  });
});
