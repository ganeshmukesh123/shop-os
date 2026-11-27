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

/** A search entry with its names and codes already normalised: what the index keeps (T024). */
export interface IPreparedSearchEntry {
  variantId: string;
  familyId: string;
  familyVariantCount: number;
  /** Each name as its normalised words */
  nameWords: string[][];
  /** Each code normalised, matched whole */
  codes: string[];
}

/** Normalise an entry once, so a search does not normalise every name on every key press. */
export function prepareSearchEntry(entry: ISearchEntry): IPreparedSearchEntry {
  return {
    variantId: entry.variantId,
    familyId: entry.familyId,
    familyVariantCount: entry.familyVariantCount,
    nameWords: entry.names.map((name) => normaliseSearchText(name).split(" ")),
    codes: entry.codes.map(normaliseSearchText),
  };
}

export interface ISearchResult {
  kind: "variant" | "family";
  /** The variant id for a variant row, the family id for a family row. */
  id: string;
  tier: SearchTier;
  billCount90d: number;
}

interface IMatch {
  entry: IPreparedSearchEntry;
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
/** How one query word matches one name word: whole, prefix, within its typo limit, or not. */
function singleWordTier(queryWord: string, nameWord: string): number | null {
  if (nameWord === queryWord) return WHOLE_WORD_TIER;
  if (nameWord.startsWith(queryWord)) return PREFIX_TIER;
  const limit = typoLimit(queryWord);
  const isFuzzy = limit > 0 && editDistanceWithin(queryWord, nameWord, limit) !== null;
  return isFuzzy ? FUZZY_TIER : null;
}

/**
 * The query's words, each with a cache of its verdict per distinct name word. A shop's names
 * repeat the same few thousand words, so each edit distance is computed once per query, not once
 * per name (spec 002 T025: 50,000 variants inside the 0.2 s budget).
 */
interface IQueryWords {
  words: string[];
  verdicts: Map<string, number | null>[];
}

function cachedTier(query: IQueryWords, wordIndex: number, nameWord: string): number | null {
  const verdicts = query.verdicts[wordIndex]!;
  const known = verdicts.get(nameWord);
  if (known !== undefined) return known;
  const verdict = singleWordTier(query.words[wordIndex]!, nameWord);
  verdicts.set(nameWord, verdict);
  return verdict;
}

/** How one query word matches the words of one name (its best name word), or null if it does not. */
function wordTier(query: IQueryWords, wordIndex: number, nameWords: string[]): number | null {
  let best: number | null = null;
  for (const nameWord of nameWords) {
    const tier = cachedTier(query, wordIndex, nameWord);
    best = tier !== null && (best === null || tier < best) ? tier : best;
    if (best === WHOLE_WORD_TIER) return best;
  }
  return best;
}

/** A name matches when every query word does; it ranks as its weakest word. */
function nameTier(query: IQueryWords, nameWords: string[]): number | null {
  let weakest = WHOLE_WORD_TIER;
  for (let wordIndex = 0; wordIndex < query.words.length; wordIndex += 1) {
    const tier = wordTier(query, wordIndex, nameWords);
    if (tier === null) return null;
    weakest = Math.max(weakest, tier);
  }
  return weakest;
}

function entryTier(
  entry: IPreparedSearchEntry,
  queryText: string,
  query: IQueryWords,
): number | null {
  if (entry.codes.includes(queryText)) return CODE_TIER;
  let best: number | null = null;
  for (const nameWords of entry.nameWords) {
    const tier = nameTier(query, nameWords);
    best = tier !== null && (best === null || tier < best) ? tier : best;
  }
  return best;
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
  return rankPreparedMatches(query, entries.map(prepareSearchEntry), billCountByVariantId);
}

/** rankSearchMatches over entries the index has already prepared (prepareSearchEntry). */
export function rankPreparedMatches(
  query: string,
  entries: readonly IPreparedSearchEntry[],
  billCountByVariantId: ReadonlyMap<string, number>,
): ISearchResult[] {
  const queryText = normaliseSearchText(query);
  if (queryText === "") return [];
  const words = queryText.split(" ");
  const queryWords: IQueryWords = { words, verdicts: words.map(() => new Map()) };
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
