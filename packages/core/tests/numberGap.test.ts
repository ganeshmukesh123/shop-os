import { CoreError } from "../src/errors";
import { DEFAULT_NUMBER_TEMPLATE } from "../src/numbering";
import { UNCONFIRMED_GAP_SIZE, parseBillNumber, planNumberGap } from "../src/numberGap";

function errorCodeOf(action: () => unknown): string | undefined {
  try {
    action();
  } catch (error) {
    return error instanceof CoreError ? error.code : "NOT_A_CORE_ERROR";
  }
  return undefined;
}

describe("parseBillNumber (task T083, FR-013b, research D21)", () => {
  it("reads the series, financial year and sequence of the default format", () => {
    expect(parseBillNumber(DEFAULT_NUMBER_TEMPLATE, "C1/26-27/000126")).toEqual({
      seriesCode: "C1",
      financialYear: "26-27",
      seq: 126,
    });
  });

  it("reads a template that has no financial year or no series", () => {
    expect(parseBillNumber("{series}-{seq}", "B2-000007")).toEqual({
      seriesCode: "B2",
      financialYear: null,
      seq: 7,
    });
    expect(parseBillNumber("{seq}", "000042")).toEqual({
      seriesCode: null,
      financialYear: null,
      seq: 42,
    });
  });

  it("ignores spaces around what the owner typed", () => {
    expect(parseBillNumber(DEFAULT_NUMBER_TEMPLATE, "  C1/26-27/000126 \n")?.seq).toBe(126);
  });

  it("gives null for text that does not follow the template", () => {
    expect(parseBillNumber(DEFAULT_NUMBER_TEMPLATE, "126")).toBeNull();
    expect(parseBillNumber(DEFAULT_NUMBER_TEMPLATE, "C1/26-27/126")).toBeNull();
    expect(parseBillNumber(DEFAULT_NUMBER_TEMPLATE, "C1/2627/000126")).toBeNull();
    expect(parseBillNumber(DEFAULT_NUMBER_TEMPLATE, "")).toBeNull();
    expect(parseBillNumber(DEFAULT_NUMBER_TEMPLATE, "C1/26-27/000126/extra")).toBeNull();
  });

  it("gives null for sequence 0, which no bill ever had", () => {
    expect(parseBillNumber(DEFAULT_NUMBER_TEMPLATE, "C1/26-27/000000")).toBeNull();
  });

  it("treats the template's own characters literally, not as patterns", () => {
    expect(parseBillNumber("{series}.{seq}", "C1.000005")?.seq).toBe(5);
    expect(parseBillNumber("{series}.{seq}", "C1x000005")).toBeNull();
    expect(parseBillNumber("({series}){seq}", "(C1)000005")?.seq).toBe(5);
  });
});

describe("planNumberGap (task T083, FR-013b, research D21)", () => {
  it("records 121 to 126 when the backup ended at 120 and the owner confirms 126", () => {
    expect(planNumberGap(120, 126)).toEqual({
      seqFrom: 121,
      seqTo: 126,
      newLastSeq: 126,
      isEstimated: false,
    });
  });

  it("jumps ahead by a block of 100 when the owner cannot say, and marks it as a guess", () => {
    expect(UNCONFIRMED_GAP_SIZE).toBe(100);
    expect(planNumberGap(120, null)).toEqual({
      seqFrom: 121,
      seqTo: 220,
      newLastSeq: 220,
      isEstimated: true,
    });
  });

  it("records a gap of one when a single bill was lost", () => {
    expect(planNumberGap(120, 121)).toEqual({
      seqFrom: 121,
      seqTo: 121,
      newLastSeq: 121,
      isEstimated: false,
    });
  });

  it("needs no gap when the backup already has the last bill the owner confirms", () => {
    expect(planNumberGap(120, 120)).toBeNull();
  });

  it("starts a series that the backup has not got yet at 1", () => {
    expect(planNumberGap(0, 5)).toEqual({
      seqFrom: 1,
      seqTo: 5,
      newLastSeq: 5,
      isEstimated: false,
    });
    expect(planNumberGap(0, null)).toEqual({
      seqFrom: 1,
      seqTo: 100,
      newLastSeq: 100,
      isEstimated: true,
    });
  });

  it("refuses a confirmed number older than the backup's own last number", () => {
    expect(errorCodeOf(() => planNumberGap(120, 119))).toBe("INVALID_FIELD");
  });

  it("refuses a number below 1, a fraction, and a negative last number", () => {
    expect(errorCodeOf(() => planNumberGap(120, 0))).toBe("INVALID_FIELD");
    expect(errorCodeOf(() => planNumberGap(120, 130.5))).toBe("INVALID_FIELD");
    expect(errorCodeOf(() => planNumberGap(-1, 5))).toBe("INVALID_FIELD");
  });

  it("refuses a gap that would run past the 6-digit sequence", () => {
    expect(errorCodeOf(() => planNumberGap(120, 1_000_000))).toBe("INVALID_FIELD");
    expect(errorCodeOf(() => planNumberGap(999_950, null))).toBe("INVALID_FIELD");
    expect(planNumberGap(999_800, null)?.seqTo).toBe(999_900);
  });

  it("never plans over a number the backup already issued", () => {
    const plan = planNumberGap(120, 130)!;

    expect(plan.seqFrom).toBeGreaterThan(120);
  });
});
