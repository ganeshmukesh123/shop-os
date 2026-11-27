import { formatDeviceDateTime } from "./formatDeviceDateTime";

describe("formatDeviceDateTime", () => {
  it("shows the same text the browser's own toLocaleString gave before", () => {
    const storedTimes = [
      "2026-11-15T09:30:00.000Z",
      "2027-03-31T18:20:00.000Z",
      "2027-01-01T00:00:00.000Z",
      "2026-06-09T12:00:05.000Z",
    ];

    storedTimes.forEach((storedTime) => {
      expect(formatDeviceDateTime(storedTime)).toBe(new Date(storedTime).toLocaleString());
    });
  });

  it("includes the seconds", () => {
    expect(formatDeviceDateTime("2026-11-15T09:30:07.000Z")).toMatch(/07/);
  });
});
