import { CoreError } from "@shopos/core";
import { createTestDb } from "../../../../tests/helpers/testDb";
import { CatalogueService } from "./CatalogueService";

/** Spec 002 T032 and T033: categories, brands and units (data-model.md "Catalogue"). */
function catalogue() {
  const testDb = createTestDb();
  return { testDb, service: new CatalogueService(testDb.db, testDb.ctx) };
}

function codeOf(action: () => unknown): string | undefined {
  try {
    action();
  } catch (caughtError) {
    if (caughtError instanceof CoreError) return caughtError.code;
    throw caughtError;
  }
  return undefined;
}

describe("CatalogueService: units (spec 002 T032)", () => {
  it("lists the nine seeded units with their dimension and decimal default", () => {
    const { service } = catalogue();

    const { units } = service.listUnits();

    expect(units.map((unit) => unit.code)).toEqual([
      "box",
      "bundle",
      "kg",
      "litre",
      "metre",
      "ml",
      "pair",
      "pcs",
      "roll",
    ]);
    expect(units.find((unit) => unit.code === "metre")).toEqual({
      code: "metre",
      label: "Metre",
      dimension: "length",
      allowDecimal: true,
    });
  });
});

describe("CatalogueService: categories (spec 002 T033)", () => {
  it("saves a category tree and gives each the defaults it inherits", () => {
    const { service } = catalogue();
    const pipes = service.saveCategory({
      name: "Pipes",
      defaultHsn: "3917",
      defaultBaseUom: "metre",
      titleTemplate: "{brand} {size} {class}",
    }).category;
    const pvc = service.saveCategory({
      name: "PVC",
      parentId: pipes.id,
      defaultHsn: "391723",
    }).category;

    expect(pvc.resolved).toEqual({
      defaultHsn: "391723",
      defaultBaseUom: "metre",
      titleTemplate: "{brand} {size} {class}",
    });
    expect(service.listCategories().categories.map((category) => category.name)).toEqual([
      "Pipes",
      "PVC",
    ]);
  });

  it("renames a category in place", () => {
    const { service } = catalogue();
    const pipes = service.saveCategory({ name: "Pipes" }).category;

    const renamed = service.saveCategory({ id: pipes.id, name: "Pipes and fittings" }).category;

    expect(renamed.id).toBe(pipes.id);
    expect(service.listCategories().categories.map((category) => category.name)).toEqual([
      "Pipes and fittings",
    ]);
  });

  it("refuses a second category of the same name under one parent with DUPLICATE_NAME", () => {
    const { service } = catalogue();
    service.saveCategory({ name: "Paint" });

    expect(codeOf(() => service.saveCategory({ name: "PAINT" }))).toBe("DUPLICATE_NAME");
  });

  it("refuses a fifth level with TOO_DEEP", () => {
    const { service } = catalogue();
    const levels = ["One", "Two", "Three", "Four"].reduce<string | null>(
      (parentId, name) => service.saveCategory({ name, parentId }).category.id,
      null,
    );

    expect(codeOf(() => service.saveCategory({ name: "Five", parentId: levels }))).toBe("TOO_DEEP");
  });

  it("refuses a parent that does not exist, and a category moved under itself", () => {
    const { service } = catalogue();
    const pipes = service.saveCategory({ name: "Pipes" }).category;
    const pvc = service.saveCategory({ name: "PVC", parentId: pipes.id }).category;

    expect(codeOf(() => service.saveCategory({ name: "Lost", parentId: "no-such" }))).toBe(
      "NOT_FOUND",
    );
    expect(
      codeOf(() => service.saveCategory({ id: pipes.id, name: "Pipes", parentId: pvc.id })),
    ).toBe("INVALID_FIELD");
  });

  it("refuses a default unit the shop does not have", () => {
    const { service } = catalogue();

    expect(codeOf(() => service.saveCategory({ name: "Wire", defaultBaseUom: "furlong" }))).toBe(
      "INVALID_FIELD",
    );
  });
});

describe("CatalogueService: brands (spec 002 T033)", () => {
  it("saves and lists brands in name order, and refuses a repeat ignoring case", () => {
    const { service } = catalogue();
    service.saveBrand({ name: "Supreme" });
    service.saveBrand({ name: "Finolex" });

    expect(service.listBrands().brands.map((brand) => brand.name)).toEqual(["Finolex", "Supreme"]);
    expect(codeOf(() => service.saveBrand({ name: "supreme" }))).toBe("DUPLICATE_NAME");
  });

  it("renames a brand in place", () => {
    const { service } = catalogue();
    const supreme = service.saveBrand({ name: "Supreme" }).brand;

    expect(service.saveBrand({ id: supreme.id, name: "Supreme Industries" }).brand).toEqual({
      id: supreme.id,
      name: "Supreme Industries",
    });
  });
});
