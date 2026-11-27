import { backupStampOf } from "./backupStamp";

const padTwo = (numberValue: number) => String(numberValue).padStart(2, "0");

/** The hand-written stamp this helper replaced, kept here to prove nothing changed. */
function handWrittenStamp(backupTime: Date): string {
  const datePart = `${backupTime.getFullYear()}${padTwo(backupTime.getMonth() + 1)}${padTwo(backupTime.getDate())}`;
  const timePart = `${padTwo(backupTime.getHours())}${padTwo(backupTime.getMinutes())}${padTwo(backupTime.getSeconds())}`;
  return `${datePart}-${timePart}`;
}

describe("backupStampOf", () => {
  it("shows the computer's own date and time, as the old hand-written stamp did", () => {
    const backupTimes = [
      new Date(2026, 11, 5, 8, 34, 5),
      new Date(2027, 2, 31, 23, 59, 59),
      new Date(2027, 0, 1, 0, 0, 0),
      new Date(2026, 5, 9, 12, 0, 0),
    ];

    backupTimes.forEach((backupTime) => {
      expect(backupStampOf(backupTime)).toBe(handWrittenStamp(backupTime));
    });
  });

  it("matches the file-name pattern the backup list reads", () => {
    expect(backupStampOf(new Date(2026, 11, 5, 8, 34, 5))).toMatch(/^\d{8}-\d{6}$/);
  });
});
