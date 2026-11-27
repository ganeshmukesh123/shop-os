import { describe, expect, it } from "vitest";
import { EXPECTED_FUSES, FUSE_STATE, findFuseDifferences } from "./fuseCheck.mjs";

// Fuse indexes from @electron/fuses FuseV1Options (spec 018, contracts/hardening-policies.md section 4).
const RUN_AS_NODE = 0;
const NODE_OPTIONS = 2;
const NODE_CLI_INSPECT = 3;
const ASAR_INTEGRITY = 4;
const ONLY_LOAD_FROM_ASAR = 5;

function buildHardenedWire(): Record<number, number> {
  return {
    [RUN_AS_NODE]: FUSE_STATE.disabled,
    [NODE_OPTIONS]: FUSE_STATE.disabled,
    [NODE_CLI_INSPECT]: FUSE_STATE.disabled,
    [ASAR_INTEGRITY]: FUSE_STATE.enabled,
    [ONLY_LOAD_FROM_ASAR]: FUSE_STATE.enabled,
  };
}

describe("findFuseDifferences (FR-004, FR-006)", () => {
  it("reports nothing for a packaged app with every expected fuse", () => {
    const differences = findFuseDifferences(buildHardenedWire(), EXPECTED_FUSES);

    expect(differences).toEqual([]);
  });

  it("names RunAsNode when it is still on (US4 scenario 2)", () => {
    const fuseWire = { ...buildHardenedWire(), [RUN_AS_NODE]: FUSE_STATE.enabled };

    const differences = findFuseDifferences(fuseWire, EXPECTED_FUSES);

    expect(differences).toEqual(["RunAsNode: expected off, found on"]);
  });

  it("names ASAR integrity when it was never switched on", () => {
    const fuseWire = { ...buildHardenedWire(), [ASAR_INTEGRITY]: FUSE_STATE.disabled };

    const differences = findFuseDifferences(fuseWire, EXPECTED_FUSES);

    expect(differences).toEqual(["EnableEmbeddedAsarIntegrityValidation: expected on, found off"]);
  });

  it("treats a missing or removed fuse as a difference, not as a pass", () => {
    const fuseWire: Record<number, number> = {
      ...buildHardenedWire(),
      [ONLY_LOAD_FROM_ASAR]: FUSE_STATE.removed,
    };
    delete fuseWire[NODE_OPTIONS];

    const differences = findFuseDifferences(fuseWire, EXPECTED_FUSES);

    expect(differences).toEqual([
      "EnableNodeOptionsEnvironmentVariable: expected off, found missing",
      "OnlyLoadAppFromAsar: expected on, found removed",
    ]);
  });

  it("treats an inherited fuse as a difference (the unpacked dev binary)", () => {
    const fuseWire = { ...buildHardenedWire(), [NODE_CLI_INSPECT]: FUSE_STATE.inherited };

    const differences = findFuseDifferences(fuseWire, EXPECTED_FUSES);

    expect(differences).toEqual(["EnableNodeCliInspectArguments: expected off, found inherited"]);
  });

  it("expects exactly the five fuses of the contract", () => {
    const expectedNames = EXPECTED_FUSES.map((expectedFuse) => expectedFuse.name);

    expect(expectedNames).toEqual([
      "RunAsNode",
      "EnableNodeOptionsEnvironmentVariable",
      "EnableNodeCliInspectArguments",
      "EnableEmbeddedAsarIntegrityValidation",
      "OnlyLoadAppFromAsar",
    ]);
  });
});
