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

  it.each([
    ["an offset string, as for TZ=UTC+3", "-03:00"],
    ["no zone at all, as Node 22 to 26 give for TZ=UTC+3", undefined],
  ])("still stamps the backup when the device zone is %s", (_case, deviceZone) => {
    const realOptions = Intl.DateTimeFormat().resolvedOptions();
    const zoneSpy = vi
      .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
      .mockReturnValue({ ...realOptions, timeZone: deviceZone as string });
    const backupTime = new Date(2026, 11, 5, 8, 34, 5);

    try {
      expect(backupStampOf(backupTime)).toBe(handWrittenStamp(backupTime));
    } finally {
      zoneSpy.mockRestore();
    }
  });
});
