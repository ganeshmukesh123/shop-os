import type { ISenderEvent, ISenderSummary } from "./types";

function parsePageAddress(address: string): URL | null {
  try {
    return new URL(address);
  } catch {
    return null;
  }
}

/** Same page means same scheme, host, port and path; the query and hash may differ. */
function isSamePage(senderPage: URL, trustedPage: URL): boolean {
  return (
    senderPage.protocol === trustedPage.protocol &&
    senderPage.host === trustedPage.host &&
    senderPage.pathname === trustedPage.pathname
  );
}

/**
 * A command is accepted only from the main frame showing one of the trusted pages (the app's own
 * page, or the dev server while developing). Matching is on the parsed address, never a prefix.
 */
export function isTrustedSender(
  sender: ISenderSummary | null,
  trustedPageUrls: readonly string[],
): boolean {
  const senderPage = sender?.isMainFrame ? parsePageAddress(sender.url) : null;
  const trustedPages = trustedPageUrls.map(parsePageAddress);
  return (
    senderPage !== null &&
    trustedPages.some((trustedPage) => trustedPage !== null && isSamePage(senderPage, trustedPage))
  );
}

/** Reduces an Electron IPC event to what the check needs; null when the frame is missing. */
export function summarizeSender(event: ISenderEvent): ISenderSummary | null {
  const frame = event.senderFrame;
  return frame ? { isMainFrame: frame === event.sender?.mainFrame, url: frame.url } : null;
}
