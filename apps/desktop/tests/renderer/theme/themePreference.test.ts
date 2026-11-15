import { describe, expect, it } from "vitest";
import {
  readStoredPreference,
  resolveAppearance,
  writeStoredPreference,
} from "../../../src/renderer/shared/theme/themePreference";
import { THEME_STORAGE_KEY } from "../../../src/renderer/shared/theme/theme.constants";

function buildStorage(initialValue?: string) {
  const savedValues = new Map<string, string>();
  if (initialValue !== undefined) savedValues.set(THEME_STORAGE_KEY, initialValue);
  return {
    getItem: (key: string) => savedValues.get(key) ?? null,
    setItem: (key: string, value: string) => void savedValues.set(key, value),
    savedValues,
  };
}

const brokenStorage = {
  getItem: () => {
    throw new Error("storage is blocked");
  },
  setItem: () => {
    throw new Error("storage is blocked");
  },
};

describe("resolveAppearance (design guidelines 3.2)", () => {
  it("follows the operating system when the choice is System", () => {
    expect(resolveAppearance("system", true)).toBe("dark");
    expect(resolveAppearance("system", false)).toBe("light");
  });

  it("ignores the operating system when the choice is Light or Dark", () => {
    expect(resolveAppearance("light", true)).toBe("light");
    expect(resolveAppearance("dark", false)).toBe("dark");
  });
});

describe("readStoredPreference", () => {
  it("uses System when nothing was saved", () => {
    expect(readStoredPreference(buildStorage())).toBe("system");
  });

  it("returns the saved choice", () => {
    expect(readStoredPreference(buildStorage("dark"))).toBe("dark");
    expect(readStoredPreference(buildStorage("light"))).toBe("light");
  });

  it("uses System when the saved text is not one of the three choices", () => {
    expect(readStoredPreference(buildStorage("purple"))).toBe("system");
  });

  it("uses System when the browser blocks storage, and when there is none", () => {
    expect(readStoredPreference(brokenStorage)).toBe("system");
    expect(readStoredPreference(undefined)).toBe("system");
  });
});

describe("writeStoredPreference", () => {
  it("saves the choice for the next start", () => {
    const storage = buildStorage();

    writeStoredPreference(storage, "dark");

    expect(storage.savedValues.get(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("never throws when the browser blocks storage, so the choice still applies now", () => {
    expect(() => writeStoredPreference(brokenStorage, "light")).not.toThrow();
    expect(() => writeStoredPreference(undefined, "light")).not.toThrow();
  });
});
