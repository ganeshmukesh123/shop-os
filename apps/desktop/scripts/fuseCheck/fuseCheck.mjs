// Pure comparison of a packaged app's fuse wire with the fuse set in
// specs/018-electron-hardening/contracts/hardening-policies.md section 4 (FR-004, FR-006).
// The expected set lives here, not in electron-builder.yml, so a config edit that drops a fuse is caught.

/** Byte values @electron/fuses reports for each fuse (FuseState in its constants). */
export const FUSE_STATE = Object.freeze({
  disabled: 48,
  enabled: 49,
  removed: 114,
  inherited: 144,
});

const STATE_WORD_BY_VALUE = new Map([
  [FUSE_STATE.disabled, "off"],
  [FUSE_STATE.enabled, "on"],
  [FUSE_STATE.removed, "removed"],
  [FUSE_STATE.inherited, "inherited"],
]);

/** Index is the position in the fuse wire (FuseV1Options). */
export const EXPECTED_FUSES = Object.freeze([
  { name: "RunAsNode", index: 0, isEnabled: false },
  { name: "EnableNodeOptionsEnvironmentVariable", index: 2, isEnabled: false },
  { name: "EnableNodeCliInspectArguments", index: 3, isEnabled: false },
  { name: "EnableEmbeddedAsarIntegrityValidation", index: 4, isEnabled: true },
  { name: "OnlyLoadAppFromAsar", index: 5, isEnabled: true },
]);

function describeFoundState(fuseWire, fuseIndex) {
  return STATE_WORD_BY_VALUE.get(fuseWire[fuseIndex]) ?? "missing";
}

/** One line per fuse that differs, naming the fuse; an empty list means the app is hardened. */
export function findFuseDifferences(fuseWire, expectedFuses) {
  return expectedFuses
    .map((expectedFuse) => ({
      expectedFuse,
      expectedWord: expectedFuse.isEnabled ? "on" : "off",
      foundWord: describeFoundState(fuseWire, expectedFuse.index),
    }))
    .filter((comparison) => comparison.expectedWord !== comparison.foundWord)
    .map(
      (comparison) =>
        `${comparison.expectedFuse.name}: expected ${comparison.expectedWord}, found ${comparison.foundWord}`,
    );
}
