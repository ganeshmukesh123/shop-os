import { NumberGapRepository } from "../../src/main/repositories/NumberGapRepository";
import { createTestDb, type TestDb } from "../helpers/testDb";
import { buildHandlersFixture } from "../helpers/handlersFixture";

const TEMPLATE = "{series}/{fy}/{seq}";
// 10:00 UTC on 15 November 2026 and the day after
const FIRST_RESTORE_MS = Date.UTC(2026, 10, 15, 10, 0);
const SECOND_RESTORE_MS = Date.UTC(2026, 10, 16, 10, 0);

let testDb: TestDb;
let gaps: NumberGapRepository;

beforeEach(() => {
  testDb = createTestDb();
  gaps = new NumberGapRepository(testDb.db, testDb.ctx);
});

function recordGap(options: {
  financialYear: string;
  seqFrom: number;
  seqTo: number;
  isEstimated: boolean;
  recordedAtMs: number;
}) {
  const series = gaps.ensureSeries("C1", options.financialYear, TEMPLATE, options.recordedAtMs);
  gaps.recordGap(
    series.id,
    {
      seqFrom: options.seqFrom,
      seqTo: options.seqTo,
      newLastSeq: options.seqTo,
      isEstimated: options.isEstimated,
    },
    options.recordedAtMs,
  );
}

describe("NumberGapRepository.list (FR-013b: Lost in restore)", () => {
  it("is empty when no restore has lost a number", () => {
    expect(gaps.list()).toEqual([]);
  });

  it("writes the first and last lost number in the shop's number format", () => {
    recordGap({
      financialYear: "26-27",
      seqFrom: 121,
      seqTo: 126,
      isEstimated: false,
      recordedAtMs: FIRST_RESTORE_MS,
    });

    expect(gaps.list()).toEqual([
      {
        id: expect.any(String),
        fromNumber: "C1/26-27/000121",
        toNumber: "C1/26-27/000126",
        seqFrom: 121,
        seqTo: 126,
        isEstimated: false,
        recordedAt: "2026-11-15T10:00:00.000Z",
      },
    ]);
  });

  it("tells a confirmed gap from a guessed block of 100", () => {
    recordGap({
      financialYear: "26-27",
      seqFrom: 121,
      seqTo: 220,
      isEstimated: true,
      recordedAtMs: FIRST_RESTORE_MS,
    });

    expect(gaps.list().map((gap) => gap.isEstimated)).toEqual([true]);
  });

  it("lists the newest record first, with each gap in its own financial year", () => {
    recordGap({
      financialYear: "26-27",
      seqFrom: 121,
      seqTo: 126,
      isEstimated: false,
      recordedAtMs: FIRST_RESTORE_MS,
    });
    recordGap({
      financialYear: "27-28",
      seqFrom: 5,
      seqTo: 104,
      isEstimated: true,
      recordedAtMs: SECOND_RESTORE_MS,
    });

    expect(gaps.list().map((gap) => gap.fromNumber)).toEqual([
      "C1/27-28/000005",
      "C1/26-27/000121",
    ]);
  });
});

describe("bills.gaps command", () => {
  it("returns the recorded gaps through the handler", async () => {
    const fixture = buildHandlersFixture();
    const series = new NumberGapRepository(fixture.testDb.db, fixture.testDb.ctx);
    const numberSeriesId = series.ensureSeries("C1", "26-27", TEMPLATE, FIRST_RESTORE_MS).id;
    series.recordGap(
      numberSeriesId,
      { seqFrom: 121, seqTo: 126, newLastSeq: 126, isEstimated: false },
      FIRST_RESTORE_MS,
    );

    const result = await fixture.handlers["bills.gaps"]({});

    expect(result).toMatchObject({
      ok: true,
      data: { gaps: [{ fromNumber: "C1/26-27/000121", toNumber: "C1/26-27/000126" }] },
    });
  });
});
