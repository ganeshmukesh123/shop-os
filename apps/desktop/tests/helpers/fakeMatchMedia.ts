const DARK_QUERY = "(prefers-color-scheme: dark)";

type ChangeListener = (changeEvent: { matches: boolean }) => void;

export interface IFakeMatchMedia {
  /** Pretend the operating system switched to dark (true) or light (false). */
  setSystemDark: (isDark: boolean) => void;
  /** How many components are listening for the system theme right now. */
  listenerCount: () => number;
}

/** Replaces `window.matchMedia` with a controllable fake of the operating-system theme. */
export function installFakeMatchMedia(isSystemDarkAtStart: boolean): IFakeMatchMedia {
  let isSystemDark = isSystemDarkAtStart;
  const listeners = new Set<ChangeListener>();

  window.matchMedia = ((query: string) => ({
    media: query,
    get matches() {
      return query === DARK_QUERY && isSystemDark;
    },
    addEventListener: (_eventName: string, listener: ChangeListener) => listeners.add(listener),
    removeEventListener: (_eventName: string, listener: ChangeListener) =>
      listeners.delete(listener),
  })) as unknown as typeof window.matchMedia;

  return {
    setSystemDark: (isDark) => {
      isSystemDark = isDark;
      listeners.forEach((listener) => listener({ matches: isDark }));
    },
    listenerCount: () => listeners.size,
  };
}
