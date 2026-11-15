import type { Session } from "electron";

const DEV_POLICY =
  "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: ws://localhost:* http://localhost:*";
const PACKAGED_POLICY =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

export function contentSecurityPolicy(isDev: boolean): string {
  return isDev ? DEV_POLICY : PACKAGED_POLICY;
}

/** Every response the renderer loads carries the Content-Security-Policy (constitution: Electron security). */
export function installSecurityHeaders(session: Pick<Session, "webRequest">, isDev: boolean): void {
  const policy = contentSecurityPolicy(isDev);
  session.webRequest.onHeadersReceived((details, respond) => {
    respond({
      responseHeaders: { ...details.responseHeaders, "Content-Security-Policy": [policy] },
    });
  });
}
