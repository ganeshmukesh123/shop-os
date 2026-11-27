import { COMMAND_NAMES } from "@shopos/core";
import { buildHandlersFixture } from "../helpers/handlersFixture";

/**
 * Spec 002 T035: the catalogue.*, families.* and variants.* commands of US1 are registered, run
 * the real services, and return the contract's results and error codes.
 */
const US1_COMMANDS = [
  "catalogue.categories.list",
  "catalogue.categories.save",
  "catalogue.brands.list",
  "catalogue.brands.save",
  "catalogue.units.list",
  "families.previewVariants",
  "families.create",
  "families.get",
  "families.update",
  "families.addVariants",
  "variants.update",
  "variants.setActive",
  "variants.setConversions",
] as const;

const pipe = (size: string) => ({
  axes: { size },
  baseUom: "pcs",
  allowDecimal: false,
  sellingPricePaise: 12_000,
  openingQtyMilli: 5_000,
});

describe("family commands through IPC (spec 002 T035)", () => {
  it("lists every US1 command, so the preload bridge exposes it", () => {
    expect(COMMAND_NAMES).toEqual(expect.arrayContaining([...US1_COMMANDS]));
  });

  it("creates a family through families.create and reads it back with families.get", async () => {
    const { handlers } = buildHandlersFixture();

    const created = await handlers["families.create"]({
      family: { name: "PVC Pipe", kind: "general", axisKeys: ["size"] },
      variants: [pipe("1 in"), pipe("2 in")],
    });
    if (!created.ok) throw new Error(created.message);
    const detail = await handlers["families.get"]({ id: created.data.family.id });

    expect(detail.ok && detail.data.variants.map((variant) => variant.stockMilli)).toEqual([
      5_000, 5_000,
    ]);
  });

  it("returns DUPLICATE_SIGNATURE as a failed result, not a thrown error", async () => {
    const { handlers } = buildHandlersFixture();

    const result = await handlers["families.create"]({
      family: { name: "PVC Pipe", kind: "general", axisKeys: ["size"] },
      variants: [pipe("1 in"), pipe("1 in")],
    });

    expect(result).toMatchObject({ ok: false, code: "DUPLICATE_SIGNATURE" });
  });

  it("returns INVALID_FIELD for an input the schema refuses", async () => {
    const { handlers } = buildHandlersFixture();

    expect(await handlers["catalogue.brands.save"]({ name: "" })).toMatchObject({
      ok: false,
      code: "INVALID_FIELD",
    });
  });

  it("previews the 500-combination limit through families.previewVariants", async () => {
    const { handlers } = buildHandlersFixture();
    const values = (count: number) => Array.from({ length: count }, (_unused, index) => `${index}`);

    const result = await handlers["families.previewVariants"]({
      axisKeys: ["size", "class"],
      axisValues: { size: values(30), class: values(20) },
    });

    expect(result).toMatchObject({ ok: false, code: "TOO_MANY_COMBINATIONS" });
  });

  it("makes a family found by search as soon as it is created", async () => {
    const { handlers, services } = buildHandlersFixture();

    await handlers["families.create"]({
      family: { name: "Gate Valve", kind: "general", axisKeys: ["size"] },
      variants: [pipe("1 in")],
    });

    expect(services.search.search("gate").map((searchResult) => searchResult.kind)).toEqual([
      "variant",
    ]);
  });
});
