import { SearchService } from "../../src/main/services/search";
import { createTestDb, type TestDb } from "../helpers/testDb";

/**
 * Spec 002 T025, open item OI-2 (research D4): the in-memory index against the 0.2 s search budget
 * with 50,000 variants (10,000 families of 5 sizes), each with 2 search names, and 50 queries
 * including typos. It prints the build time and the median and 95th percentile per query; the
 * numbers are recorded in research.md under OI-2. The budget is asserted on the 95th percentile.
 */
const FAMILY_COUNT = 10_000;
const SIZES = ["0.5 in", "0.75 in", "1 in", "1.5 in", "2 in"];
const PRODUCTS = [
  "Pipe",
  "Elbow",
  "Tee",
  "Socket",
  "Valve",
  "Tap",
  "Bend",
  "Union",
  "Coupler",
  "Reducer",
];
const MATERIALS = ["PVC", "CPVC", "GI", "Brass", "UPVC", "HDPE", "Copper", "Steel"];
const BRANDS = ["Supreme", "Finolex", "Astral", "Prince", "Ashirvad", "Jindal", "Tata", "Kisan"];
const ALIASES = ["nali", "paip", "jod", "chabi", "nal", "kohni", "tee jod", "socket jod"];
const SEARCH_BUDGET_MS = 200;

const QUERIES = [
  "pipe",
  "elbow",
  "tee",
  "socket",
  "valve",
  "tap",
  "bend",
  "union",
  "coupler",
  "reducer",
  "pvc pipe",
  "cpvc elbow",
  "gi tee",
  "brass tap",
  "supreme pipe",
  "finolex elbow 1 in",
  "astral socket",
  "prince valve",
  "1 in",
  "2 in",
  "0.5",
  "nali",
  "paip",
  "kohni",
  "jod",
  "elbo",
  "pipr",
  "sokcet",
  "vlave",
  "coupplr",
  "redcer",
  "suprme",
  "finolx",
  "ashirvd",
  "brss",
  "copr",
  "pi",
  "el",
  "so",
  "ITM-00001",
  "ITM-12345",
  "ITM-49999",
  "tata gi pipe",
  "jindal steel bend 1.5 in",
  "kisan upvc union",
  "hdpe",
  "astral cpvc tee 0.75 in",
  "nal",
  "chabi",
  "xyzzy",
];

function seedFiftyThousandVariants(testDb: TestDb): void {
  const { businessId, shopId } = testDb.ctx;
  const { sqlite } = testDb;
  const insertFamily = sqlite.prepare(
    `insert into item_family (id, business_id, shop_id, created_at, updated_at, name, axis_keys)
     values (?, ?, ?, 1, 1, ?, '["size"]')`,
  );
  const insertVariant = sqlite.prepare(
    `insert into item_variant (id, business_id, shop_id, created_at, updated_at, family_id, item_code,
       display_name, base_uom, selling_price_paise, axes, axis_signature)
     values (?, ?, ?, 1, 1, ?, ?, ?, 'pcs', 100, ?, ?)`,
  );
  const insertName = sqlite.prepare(
    `insert into item_search_name (id, business_id, shop_id, created_at, updated_at, variant_id, name, language, kind)
     values (?, ?, ?, 1, 1, ?, ?, 'hinglish', 'alias')`,
  );
  sqlite.transaction(() => {
    Array.from({ length: FAMILY_COUNT }, (_unused, familyIndex) => {
      const familyName = `${BRANDS[familyIndex % 8]} ${MATERIALS[(familyIndex >> 3) % 8]} ${PRODUCTS[(familyIndex >> 6) % 10]} ${familyIndex}`;
      insertFamily.run(`family-${familyIndex}`, businessId, shopId, familyName);
      SIZES.forEach((size, sizeIndex) => {
        const variantNumber = familyIndex * SIZES.length + sizeIndex;
        const variantId = `variant-${variantNumber}`;
        insertVariant.run(
          variantId,
          businessId,
          shopId,
          `family-${familyIndex}`,
          `ITM-${String(variantNumber).padStart(5, "0")}`,
          `${familyName} ${size}`,
          JSON.stringify({ size }),
          `size=${size}`,
        );
        insertName.run(
          `${variantId}-a`,
          businessId,
          shopId,
          variantId,
          `${ALIASES[variantNumber % 8]} ${size}`,
        );
        insertName.run(
          `${variantId}-b`,
          businessId,
          shopId,
          variantId,
          `${ALIASES[(variantNumber + 3) % 8]} ${familyIndex}`,
        );
      });
    });
  })();
}

const percentile = (sortedMs: readonly number[], fraction: number) =>
  sortedMs[Math.min(sortedMs.length - 1, Math.ceil(fraction * sortedMs.length) - 1)]!;

describe("search benchmark: 50,000 variants (spec 002 T025, OI-2)", () => {
  it("answers 50 queries, typos included, with the 95th percentile inside 0.2 s", () => {
    const testDb = createTestDb();
    seedFiftyThousandVariants(testDb);

    const buildStarted = performance.now();
    const search = new SearchService(testDb.db, testDb.ctx);
    const buildMs = performance.now() - buildStarted;
    const queryMs = QUERIES.map((query) => {
      const started = performance.now();
      search.search(query);
      return performance.now() - started;
    }).sort((first, second) => first - second);
    const medianMs = percentile(queryMs, 0.5);
    const p95Ms = percentile(queryMs, 0.95);
    // Written to stderr: Vitest hides console output of a passing test, and these numbers are the point
    process.stderr.write(
      `search benchmark: ${search.size} variants, build ${buildMs.toFixed(0)} ms, ` +
        `median ${medianMs.toFixed(1)} ms, p95 ${p95Ms.toFixed(1)} ms, max ${queryMs.at(-1)!.toFixed(1)} ms\n`,
    );

    expect(search.size).toBe(FAMILY_COUNT * SIZES.length);
    expect(QUERIES).toHaveLength(50);
    expect(p95Ms).toBeLessThan(SEARCH_BUDGET_MS);
  }, 120_000);
});
