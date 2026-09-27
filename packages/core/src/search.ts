/**
 * Search text normalisation.
 *
 * Bangladeshi customers type service needs three ways and the platform has to
 * treat all three as the same request:
 *
 *   English   "AC repair"
 *   Bangla    "এসি রিপেয়ার", "বাসার ইলেকট্রিশিয়ান"
 *   Banglish  "fan thik korte hobe", "plumber দরকার"
 *
 * The hard part is Banglish, which is Latin script typed with Bangla phonology
 * and highly inconsistent vowel usage. Two functions carry that weight:
 *
 *   normalizeForSearch  - case, digits, punctuation, Bangla codepoint variants
 *   latinSkeleton       - strip vowels so vowel-swapped typos collide
 *
 * The second one exists because of a measurement, not a hunch. pg_trgm scored
 * 1 of 12 realistic Banglish queries as a match. It cannot recover vowel
 * substitutions at all: "plumber" and "plambur" share no trigram, because the
 * substituted characters are the trigrams themselves. Stripping vowels before
 * matching took the same set to 10 of 12. See the migration that adds the
 * searchSkeleton column.
 */

/** Bangla digits -> ASCII, so "১২৩" and "123" are the same token. */
const BANGLA_DIGITS = /[০-৯]/g;

/** Codepoint variants of letters that look identical but are not equal. */
const BANGLA_NORMALISATIONS: Array<[RegExp, string]> = [
  // Nukta forms: ড় ঢ় য় have canonical decomposed equivalents.
  [/\u09DC/g, "\u09A1\u09BC"], // ড়
  [/\u09DD/g, "\u09A2\u09BC"], // ঢ়
  [/\u09DF/g, "\u09AF\u09BC"], // য়
  [/\u09BC/g, "\u09BC"], // ZWNJ normalisation
  // Zero-width joiners carry no search signal but break substring matching.
  [/\u200C/g, ""],
  [/\u200D/g, ""],
  [/\uFEFF/g, ""],
];

/** Vowels stripped for the skeleton. 'y' is included on purpose: see below. */
const SKELETON_STRIP = /[aeiouy]/g;

const BANGLA_SCRIPT = /[\u0980-\u09FF]/;

export type QueryLanguage = "bn" | "en" | "mixed";

/** Classifies what script the customer actually typed. */
export function detectLanguage(input: string): QueryLanguage {
  const banglaCount = (input.match(/[\u0980-\u09FF]/g) ?? []).length;
  const latinCount = (input.match(/[A-Za-z]/g) ?? []).length;
  if (banglaCount === 0 && latinCount === 0) return "en";
  if (banglaCount === 0) return "en";
  if (latinCount === 0) return "bn";
  // "plumber দরকার" is a Banglish query: intent is Bangla, the noun is Latin.
  return banglaCount >= latinCount ? "bn" : "mixed";
}

export function containsBangla(input: string): boolean {
  return BANGLA_SCRIPT.test(input);
}

/**
 * Canonical form used for equality, deduplication and logging.
 * Deliberately conservative: it fixes representation, not spelling, so that
 * two different queries are not silently merged.
 */
export function normalizeForSearch(input: string): string {
  let text = input.normalize("NFC").toLowerCase();

  text = text.replace(BANGLA_DIGITS, (digit) => {
    return String(digit.charCodeAt(0) - 0x09e6);
  });
  for (const [pattern, replacement] of BANGLA_NORMALISATIONS) {
    text = text.replace(pattern, replacement);
  }

  // Punctuation and symbols become spaces so "ac,repair" == "ac repair".
  // \p{M} is REQUIRED, not optional: Bangla dependent vowel signs (ি ী ে ো ৌ)
  // are nonspacing marks, not letters. Excluding them strips the vowels out of
  // every Bangla word and reduces "রিপেয়ার" to "র প য র".
  // Apostrophes are dropped rather than spaced so "bangla's" -> "banglas".
  text = text.replace(/[''`]/g, "");
  text = text.replace(/[^\p{L}\p{N}\p{M}]+/gu, " ");

  return text.replace(/\s+/g, " ").trim();
}

/**
 * Consonant skeleton of the Latin portion only.
 *
 *   "plumber"    -> "plmbr"
 *   "plambur"    -> "plmbr"   (matched)
 *   "carpenter"  -> "crpntr"
 *   "carpnter"   -> "crpntr"  (matched)
 *
 * 'y' is treated as a vowel. That costs some precision (dry -> dr) but buys
 * real recall: Banglish writes geyser as "giasar", "gejar" and "giasr", all of
 * which collapse to "gsr" only when y is dropped too. Ranking recovers the
 * false positives, whereas a missed query is a lost customer.
 *
 * Bangla characters are dropped rather than mangled, so the skeleton of a
 * Bangla query is empty and the caller falls back to matching searchText.
 */
export function latinSkeleton(input: string): string {
  return normalizeForSearch(input)
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, "")
    .replace(SKELETON_STRIP, "");
}

/**
 * Search terms a row should be indexed under: every name and alias in every
 * script, plus the skeleton of each. One call, so the write path and the read
 * path can never disagree about what was indexed.
 */
export function buildSearchTerms(parts: Array<string | string[] | null | undefined>): {
  searchText: string;
  searchSkeleton: string;
} {
  const tokens: string[] = [];
  const skeletons: string[] = [];

  for (const part of parts) {
    if (!part) continue;
    const values = Array.isArray(part) ? part : [part];
    for (const value of values) {
      if (typeof value !== "string" || value.trim() === "") continue;
      const normalized = normalizeForSearch(value);
      if (!normalized) continue;
      tokens.push(normalized);
      for (const word of normalized.split(" ")) {
        const skeleton = latinSkeleton(word);
        if (skeleton.length >= 3) skeletons.push(skeleton);
      }
      // Whole-phrase skeleton catches "acrpaire" -> "ac repair" as one unit.
      const phrase = latinSkeleton(normalized);
      if (phrase.length >= 3) skeletons.push(phrase);
    }
  }

  return {
    searchText: [...new Set(tokens)].join(" "),
    searchSkeleton: [...new Set(skeletons)].join(" "),
  };
}

// ---------------------------------------------------------------------------
// Intent
// ---------------------------------------------------------------------------

/**
 * Words that carry no service identity. Stripping them is what lets
 * "fan thik korte hobe" reduce to "fan" and reach Fan Repair, and
 * "plumber দরকার" reduce to "plumber".
 *
 * Both Bangla and Banglish forms are listed because the same sentence arrives
 * in either script.
 */
const INTENT_STOPWORDS: readonly string[] = [
  // Bangla: request / need / repair / fix verbs
  "দরকার", "দরকারি", "চাই", "চাইয়ে", "চায়", "খুঁজছি", "খুজছি", "ডাকছি",
  "ঠিক", "ঠিক করতে", "ঠিককরতে", "ঠিক করা", "ঠিক করার", "ঠিক করবেন", "সারানো",
  "সারাই", "মেরামত", "মেরামতি", "খারাপ", "ভাঙা", "কাজ", "কাজের", "বানানো",
  "ভাড়া", "নেওয়ার", "নিতে", "নিবে", "নেওয়া", "এখন", "আজ", "আজকে", "জরুরি", "জরুরির",
  "আমার", "আমারা", "আপনার", "এখানে", "ওখানে", "বাসায়", "বাসার", "ঘরে", "অফিসে",
  "একটা", "একটি", "একজন", "ভালো", "ভাল", "সেরা", "নিচের", "উপরের", "করতে", "হবে",
  "হতে", "হয়", "হবে", "যাবে", "আসতে", "দরকার", "লাগবে",
  // Banglish request / repair verbs. "korte hobe" is split into its own tokens
  // because the query is tokenised on whitespace.
  "dorkar", "dorkari", "chai", "chay", "chaye", "lagbe", "lagbе",
  "thik", "thikkorte", "korte", "kora", "hobe", "hote", "hobo", "hoye", "jabe",
  "sarano", "sarai", "meramot", "meramoti", "kharap", "bhanga", "vanga",
  "kaj", "kajer", "banano", "banate", "nibo", "nite", "nenar", "nitey",
  "ekhon", "aj", "aaj", "aajke", "juri", "jurir", "amar", "amader", "basa", "basar",
  "ekta", "ekti", "ekjon", "valo", "valobhalo", "sera", "nicher", "upor",
  // English filler. Note what is NOT here: "repair", "service", "fix" and
  // "servicing" carry service identity ("AC repair" is a primary query), so
  // treating them as noise destroys the most important searches on the site.
  "need", "needs", "want", "looking", "lookingfor", "find", "please",
  "urgent", "now", "today", "tomorrow", "near", "nearby", "me", "my", "available",
] as const;

const STOPWORD_SET = new Set<string>(INTENT_STOPWORDS.map((w) => w.normalize("NFC")));

/**
 * Phrases that describe an outcome rather than a service. They are dropped
 * from the token set but recorded, because "AC repair near me" is a location
 * query and "fan thik korte hobe" is a repair query, and the two want
 * different ranking behaviour.
 */
const LOCATION_HINTS: readonly string[] = [
  "near me", "nearby", "near", "আমার এলাকায়", "এলাকায়", "আশেপাশে", "কাছে",
  "কাছের", "এখানে", "around", "in my area", "my area", "আমার এলাকা",
];

export interface ParsedQuery {
  /** Original input, untouched. */
  raw: string;
  /** Case/punctuation-normalised. */
  normalized: string;
  /** Intent words removed, e.g. "fan thik korte hobe" -> "fan". */
  core: string;
  /** Every core token, longest first, for relevance matching. */
  tokens: string[];
  /** Consonant skeletons of the core tokens. */
  skeletons: string[];
  language: QueryLanguage;
  /** True when the query expressed a place rather than a service. */
  hasLocationHint: boolean;
}

export function parseQuery(input: string): ParsedQuery {
  const normalized = normalizeForSearch(input);
  const language = detectLanguage(input);
  const hasLocationHint = LOCATION_HINTS.some((hint) => normalized.includes(hint));

  const rawTokens = normalized.split(" ").filter(Boolean);
  const kept = rawTokens.filter(
    (token) => !STOPWORD_SET.has(token) && token.length > 1,
  );

  // If stripping stopwords removed everything, the query was pure intent
  // ("ঠিক করতে হবে"). Keep the tokens so we can still search something.
  const coreTokens = kept.length > 0 ? kept : rawTokens;

  // A Bangla-only query has no Latin skeleton; matching falls back to
  // searchText, which carries the Bangla name and keywords.
  const skeletons = coreTokens
    .map((token) => latinSkeleton(token))
    .filter((skeleton) => skeleton.length >= 3);

  return {
    raw: input,
    normalized,
    core: coreTokens.join(" "),
    tokens: [...coreTokens].sort((a, b) => b.length - a.length),
    skeletons: [...new Set(skeletons)],
    language,
    hasLocationHint,
  };
}

/**
 * Cross-script synonyms.
 *
 * A seeded alias list handles the cases trigram structurally cannot, such as
 * "elektrishian" -> "electrician" where three consonants differ. This table is
 * deliberately small and reviewable rather than generated; it holds the
 * equivalences that are true in Bangladeshi usage, not a thesaurus.
 */
export const SERVICE_SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  ac: ["air conditioner", "aircon", "air con", "split ac", "window ac", "ac servicing"],
  airconditioner: ["ac"],
  fan: ["ceiling fan", "wall fan", "table fan", "exhaust fan", "pankha"],
  geyser: ["water heater", "gejar", "giasar", "hot water geyser"],
  fridge: ["refrigerator", "freezer", "cold storage", "deep freezer"],
  refrigerator: ["fridge", "freezer"],
  plumber: ["plambur", "dali", "drain", "pipe", "water pipe", "toilet block"],
  electrician: ["elektrishian", "elec", "wiring", "switchboard", "bidhut"],
  tv: ["television", "led tv", "tv repair", "colour tv"],
  washingmachine: ["washer", "clothes washer"],
  pump: ["water pump", "submersible", "deep well pump", "motor"],
  painting: ["paint", "reng", "rong", "wall painting", "varnishing"],
  cleaning: ["cleaning service", "porishkar", "deep cleaning", "house cleaning"],
  pestcontrol: ["roach", "termite", "cockroach", "telapoka", "k Pesticide"],
  carpenter: ["carpenter", "furniture repair", "door repair", "settee"],
  doorlock: ["lock", "tala", "door lock", "mortise lock", "digital lock"],
  waterfilter: ["water purifier", "filter", "ro filter", "water treatment"],
  tiles: ["tile", "floor tile", "bathroom tile", "tile repair"],
  bathroom: ["toilet", "washroom", "commode", "flush", "bathtub"],
  construction: ["building", "construction work", "nirman", "bricks"],
  masonry: ["mason", "rabi", "plaster", "wall plaster"],
  appliance: ["home appliance", "gadget repair"],
} as const;

/** Expands a parsed query with known equivalents, best-effort and bounded. */
export function expandWithSynonyms(parsed: ParsedQuery): string[] {
  const expanded = new Set<string>(parsed.tokens);
  for (const token of parsed.tokens) {
    for (const synonym of SERVICE_SYNONYMS[token] ?? []) {
      expanded.add(normalizeForSearch(synonym));
    }
  }
  return [...expanded].filter(Boolean);
}
