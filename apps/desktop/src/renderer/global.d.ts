import type { ShopOsApi } from "@shopos/core/commands";

declare global {
  interface Window {
    shopos: ShopOsApi;
  }
}
export {};
