// Country names as the database stores them -> ISO code, for a flag.
const COUNTRY_CODES: Record<string, string> = {
  oman: "OM",
  uae: "AE",
  "united arab emirates": "AE",
  saudi: "SA",
  "saudi arabia": "SA",
  ksa: "SA",
  qatar: "QA",
  bahrain: "BH",
  kuwait: "KW",
  india: "IN",
};

/** The country's flag emoji (🇴🇲), or null for a name we do not recognise. */
export function flagFor(countryName: string | null | undefined): string | null {
  const code = COUNTRY_CODES[(countryName ?? "").trim().toLowerCase()];
  return code ? String.fromCodePoint(...[...code].map((letter) => 0x1f1a5 + letter.charCodeAt(0))) : null;
}
