import { fillText } from "./fillText";

describe("fillText", () => {
  it("puts each named value in its place, in any order", () => {
    expect(fillText("{name} saved", { name: "Pipe 20mm" })).toBe("Pipe 20mm saved");
    expect(
      fillText("{quantity} {unit} of {name}", { name: "Pipe", unit: "pcs", quantity: 10 }),
    ).toBe("10 pcs of Pipe");
  });

  it("leaves a placeholder visible when its value is missing, so the gap is seen, not hidden", () => {
    expect(fillText("{count} lines", {})).toBe("{count} lines");
  });

  it("never fills a placeholder from a built-in object name such as toString", () => {
    expect(fillText("{toString}", {})).toBe("{toString}");
  });
});
