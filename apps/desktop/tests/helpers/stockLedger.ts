import { cleanup } from "@testing-library/react";
import { checkInvariant, signedQuantityMilli, type InvariantBreak } from "@shopos/core";
import { takeInstalledShopos, type IRealShopos } from "./realShopos";

/** One stock movement as the ledger means it: plus for stock in, minus for stock out. */
export interface ISignedMovement {
  itemName: string;
  movementType: string;
  signedMilli: number;
  note: string | null;
}

interface IStoredMovementRow {
  itemId: string;
  itemName: string;
  movementType: string;
  qtyBaseMilli: number;
  fromLocationId: string | null;
  toLocationId: string | null;
  note: string | null;
}

function readStoredMovements(realShopos: IRealShopos): IStoredMovementRow[] {
  return realShopos.fixture.testDb.sqlite
    .prepare(
      `select movement.variant_id as itemId, variant.display_name as itemName,
              movement.movement_type as movementType, movement.qty_base_milli as qtyBaseMilli,
              movement.from_location_id as fromLocationId, movement.to_location_id as toLocationId,
              movement.note as note
         from stock_movement as movement
         join item_variant as variant on variant.id = movement.variant_id
        order by movement.occurred_at, movement.rowid`,
    )
    .all() as IStoredMovementRow[];
}

/** Every movement in the order written, with its direction turned into a sign by the core rule. */
export function readSignedMovements(realShopos: IRealShopos): ISignedMovement[] {
  return readStoredMovements(realShopos).map((storedRow) => ({
    itemName: storedRow.itemName,
    movementType: storedRow.movementType,
    signedMilli: signedQuantityMilli(storedRow),
    note: storedRow.note,
  }));
}

/** Items whose cached stock differs from the sum of their movements (constitution: stock is the sum). */
export function findLedgerBreaks(realShopos: IRealShopos): InvariantBreak[] {
  const cachedRows = realShopos.fixture.testDb.sqlite
    .prepare("select id as itemId, stock_milli as stockMilli from item_variant")
    .all() as { itemId: string; stockMilli: number }[];
  const cachedStock = new Map(
    cachedRows.map((cachedRow) => [cachedRow.itemId, cachedRow.stockMilli]),
  );
  const signedMovements = readStoredMovements(realShopos).map((storedRow) => ({
    itemId: storedRow.itemId,
    quantityMilli: signedQuantityMilli(storedRow),
  }));
  return checkInvariant(cachedStock, signedMovements);
}

/** IT-STK-01: after every test in the file, cached stock must equal the ledger for every item. */
export function checkLedgerAfterEachTest(): void {
  afterEach(() => {
    const installedShopos = takeInstalledShopos();
    const ledgerBreaks = installedShopos ? findLedgerBreaks(installedShopos) : [];
    // A failing check stops the later hooks, so unmount and restore real time first: one broken
    // ledger must fail one test, not leave its screen behind for the next test to trip over.
    cleanup();
    vi.useRealTimers();
    expect(ledgerBreaks).toEqual([]);
  });
}
