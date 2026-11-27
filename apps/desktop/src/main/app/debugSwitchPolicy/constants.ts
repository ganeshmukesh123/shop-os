/**
 * Chromium switches that open a DevTools connection to the page. The fuses already block Node's
 * `--inspect` family; these two are Chromium's own and no fuse covers them (spec 018 O15).
 */
export const FORBIDDEN_DEBUG_SWITCHES: readonly string[] = [
  "remote-debugging-port",
  "remote-debugging-pipe",
];
