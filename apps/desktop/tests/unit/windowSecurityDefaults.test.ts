import { COMMAND_NAMES } from "@shopos/core";
import { buildMainWindowOptions } from "../../src/main/app/mainWindow";
import { contentSecurityPolicy } from "../../src/main/app/securityHeaders";
import { buildShopOsApi } from "../../src/preload/bridge";

/** FR-010: these settings are already right; this test fails if anyone relaxes one. */
describe("window security defaults", () => {
  it("keeps context isolation and the sandbox on and Node integration off", () => {
    const { webPreferences } = buildMainWindowOptions("/app/preload/index.js");
    expect(webPreferences?.contextIsolation).toBe(true);
    expect(webPreferences?.sandbox).toBe(true);
    expect(webPreferences?.nodeIntegration).toBe(false);
  });

  it("never turns on the web preferences that widen the page's reach", () => {
    const { webPreferences } = buildMainWindowOptions("/app/preload/index.js");
    expect(webPreferences?.webviewTag).toBeFalsy();
    expect(webPreferences?.nodeIntegrationInSubFrames).toBeFalsy();
    expect(webPreferences?.nodeIntegrationInWorker).toBeFalsy();
    expect(webPreferences?.webSecurity).not.toBe(false);
    expect(webPreferences?.allowRunningInsecureContent).toBeFalsy();
    expect(webPreferences?.experimentalFeatures).toBeFalsy();
    expect(webPreferences?.enableBlinkFeatures).toBeFalsy();
  });

  it("keeps the packaged content security policy closed", () => {
    const policy = contentSecurityPolicy(false);
    expect(policy).toContain("default-src 'self'");
    expect(policy.match(/script-src[^;]*/)?.[0]).toBe("script-src 'self'");
    expect(policy).toContain("connect-src 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  it("exposes exactly the contract's commands on the bridge and nothing else", async () => {
    const invoke = vi.fn(async () => ({ ok: true }));
    const bridge = buildShopOsApi(invoke);
    expect(Object.keys(bridge).sort()).toEqual([...COMMAND_NAMES].sort());
  });

  // The preload entry itself is run with a mocked contextBridge in preload.test.ts, which fails
  // if anything beyond the contract's commands (raw ipcRenderer included) reaches the page.
});
