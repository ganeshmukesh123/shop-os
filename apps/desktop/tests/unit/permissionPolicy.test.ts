import {
  installPermissionPolicy,
  type IPermissionSession,
  isPermissionGranted,
} from "../../src/main/app/permissionPolicy/permissionPolicy";

const PERMISSION_NAMES = [
  "media",
  "geolocation",
  "notifications",
  "midi",
  "clipboard-read",
  "fullscreen",
  "openExternal",
  "unknown-future-permission",
];

describe("isPermissionGranted", () => {
  it.each(PERMISSION_NAMES)("denies %s by default", (permissionName) => {
    expect(isPermissionGranted(permissionName)).toBe(false);
  });
});

describe("installPermissionPolicy", () => {
  type RequestHandler = (webContents: unknown, permissionName: string, respond: () => void) => void;
  type CheckHandler = (webContents: unknown, permissionName: string) => boolean;

  function installOnFakeSession() {
    const handlers: { request?: RequestHandler; check?: CheckHandler } = {};
    const fakeSession = {
      setPermissionRequestHandler: (handler: RequestHandler) => void (handlers.request = handler),
      setPermissionCheckHandler: (handler: CheckHandler) => void (handlers.check = handler),
    };
    installPermissionPolicy(fakeSession as unknown as IPermissionSession);
    return handlers;
  }

  it.each(PERMISSION_NAMES)("answers a request for %s with denied", (permissionName) => {
    const handlers = installOnFakeSession();
    const callback = vi.fn();
    handlers.request?.({}, permissionName, callback);
    expect(callback).toHaveBeenCalledExactlyOnceWith(false);
  });

  it.each(PERMISSION_NAMES)("reports %s as not granted on a check", (permissionName) => {
    const handlers = installOnFakeSession();
    expect(handlers.check?.({}, permissionName)).toBe(false);
  });
});
