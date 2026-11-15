import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemePicker } from "../../../src/renderer/shared/theme/ThemePicker";
import { ThemeProvider } from "../../../src/renderer/shared/theme/ThemeProvider";
import { THEME_STORAGE_KEY } from "../../../src/renderer/shared/theme/theme.constants";
import { useThemePreference } from "../../../src/renderer/shared/theme/useThemePreference";
import { installFakeMatchMedia } from "../../helpers/fakeMatchMedia";

/** The same wiring Settings uses: the hook feeds the pure picker. */
function ThemeSetting() {
  const { preference, setPreference } = useThemePreference();
  return <ThemePicker preference={preference} onChange={setPreference} />;
}

function renderApp() {
  return render(
    <ThemeProvider>
      <ThemeSetting />
    </ThemeProvider>,
  );
}

/** Radix puts `dark` or `light` on its root element; that is what the user sees. */
const shownAppearance = () =>
  document.querySelector(".radix-themes")?.classList.contains("dark") ? "dark" : "light";

describe("ThemeProvider (design guidelines section 3)", () => {
  it("is right on the first render when Dark was saved, with no flash of light", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");

    renderApp();

    expect(shownAppearance()).toBe("dark");
  });

  it("follows the operating system by default, from the first render", () => {
    installFakeMatchMedia(true);

    renderApp();

    expect(shownAppearance()).toBe("dark");
  });

  it("changes at once, without a restart, when the operating system changes", () => {
    const fakeMatchMedia = installFakeMatchMedia(false);
    renderApp();
    expect(shownAppearance()).toBe("light");

    act(() => fakeMatchMedia.setSystemDark(true));

    expect(shownAppearance()).toBe("dark");
  });

  it("ignores the operating system when Light was chosen", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    const fakeMatchMedia = installFakeMatchMedia(false);
    renderApp();

    act(() => fakeMatchMedia.setSystemDark(true));

    expect(shownAppearance()).toBe("light");
  });

  it("applies a new choice at once and remembers it for the next start", async () => {
    renderApp();

    await userEvent.click(screen.getByRole("radio", { name: "Dark" }));

    expect(shownAppearance()).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("tells the browser the colour scheme, so scrollbars and the page edge match", async () => {
    renderApp();

    await userEvent.click(screen.getByRole("radio", { name: "Dark" }));

    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("stops listening to the operating system when it goes away", () => {
    const fakeMatchMedia = installFakeMatchMedia(false);
    const { unmount } = renderApp();
    expect(fakeMatchMedia.listenerCount()).toBeGreaterThan(0);

    unmount();

    expect(fakeMatchMedia.listenerCount()).toBe(0);
  });
});

describe("ThemePicker", () => {
  it("names all three choices in words and marks the current one", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");

    renderApp();

    expect(screen.getByRole("radio", { name: "System" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Light" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: "Dark" }).getAttribute("aria-checked")).toBe("false");
  });
});
