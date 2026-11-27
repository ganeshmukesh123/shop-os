// Where electron-builder writes the unpacked executable, for each package flavour and platform.
// Shared by e2e-packaged.mjs, check-fuses.mjs and smoke-release.mjs.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DESKTOP_FOLDER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** release: what the counter installs (`pnpm package`). e2e: what Playwright drives (`pnpm package:e2e`). */
export const PACKAGE_FLAVOURS = Object.freeze({
  release: {
    outputFolder: "release",
    productName: "Shop OS",
    linuxNames: ["shop-os", "@shoposdesktop"],
  },
  e2e: { outputFolder: "release-e2e", productName: "Shop OS E2E", linuxNames: ["shop-os-e2e"] },
});

function listCandidateExecutables(flavour) {
  const { productName } = flavour;
  return [
    `mac-arm64/${productName}.app/Contents/MacOS/${productName}`,
    `mac/${productName}.app/Contents/MacOS/${productName}`,
    `win-unpacked/${productName}.exe`,
    ...flavour.linuxNames.map((linuxName) => `linux-unpacked/${linuxName}`),
  ];
}

/** The first packaged executable of that flavour that exists, or undefined when none was built. */
export function findPackagedExecutable(flavour) {
  const outputFolder = path.join(DESKTOP_FOLDER, flavour.outputFolder);
  return listCandidateExecutables(flavour)
    .map((relativePath) => path.join(outputFolder, relativePath))
    .find((candidatePath) => fs.existsSync(candidatePath));
}
