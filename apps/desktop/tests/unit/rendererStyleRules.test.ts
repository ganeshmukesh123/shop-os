import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RENDERER_FOLDER = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../src/renderer",
);

const INLINE_STYLE = /\bstyle=\{/;
const HARD_CODED_COLOUR = /(["'`(\s:])#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;
const PIXEL_FONT_SIZE = /font-size:\s*\d+px/;

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
