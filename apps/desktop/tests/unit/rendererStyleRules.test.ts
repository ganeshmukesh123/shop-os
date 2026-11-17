import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RENDERER_FOLDER = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../src/renderer",
);

const INLINE_STYLE = /\bstyle\s*=\s*\{/;
const HARD_CODED_COLOUR = /(["'`(\s:])#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;
const PIXEL_FONT_SIZE = /font-size:\s*(?:\d+\.?\d*|\.\d+)px/;

function sourceFilesIn(folder: string): string[] {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(folder, entry.name);
    return entry.isDirectory() ? sourceFilesIn(entryPath) : [entryPath];
  });
}

const RENDERER_FILES = sourceFilesIn(RENDERER_FOLDER).filter((file) => /\.(tsx?|css)$/.test(file));

/** The files that break a rule, as short paths, so a failure says where to look. */
function filesMatching(pattern: RegExp, fileFilter: (file: string) => boolean = () => true) {
  return RENDERER_FILES.filter(fileFilter)
    .filter((file) => pattern.test(fs.readFileSync(file, "utf8")))
    .map((file) => path.relative(RENDERER_FOLDER, file));
}

describe("renderer style rules (design guidelines section 8, constitution X)", () => {
  it("finds the renderer source, so the checks below are not empty", () => {
    expect(RENDERER_FILES.length).toBeGreaterThan(20);
    expect(RENDERER_FILES.some((file) => file.endsWith("app.css"))).toBe(true);
  });

  it("has no inline style anywhere: use Radix props, tokens or a class in app.css", () => {
    expect(filesMatching(INLINE_STYLE, (file) => file.endsWith(".tsx"))).toEqual([]);
  });

  it("has no hex, rgb or hsl colour: colours come from Radix tokens so both themes work", () => {
    expect(filesMatching(HARD_CODED_COLOUR)).toEqual([]);
  });

  it("has no pixel font size: sizes come from Radix size props", () => {
    expect(filesMatching(PIXEL_FONT_SIZE)).toEqual([]);
  });
});

describe("the style rule detectors", () => {
  it.each([
    "<div style={{ color: 1 }} />",
    "<div style = {{ color: 1 }} />",
    "<div style\n={{}} />",
  ])("catch an inline style written as %j", (source) => {
    expect(INLINE_STYLE.test(source)).toBe(true);
  });

  it.each(["font-size: 14px", "font-size: 14.5px", "font-size:.5px", "font-size: 0.5px"])(
    "catch the pixel font size %j",
    (source) => {
      expect(PIXEL_FONT_SIZE.test(source)).toBe(true);
    },
  );

  it.each(["font-size: var(--font-size-2)", "font-size: 1.5rem", "line-height: 14px"])(
    "let %j through",
    (source) => {
      expect(PIXEL_FONT_SIZE.test(source) || INLINE_STYLE.test(source)).toBe(false);
    },
  );
});
