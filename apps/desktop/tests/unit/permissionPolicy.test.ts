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
  // Handler types come from the session contract, so a change in Electron's signature fails typecheck.
  type RequestHandler = NonNullable<
    Parameters<IPermissionSession["setPermissionRequestHandler"]>[0]
  >;
  type CheckHandler = NonNullable<Parameters<IPermissionSession["setPermissionCheckHandler"]>[0]>;
  type RequestArguments = Parameters<RequestHandler>;
  type CheckArguments = Parameters<CheckHandler>;

  // Explicit fixtures for the arguments the policy ignores.
  const FAKE_WEB_CONTENTS = {} as RequestArguments[0];
  const FAKE_REQUEST_DETAILS = {} as RequestArguments[3];
  const FAKE_CHECK_DETAILS = {} as CheckArguments[3];
  const REQUESTING_ORIGIN = "file://";

  function installOnFakeSession() {
    const handlers: { request?: RequestHandler; check?: CheckHandler } = {};
    const fakeSession: IPermissionSession = {
      setPermissionRequestHandler: (handler) => void (handlers.request = handler ?? undefined),
      setPermissionCheckHandler: (handler) => void (handlers.check = handler ?? undefined),
    };
    installPermissionPolicy(fakeSession);
    return handlers;
  }

  it.each(PERMISSION_NAMES)("answers a request for %s with denied", (permissionName) => {
    const handlers = installOnFakeSession();
    const respond = vi.fn<RequestArguments[2]>();

    handlers.request?.(
      FAKE_WEB_CONTENTS,
      permissionName as RequestArguments[1],
      respond,
      FAKE_REQUEST_DETAILS,
    );

    expect(respond).toHaveBeenCalledExactlyOnceWith(false);
  });

  it.each(PERMISSION_NAMES)("reports %s as not granted on a check", (permissionName) => {
    const handlers = installOnFakeSession();

    const isGranted = handlers.check?.(
      null,
      permissionName as CheckArguments[1],
      REQUESTING_ORIGIN,
      FAKE_CHECK_DETAILS,
    );

    expect(isGranted).toBe(false);
  });
});
