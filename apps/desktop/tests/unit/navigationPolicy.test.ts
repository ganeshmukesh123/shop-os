import { isNavigationAllowed } from "../../src/main/app/navigationPolicy/navigationPolicy";

const PAGE_PATH = "/Applications/Shop OS.app/Contents/Resources/app/renderer/index.html";
const PAGE_URL = "file:///Applications/Shop%20OS.app/Contents/Resources/app/renderer/index.html";
const DEV_SERVER_URL = "http://localhost:5173";

const PACKAGED_CONFIG = { isDev: false, rendererUrl: undefined, rendererHtmlPath: PAGE_PATH };
const DEV_CONFIG = { isDev: true, rendererUrl: DEV_SERVER_URL, rendererHtmlPath: PAGE_PATH };

describe("isNavigationAllowed", () => {
  it.each([
    ["the app's own page", PAGE_URL, PACKAGED_CONFIG, true],
    ["the app's own page with a hash", `${PAGE_URL}#bills`, PACKAGED_CONFIG, true],
    ["another local file", "file:///etc/hosts", PACKAGED_CONFIG, false],
    ["a local file beside the page", `${PAGE_URL}.evil.html`, PACKAGED_CONFIG, false],
    ["a web address", "https://example.com", PACKAGED_CONFIG, false],
    ["the dev server in a packaged build", `${DEV_SERVER_URL}/`, PACKAGED_CONFIG, false],
    [
      "the dev server in a packaged build even if a dev address is set",
      `${DEV_SERVER_URL}/`,
      { ...PACKAGED_CONFIG, rendererUrl: DEV_SERVER_URL },
      false,
    ],
    ["the dev server in development", `${DEV_SERVER_URL}/index.html`, DEV_CONFIG, true],
    ["the app's own page in development", PAGE_URL, DEV_CONFIG, true],
    ["a look-alike dev host", "http://localhost.evil.example:5173/", DEV_CONFIG, false],
    ["a look-alike with the dev address as a prefix", "http://localhost:51730/", DEV_CONFIG, false],
    ["the dev host on another port", "http://localhost:9999/", DEV_CONFIG, false],
    ["the dev host over another scheme", "https://localhost:5173/", DEV_CONFIG, false],
    ["a dev address with credentials", "http://localhost:5173@evil.example/", DEV_CONFIG, false],
    ["text that cannot be parsed", "not a url", PACKAGED_CONFIG, false],
    ["an empty address", "", DEV_CONFIG, false],
    [
      "development without a dev server address",
      "http://localhost:5173/",
      { ...DEV_CONFIG, rendererUrl: undefined },
      false,
    ],
    [
      "development with an unparsable dev server address",
      "http://localhost:5173/",
      { ...DEV_CONFIG, rendererUrl: "nonsense" },
      false,
    ],
  ])("%s", (_caseName, address, config, expectedAllowed) => {
    expect(isNavigationAllowed(address, config)).toBe(expectedAllowed);
  });
});
