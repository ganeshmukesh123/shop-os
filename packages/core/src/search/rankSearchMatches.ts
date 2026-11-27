import { editDistanceWithin } from "./editDistance";
import { normaliseSearchText } from "./normaliseSearchText";

/** The ways a match can rank, best first (research D4). */
export const SEARCH_TIERS = ["code", "whole_word", "prefix", "fuzzy"] as const;
export type SearchTier = (typeof SEARCH_TIERS)[number];

const CODE_TIER = 0;
const WHOLE_WORD_TIER = 1;
const PREFIX_TIER = 2;
const FUZZY_TIER = 3;

const SHORTEST_FUZZY_WORD = 4;
const LONG_WORD = 8;

/** One variant as the search sees it. */
export interface ISearchEntry {
  variantId: string;
  familyId: string;
  /** How many variants the family has. A family with more than one shows as one row. */
  familyVariantCount: number;
  /** Variant name, family name and search names, as typed. */
  names: string[];
  /** Item code and barcodes: matched whole, never by part. */
  codes: string[];
}

export interface ISearchResult {
  kind: "variant" | "family";
  /** The variant id for a variant row, the family id for a family row. */
  id: string;
  tier: SearchTier;
  billCount90d: number;
}

interface IMatch {
  entry: ISearchEntry;
  tier: number;
  order: number;
  billCount: number;
}

interface IRow {
  kind: "variant" | "family";
  id: string;
  tier: number;
  billCount: number;
  order: number;
}

/** How many typos a query word may have: none under 4 letters, 1 for 4 to 7, 2 for 8 or more. */
function typoLimit(word: string): number {
  const length = Array.from(word).length;
  if (length >= LONG_WORD) return 2;
  return length >= SHORTEST_FUZZY_WORD ? 1 : 0;
}

/** How one query word matches the words of one name, or null if it does not. */
function wordTier(queryWord: string, nameWords: string[]): number | null {
  if (nameWords.includes(queryWord)) return WHOLE_WORD_TIER;
  if (nameWords.some((nameWord) => nameWord.startsWith(queryWord))) return PREFIX_TIER;
  const limit = typoLimit(queryWord);
  const isFuzzy =
    limit > 0 &&
    nameWords.some((nameWord) => editDistanceWithin(queryWord, nameWord, limit) !== null);
  return isFuzzy ? FUZZY_TIER : null;
}

/** A name matches when every query word does; it ranks as its weakest word. */
function nameTier(queryWords: string[], name: string): number | null {
  const nameWords = normaliseSearchText(name).split(" ");
  const tiers = queryWords.map((queryWord) => wordTier(queryWord, nameWords));
  return tiers.includes(null) ? null : Math.max(...(tiers as number[]));
}

function entryTier(entry: ISearchEntry, queryText: string, queryWords: string[]): number | null {
  if (entry.codes.some((code) => normaliseSearchText(code) === queryText)) return CODE_TIER;
  const tiers = entry.names
    .map((name) => nameTier(queryWords, name))
    .filter((tier): tier is number => tier !== null);
  return tiers.length === 0 ? null : Math.min(...tiers);
}

const variantRow = (match: IMatch): IRow => ({
  kind: "variant",
  id: match.entry.variantId,
  tier: match.tier,
  billCount: match.billCount,
  order: match.order,
});

function addToFamilyRow(familyRows: Map<string, IRow>, rows: IRow[], match: IMatch): void {
  const familyRow = familyRows.get(match.entry.familyId);
  if (familyRow) {
    familyRow.tier = Math.min(familyRow.tier, match.tier);
    familyRow.billCount += match.billCount;
    return;
  }
  const newRow: IRow = { ...variantRow(match), kind: "family", id: match.entry.familyId };
  familyRows.set(match.entry.familyId, newRow);
  rows.push(newRow);
}

/**
 * A family with more than one variant is one row, ranked by its best variant and the bills of all
 * its matching variants. The exception is a scanned code: it names one variant, so that variant's
 * row is kept and the family row is left out.
 */
function collapseFamilies(matches: IMatch[]): IRow[] {
  const rows: IRow[] = [];
  const familyRows = new Map<string, IRow>();
  const scannedFamilies = new Set(
    matches
      .filter((match) => match.tier === CODE_TIER && match.entry.familyVariantCount > 1)
      .map((match) => match.entry.familyId),
  );
  for (const match of matches) {
    const { entry } = match;
    const isOneVariantFamily = entry.familyVariantCount <= 1;
    const isScannedFamily = scannedFamilies.has(entry.familyId);
    if (isOneVariantFamily || (isScannedFamily && match.tier === CODE_TIER)) {
      rows.push(variantRow(match));
    } else if (!isScannedFamily) {
      addToFamilyRow(familyRows, rows, match);
    }
  }
  return rows;
}

const byBestTierThenBusiest = (first: IRow, second: IRow): number =>
  first.tier - second.tier || second.billCount - first.billCount || first.order - second.order;

/**
 * Rank the matches for what the cashier typed: exact code, then whole word, then prefix, then fuzzy
 * (research D4). Within a tier, more bills in the last 90 days comes first, then the list order.
 */
export function rankSearchMatches(
  query: string,
  entries: readonly ISearchEntry[],
  billCountByVariantId: ReadonlyMap<string, number>,
): ISearchResult[] {
  const queryText = normaliseSearchText(query);
  if (queryText === "") return [];
  const queryWords = queryText.split(" ");
  const matches = entries.flatMap((entry, order): IMatch[] => {
    const tier = entryTier(entry, queryText, queryWords);
    const billCount = billCountByVariantId.get(entry.variantId) ?? 0;
    return tier === null ? [] : [{ entry, tier, order, billCount }];
  });
  return collapseFamilies(matches)
    .sort(byBestTierThenBusiest)
    .map((row) => ({
      kind: row.kind,
      id: row.id,
      tier: SEARCH_TIERS[row.tier]!,
      billCount90d: row.billCount,
    }));
}
