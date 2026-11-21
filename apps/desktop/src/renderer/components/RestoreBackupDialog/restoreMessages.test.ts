import { restoreExampleNumber, restoreStartedMessage } from "./restoreMessages";

describe("restoreExampleNumber (task T084, research D21)", () => {
  const profile = {
    seriesCode: "C1",
    numberTemplate: "{series}/{fy}/{seq}",
    timeZone: "Asia/Kolkata",
  };

  it("shows a number in the shop's own format and series", () => {
    const now = new Date(Date.UTC(2026, 10, 21, 10, 0));

    expect(restoreExampleNumber(profile, now)).toBe("C1/26-27/000126");
  });

  it("uses the financial year of the shop's zone, so 00:10 IST on 1 April is 27-28", () => {
    const justAfterMidnightInIndia = new Date(Date.UTC(2027, 2, 31, 18, 40));

    expect(restoreExampleNumber(profile, justAfterMidnightInIndia)).toBe("C1/27-28/000126");
  });

  it("follows a different number format", () => {
    const now = new Date(Date.UTC(2026, 10, 21, 10, 0));

    expect(restoreExampleNumber({ ...profile, numberTemplate: "{series}-{seq}" }, now)).toBe(
      "C1-000126",
    );
  });

  it("still gives an example while an unfinished time zone is typed", () => {
    const now = new Date(Date.UTC(2026, 10, 21, 10, 0));

    expect(restoreExampleNumber({ ...profile, timeZone: "Mars/Olympus" }, now)).toBe(
      "C1/26-27/000126",
    );
  });
});

describe("restoreStartedMessage (task T084)", () => {
  it("names the next bill when no number was lost", () => {
    expect(restoreStartedMessage({ restored: true, nextBillNo: "C1/26-27/000121" })).toBe(
      "Restoring… the app will restart. The next bill will be C1/26-27/000121.",
    );
  });

  it("names the lost numbers when the owner confirmed the last bill", () => {
    const message = restoreStartedMessage({
      restored: true,
      nextBillNo: "C1/26-27/000127",
      gapRecorded: { seqFrom: 121, seqTo: 126, isEstimated: false },
    });

    expect(message).toBe(
      "Restoring… the app will restart. The next bill will be C1/26-27/000127. Bill numbers 121 to 126 are recorded as lost in the restore.",
    );
  });

  it("says when the block of 100 was a guess", () => {
    const message = restoreStartedMessage({
      restored: true,
      nextBillNo: "C1/26-27/000221",
      gapRecorded: { seqFrom: 121, seqTo: 220, isEstimated: true },
    });

    expect(message).toContain("Bill numbers 121 to 220 are recorded as lost in the restore.");
    expect(message).toContain("That is a block of 100, because the last number was not entered.");
  });
});
