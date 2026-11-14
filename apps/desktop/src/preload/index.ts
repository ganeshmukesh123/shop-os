import { contextBridge, ipcRenderer } from "electron";
import { buildShopOsApi } from "./bridge";

contextBridge.exposeInMainWorld(
  "shopos",
  buildShopOsApi((channel, commandName, input) => ipcRenderer.invoke(channel, commandName, input)),
);
