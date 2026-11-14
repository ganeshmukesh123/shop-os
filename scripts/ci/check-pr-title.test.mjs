import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ALLOWED_TYPES, MAX_TITLE_LENGTH, validatePrTitle } from "./check-pr-title.mjs";

describe("validatePrTitle", () => {
  it("accepts type(scope): summary for every allowed type", () => {
    ALLOWED_TYPES.forEach((type) => {
      const { isValid } = validatePrTitle(`${type}(001): cancel a bill with a reason`);
      assert.equal(isValid, true, `type ${type} should be accepted`);
    });
  });

  it("accepts numeric and hyphenated scopes", () => {
    assert.equal(validatePrTitle("feat(001): add items").isValid, true);
    assert.equal(validatePrTitle("fix(db): recreate triggers").isValid, true);
    assert.equal(validatePrTitle("docs(design-system): add guideline").isValid, true);
  });
});

describe("validatePrTitle rejections", () => {
  it("rejects an empty or missing title", () => {
    assert.match(validatePrTitle("").reason, /empty/);
    assert.match(validatePrTitle(undefined).reason, /empty/);
  });

  it("rejects a title without type and scope, naming the expected form", () => {
    const { isValid, reason } = validatePrTitle("fixed stuff");
    assert.equal(isValid, false);
    assert.match(reason, /type\(scope\): summary/);
  });

  it("rejects a missing scope", () => {
    assert.equal(validatePrTitle("feat: cancel a bill").isValid, false);
  });

  it("rejects a type that is not allowed and lists the allowed ones", () => {
    const { isValid, reason } = validatePrTitle("wip(001): half done");
    assert.equal(isValid, false);
    assert.match(reason, /"wip" is not allowed/);
    assert.match(reason, /feat, fix, refactor/);
  });

  it("rejects a summary that ends with a full stop", () => {
    assert.match(validatePrTitle("fix(core): round half up.").reason, /full stop/);
  });

  it("rejects a title longer than the limit and accepts one exactly at the limit", () => {
    const prefix = "feat(001): ";
    const atLimit = prefix + "a".repeat(MAX_TITLE_LENGTH - prefix.length);
    assert.equal(validatePrTitle(atLimit).isValid, true);
    assert.match(validatePrTitle(`${atLimit}a`).reason, /73 characters/);
  });

  it("ignores surrounding whitespace", () => {
    assert.equal(validatePrTitle("  feat(001): add items  ").isValid, true);
  });
});
