import { useSyncExternalStore } from "react";
import { DARK_COLOR_SCHEME_QUERY } from "../constants";

function subscribeToSystemTheme(onChange: () => void): () => void {
  const darkQuery = window.matchMedia(DARK_COLOR_SCHEME_QUERY);
  darkQuery.addEventListener("change", onChange);
  return () => darkQuery.removeEventListener("change", onChange);
}

function readSystemDark(): boolean {
  return window.matchMedia(DARK_COLOR_SCHEME_QUERY).matches;
}

/** True while the operating system is in dark mode; updates live when it changes. */
export function useSystemDarkMode(): boolean {
  return useSyncExternalStore(subscribeToSystemTheme, readSystemDark);
}
