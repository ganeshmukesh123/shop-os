import type Database from "better-sqlite3";
import { insertCatalogueRow, insertPipeVariant } from "../helpers/catalogueRows";
import { createTestDb } from "../helpers/testDb";

/**
 * Spec 002 T020, first half (migration 0020): item_merge_log (append-only) and exception_event
 * (open to resolved only). data-model.md "item_merge_log" and "exception_event".
 */
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function insertMergeLog(sqlite: Database.Database, columns: Record<string, unknown> = {}): string {
  return insertCatalogueRow(sqlite, "item_merge_log", {
    action: "merge",
    survivor_id: columns.survivor_id,
    merged_id: columns.merged_id,
    reason: "Same pipe entered twice",
    user_label: "Owner",
    reversible_until: 1 + THIRTY_DAYS_MS,
    ...columns,
  });
}

function twoVariants(sqlite: Database.Database) {
  return { survivor_id: insertPipeVariant(sqlite), merged_id: insertPipeVariant(sqlite) };
}

describe("item_merge_log (spec 002 T020)", () => {
  it("records a merge with empty move lists and a reversal of it", () => {
    const { sqlite } = createTestDb();
    const variants = twoVariants(sqlite);
    const mergeId = insertMergeLog(sqlite, variants);

    expect(() =>
      insertMergeLog(sqlite, {
        ...variants,
        action: "reverse",
        merge_log_id: mergeId,
        reversible_until: null,
        reason: "Merged by mistake",
      }),
    ).not.toThrow();
    expect(
      sqlite
        .prepare(
          "select moved_json, moved_batch_ids, moved_barcode_ids, moved_search_name_ids from item_merge_log where id = ?",
        )
        .get(mergeId),
    ).toEqual({
      moved_json: "[]",
      moved_batch_ids: "[]",
      moved_barcode_ids: "[]",
      moved_search_name_ids: "[]",
    });
  });

  it("refuses an update or a delete of any row", () => {
    const { sqlite } = createTestDb();
    insertMergeLog(sqlite, twoVariants(sqlite));

    expect(() => sqlite.prepare("update item_merge_log set reason = 'x'").run()).toThrow(
      /append-only/,
    );
    expect(() => sqlite.prepare("delete from item_merge_log").run()).toThrow(/append-only/);
  });

  it("refuses a variant merged into itself", () => {
    const { sqlite } = createTestDb();
    const variantId = insertPipeVariant(sqlite);

    expect(() => insertMergeLog(sqlite, { survivor_id: variantId, merged_id: variantId })).toThrow(
      /CHECK/,
    );
  });

  it("reverses a merge once only, and only a merge row", () => {
    const { sqlite } = createTestDb();
    const variants = twoVariants(sqlite);
    const mergeId = insertMergeLog(sqlite, variants);
    const reverse = (mergeLogId: string) => () =>
      insertMergeLog(sqlite, {
        ...variants,
        action: "reverse",
        merge_log_id: mergeLogId,
        reversible_until: null,
      });
    const reversalId = reverse(mergeId)();

    expect(reverse(mergeId)).toThrow(/already reversed/);
    expect(reverse(reversalId)).toThrow(/reverses only a merge/);
  });

  it.each(["same merge", "different merge"])(
    "keeps the original reversal on REPLACE: %s",
    (target) => {
      const { sqlite } = createTestDb();
      sqlite.pragma("recursive_triggers = OFF");
      const variants = twoVariants(sqlite);
      const mergeId = insertMergeLog(sqlite, variants);
      const reversalId = insertMergeLog(sqlite, {
        ...variants,
        action: "reverse",
        merge_log_id: mergeId,
        reversible_until: null,
      });
      const isSameMerge = target === "same merge";
      const targetMergeId = isSameMerge ? mergeId : insertMergeLog(sqlite, variants);
      const replacementId = isSameMerge ? "replacement-reversal" : reversalId;
      const findReversals = sqlite.prepare("select * from item_merge_log where action = 'reverse'");
      const original = findReversals.get();

      expect(() =>
        sqlite
          .prepare(
            `insert or replace into item_merge_log
             (id, business_id, shop_id, created_at, updated_at, action, survivor_id, merged_id, merge_log_id, reason, user_label)
           select ?, business_id, shop_id, created_at, updated_at, action, survivor_id, merged_id, ?, ?, user_label
           from item_merge_log where id = ?`,
          )
          .run(replacementId, targetMergeId, "Changed reason", reversalId),
      ).toThrow(isSameMerge ? /already reversed/ : /append-only/);
      expect(findReversals.all()).toEqual([original]);
    },
  );

  it("needs a reversal window on a merge and a merge to point at on a reversal", () => {
    const { sqlite } = createTestDb();
    const variants = twoVariants(sqlite);

    expect(() => insertMergeLog(sqlite, { ...variants, reversible_until: null })).toThrow(/CHECK/);
    expect(() =>
      insertMergeLog(sqlite, { ...variants, action: "reverse", reversible_until: null }),
    ).toThrow(/CHECK|reverses only a merge/);
  });

  it("refuses an empty or 201-character reason and lists that are not JSON arrays", () => {
    const { sqlite } = createTestDb();
    const variants = twoVariants(sqlite);

    expect(() => insertMergeLog(sqlite, { ...variants, reason: "" })).toThrow(/CHECK/);
    expect(() => insertMergeLog(sqlite, { ...variants, reason: "R".repeat(201) })).toThrow(/CHECK/);
    expect(() => insertMergeLog(sqlite, { ...variants, moved_batch_ids: "{}" })).toThrow(/CHECK/);
  });
});

describe("exception_event (spec 002 T020)", () => {
  function insertException(sqlite: Database.Database, columns: Record<string, unknown> = {}) {
    return insertCatalogueRow(sqlite, "exception_event", {
      kind: "duplicate_barcode",
      subject_type: "item_variant",
      subject_ids: JSON.stringify(["variant-a", "variant-b"]),
      detail: "Two items carry 8901234567890",
      ...columns,
    });
  }

  it("opens an event and lets it be resolved once, with a note", () => {
    const { sqlite } = createTestDb();
    const eventId = insertException(sqlite);

    sqlite
      .prepare(
        "update exception_event set status = 'resolved', resolved_at = 2, resolution_note = 'Kept both' where id = ?",
      )
      .run(eventId);

    expect(sqlite.prepare("select status, resolution_note from exception_event").get()).toEqual({
      status: "resolved",
      resolution_note: "Kept both",
    });
    expect(() =>
      sqlite.prepare("update exception_event set status = 'open', resolved_at = null").run(),
    ).toThrow(/open to resolved/);
  });

  it("changes nothing but the status, the resolution and the update time", () => {
    const { sqlite } = createTestDb();
    insertException(sqlite);

    expect(() => sqlite.prepare("update exception_event set detail = 'edited'").run()).toThrow(
      /open to resolved/,
    );
  });

  it("refuses an unknown kind, an unknown subject type and a resolved event with no time", () => {
    const { sqlite } = createTestDb();

    expect(() => insertException(sqlite, { kind: "late_payment" })).toThrow(/FOREIGN KEY/);
    expect(() => insertException(sqlite, { subject_type: "bill" })).toThrow(/CHECK/);
    expect(() => insertException(sqlite, { status: "resolved" })).toThrow(/CHECK/);
  });
});
