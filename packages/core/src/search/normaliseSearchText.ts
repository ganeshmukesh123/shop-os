const LATIN_LETTER_WITH_ACCENTS = /(\p{Script=Latin})[\u0300-\u036f]*/gu;
const COMBINING_ACCENT = /[̀-ͯ]/g;
const NOT_PART_OF_A_WORD = /[^\p{L}\p{N}\p{M}]+/gu;

/**
 * The text a search compares (research D4): Unicode NFC, lower case, accents removed from Latin
 * letters only, and every run of punctuation or spaces turned into one space. Devanagari letters and
 * their vowel signs are kept as typed. Example: "  Café-T/Joint " becomes "cafe t joint".
 */
export function normaliseSearchText(text: string): string {
  return text
    .normalize("NFC")
    .replace(LATIN_LETTER_WITH_ACCENTS, (_letterWithAccents, latinLetter: string) =>
      latinLetter.normalize("NFD").replace(COMBINING_ACCENT, ""),
    )
    .toLowerCase()
    .replace(NOT_PART_OF_A_WORD, " ")
    .trim();
}
