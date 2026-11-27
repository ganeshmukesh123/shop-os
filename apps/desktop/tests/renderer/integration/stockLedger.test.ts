import {
  createItemDirectly,
  installRealShopos,
  takeInstalledShopos,
} from "../../helpers/realShopos";
import { findLedgerBreaks, readSignedMovements } from "../../helpers/stockLedger";
import { PIPE } from "./billingHarness";

afterEach(() => {
  takeInstalledShopos();
});

describe("the stock ledger check used after every screen test (IT-STK-01)", () => {
  it("finds no break when stock was changed only through movements", async () => {
    const realShopos = installRealShopos();
    await createItemDirectly(realShopos, PIPE);

    expect(findLedgerBreaks(realShopos)).toEqual([]);
  });

  it("reports stock written without a movement: cached 7 against a ledger of 10", async () => {
    const realShopos = installRealShopos();
    const pipeId = await createItemDirectly(realShopos, PIPE);

    realShopos.fixture.testDb.sqlite
      .prepare("update item_variant set stock_milli = 7000 where id = ?")
      .run(pipeId);

    expect(findLedgerBreaks(realShopos)).toEqual([
      { itemId: pipeId, cached: 7_000, derived: 10_000 },
    ]);
  });

  it("gives a movement its sign from the stored direction: stock out is minus", async () => {
    const realShopos = installRealShopos();
    const pipeId = await createItemDirectly(realShopos, PIPE);

    await realShopos.fixture.handlers["stock.adjust"]({
      itemId: pipeId,
      mode: "add",
      quantityMilli: -3_000,
      note: "Broken",
    });

    expect(readSignedMovements(realShopos).map((movement) => movement.signedMilli)).toEqual([
      10_000, -3_000,
    ]);
  });
});
