import { isTrustedSender, summarizeSender } from "../../src/main/ipc/senderPolicy/senderPolicy";

const APP_PAGE_URL =
  "file:///Applications/Shop%20OS.app/Contents/Resources/app/renderer/index.html";
const DEV_PAGE_URL = "http://localhost:5173/";

describe("isTrustedSender", () => {
  const packagedPages = [APP_PAGE_URL];
  const developmentPages = [DEV_PAGE_URL];

  it.each([
    [
      "the app's own page, main frame",
      { isMainFrame: true, url: APP_PAGE_URL },
      packagedPages,
      true,
    ],
    [
      "the app's own page with a query and hash",
      { isMainFrame: true, url: `${APP_PAGE_URL}?tab=bills#top` },
      packagedPages,
      true,
    ],
    ["a missing frame", null, packagedPages, false],
    ["a same-origin child frame", { isMainFrame: false, url: APP_PAGE_URL }, packagedPages, false],
    ["another local file", { isMainFrame: true, url: "file:///etc/hosts" }, packagedPages, false],
    [
      "a foreign web page",
      { isMainFrame: true, url: "https://evil.example/index.html" },
      packagedPages,
      false,
    ],
    [
      "the dev server page in a packaged build",
      { isMainFrame: true, url: DEV_PAGE_URL },
      packagedPages,
      false,
    ],
    [
      "a look-alike dev server host",
      { isMainFrame: true, url: "http://localhost.evil.example:5173/" },
      developmentPages,
      false,
    ],
    [
      "the dev server page in development",
      { isMainFrame: true, url: DEV_PAGE_URL },
      developmentPages,
      true,
    ],
    [
      "an address that cannot be parsed",
      { isMainFrame: true, url: "not a url" },
      packagedPages,
      false,
    ],
    ["an empty address", { isMainFrame: true, url: "" }, packagedPages, false],
  ])("%s", (_caseName, sender, trustedPageUrls, expectedTrust) => {
    expect(isTrustedSender(sender, trustedPageUrls)).toBe(expectedTrust);
  });

  it("refuses everything when no page is trusted", () => {
    expect(isTrustedSender({ isMainFrame: true, url: APP_PAGE_URL }, [])).toBe(false);
  });
});

describe("summarizeSender", () => {
  const mainFrame = { url: APP_PAGE_URL };

  it("marks the sender's main frame", () => {
    const event = { senderFrame: mainFrame, sender: { mainFrame } };
    expect(summarizeSender(event)).toEqual({ isMainFrame: true, url: APP_PAGE_URL });
  });

  it("marks a different frame as not the main frame", () => {
    const event = { senderFrame: { url: APP_PAGE_URL }, sender: { mainFrame } };
    expect(summarizeSender(event)).toEqual({ isMainFrame: false, url: APP_PAGE_URL });
  });

  it("returns null when the frame is missing", () => {
    expect(summarizeSender({ senderFrame: null, sender: { mainFrame } })).toBeNull();
  });

  it("returns null for an event with no sender shape at all", () => {
    expect(summarizeSender({})).toBeNull();
  });
});
