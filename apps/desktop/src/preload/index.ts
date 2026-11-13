import { contextBridge, ipcRenderer } from "electron";
import { COMMAND_NAMES, type ShopOsApi } from "@shopos/core/commands";

// Narrow bridge: exactly the commands in contracts/ipc-commands.md, nothing else.
const api = Object.fromEntries(
  COMMAND_NAMES.map((name) => [
    name,
    (input: unknown) => ipcRenderer.invoke("shopos:invoke", name, input ?? {}),
  ]),
) as unknown as ShopOsApi;

contextBridge.exposeInMainWorld("shopos", api);
