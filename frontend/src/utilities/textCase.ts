// Membership records come out of the legacy database shouting — names, designations and
// organisations are stored as "MUHAMMED SHAFEEQUE", "STATE", "ICF KERALA". The UI reads better in
// normal case, so we fix the casing on the way to the screen and leave the stored values alone.

/** Words kept uppercase because they are initialisms, not words. */
const ACRONYMS = new Set(["ICF", "UAE", "UK", "USA", "HQ", "IT", "PRO"]);

/** Words kept lowercase inside a phrase, the way a title normally reads. */
const MINOR_WORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "for",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
]);

/** Capitalises across the separators that appear inside a single word: Al-Ameen, O'Brien, Dr. */
function capitaliseParts(word: string): string {
  return word
    .toLowerCase()
    .replace(/(^|[-'’./])([a-z])/g, (_, separator: string, letter: string) =>
      separator + letter.toUpperCase(),
    );
}

/**
 * Renders stored text in normal case: "STATE" becomes "State", "BOARD OF DIRECTORS" becomes
 * "Board of Directors".
 *
 * A word that already contains a lowercase letter is left untouched, so deliberate casing such as
 * "McDonald" survives and only the shouted values are rewritten.
 */
export function toNormalCase(value: string | null | undefined): string {
  if (!value) return "";

  const words = value.trim().split(/\s+/);

  return words
    .map((word, index) => {
      if (/[a-z]/.test(word)) return word;

      const bare = word.replace(/[^A-Za-z]/g, "");
      if (ACRONYMS.has(bare)) return word;

      const normalised = capitaliseParts(word);
      const isEdgeWord = index === 0 || index === words.length - 1;

      if (!isEdgeWord && MINOR_WORDS.has(normalised.toLowerCase())) {
        return normalised.toLowerCase();
      }

      return normalised;
    })
    .join(" ");
}
