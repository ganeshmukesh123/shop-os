import type { Session } from "electron";
import { ALLOWED_PERMISSIONS } from "./constants";

export type IPermissionSession = Pick<
  Session,
  "setPermissionRequestHandler" | "setPermissionCheckHandler"
>;

export function isPermissionGranted(permissionName: string): boolean {
  return ALLOWED_PERMISSIONS.has(permissionName);
}

/** Electron approves every permission request unless told otherwise (security checklist item 5). */
export function installPermissionPolicy(session: IPermissionSession): void {
  session.setPermissionRequestHandler((_webContents, permissionName, respond) => {
    respond(isPermissionGranted(permissionName));
  });
  session.setPermissionCheckHandler((_webContents, permissionName) =>
    isPermissionGranted(permissionName),
  );
}
