import { editDistanceWithin } from "./editDistance";
import { normaliseSearchText } from "./normaliseSearchText";

/** What is about to be saved (contracts items.checkDuplicates). */
export interface IDuplicateDraft {
  name: string;
  brandId: string | null;
  categoryId: string | null;
  axisSignature: string;
}

/** An existing variant the repository offered as a possible duplicate. */
export interface IDuplicateCandidate {
  variantId: string;
  displayName: string;
  brandId: string | null;
  categoryId: string | null;
  axisSignature: string;
}

export type DuplicateReason = "same_attributes" | "similar_name";

export interface ILikelyDuplicate {
  variantId: string;
  displayName: string;
  reason: DuplicateReason;
}

const MAX_NAME_DISTANCE = 2;
const MIN_TRIGRAM_SHARE = 0.6;

/** The name's words in sorted order, so "Supreme PVC Pipe" and "PVC Pipe Supreme" read the same. */
const sortedWords = (name: string) => normaliseSearchText(name).split(" ").sort().join(" ");

function trigramsOf(text: string): Set<string> {
  const characters = Array.from(text);
  return new Set(
    characters
      .slice(0, Math.max(characters.length - 2, 0))
      .map((_unused, start) => characters.slice(start, start + 3).join("")),
  );
}

/** Shared trigrams over all distinct trigrams of both (Jaccard), of the names' sorted words. */
export function trigramSimilarity(firstName: string, secondName: string): number {
  const first = trigramsOf(sortedWords(firstName));
  const second = trigramsOf(sortedWords(secondName));
  const shared = [...first].filter((trigram) => second.has(trigram)).length;
  const union = new Set([...first, ...second]).size;
  return union === 0 ? 0 : shared / union;
}

/** Rule (a): a brand is set, and brand, category and every attribute value are the same. */
const hasSameAttributes = (draft: IDuplicateDraft, candidate: IDuplicateCandidate) =>
  draft.brandId !== null &&
  draft.brandId === candidate.brandId &&
  draft.categoryId === candidate.categoryId &&
  draft.axisSignature === candidate.axisSignature;

/** Rule (b): within 2 typing mistakes, or at least 60% of the trigrams shared. */
const hasSimilarName = (draft: IDuplicateDraft, candidate: IDuplicateCandidate) =>
  editDistanceWithin(
    normaliseSearchText(draft.name),
    normaliseSearchText(candidate.displayName),
    MAX_NAME_DISTANCE,
  ) !== null || trigramSimilarity(draft.name, candidate.displayName) >= MIN_TRIGRAM_SHARE;

/**
 * Existing variants that look like the draft (research D5, FR-008), each once with its stronger
 * reason. The screen shows them before saving; the owner may still save.
 */
export function findLikelyDuplicates(
  draft: IDuplicateDraft,
  candidates: readonly IDuplicateCandidate[],
): ILikelyDuplicate[] {
  return candidates.flatMap((candidate): ILikelyDuplicate[] => {
    const reason = reasonFor(draft, candidate);
    return reason
      ? [{ variantId: candidate.variantId, displayName: candidate.displayName, reason }]
      : [];
  });
}

function reasonFor(draft: IDuplicateDraft, candidate: IDuplicateCandidate): DuplicateReason | null {
  if (hasSameAttributes(draft, candidate)) return "same_attributes";
  return hasSimilarName(draft, candidate) ? "similar_name" : null;
}
