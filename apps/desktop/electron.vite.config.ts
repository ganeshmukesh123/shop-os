import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";

/** Production-only Content-Security-Policy meta tag (dev needs inline scripts for hot reload). */
const csp: Plugin = {
  name: "shopos-csp",
  apply: "build",
  transformIndexHtml: (html) =>
    html.replace(
      "<!--CSP-->",
      `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">`,
    ),
};

// better-sqlite3 is a native module and stays external; everything else is bundled into the output.
export default {
  main: {
    build: {
      outDir: "out/main",
      rollupOptions: {
        external: ["electron", "better-sqlite3"],
        input: resolve(__dirname, "src/main/index.ts"),
      },
    },
  },
  preload: {
    build: {
      outDir: "out/preload",
      rollupOptions: { external: ["electron"], input: resolve(__dirname, "src/preload/index.ts") },
    },
  },
  renderer: {
    root: resolve(__dirname, "src/renderer"),
    build: {
      outDir: resolve(__dirname, "out/renderer"),
      rollupOptions: { input: resolve(__dirname, "src/renderer/index.html") },
    },
    plugins: [react(), csp],
  },
};
