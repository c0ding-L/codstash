/**
 * Lowercased, accents dropped, so "Résumé" matches "resume". Only the combining
 * marks NFD splits off go: `\p{Diacritic}` would also strip `^` and backticks.
 */
export function normalizeSearchText(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Where words start: the first character, and any letter or digit after a non-alphanumeric. */
function wordStarts(text: string): number[] {
  const starts: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (/[\p{L}\p{N}]/u.test(text[i]!) && (i === 0 || !/[\p{L}\p{N}]/u.test(text[i - 1]!))) starts.push(i);
  }
  return starts;
}

/** The text's words: its runs of letters and digits. */
function wordsOf(text: string): string[] {
  return text.match(/[\p{L}\p{N}]+/gu) ?? [];
}

/** Whether `token`'s characters appear in order inside `word`, starting with its first. */
function isSubsequenceOfWord(token: string, word: string): boolean {
  if (word[0] !== token[0]) return false;
  let at = 1;
  for (const char of token.slice(1)) {
    at = word.indexOf(char, at);
    if (at === -1) return false;
    at++;
  }
  return true;
}

/**
 * Whether `token` is the starts of several words, in order: "gendoc" in "generate
 * docstrings". Memoised on (offset in the token, next word), so a long title of
 * words sharing a first letter cannot blow up the search.
 */
function isWordStartChain(token: string, words: string[]): boolean {
  const seen = new Map<string, boolean>();

  function chainFrom(offset: number, from: number): boolean {
    if (offset === token.length) return true;
    const key = `${offset}:${from}`;
    const cached = seen.get(key);
    if (cached !== undefined) return cached;

    let found = false;
    for (let i = from; i < words.length && !found; i++) {
      const word = words[i]!;
      for (let length = Math.min(word.length, token.length - offset); length >= 1 && !found; length--) {
        found = word.startsWith(token.slice(offset, offset + length)) && chainFrom(offset + length, i + 1);
      }
    }
    seen.set(key, found);
    return found;
  }

  return chainFrom(0, 0);
}

/**
 * The loose title match: letters in order within one word, or the starts of
 * several words strung together. Letters never jump from the middle of one word
 * into another, which would let "mail" match "Multi-stage Dockerfile".
 */
function isLooseMatch(token: string, text: string): boolean {
  const words = wordsOf(text);
  return words.some((word) => isSubsequenceOfWord(token, word)) || isWordStartChain(token, words);
}

function startsAWord(token: string, text: string): boolean {
  return wordStarts(text).some((start) => text.startsWith(token, start));
}

function tokenScore(token: string, title: string, others: string[]): number {
  if (title.startsWith(token)) return 1;
  if (startsAWord(token, title)) return 0.9;
  if (title.includes(token)) return 0.8;
  if (others.some((field) => startsAWord(token, field))) return 0.6;
  if (others.some((field) => field.includes(token))) return 0.5;
  if (isLooseMatch(token, title)) return 0.3;
  return 0;
}

/**
 * How well a palette entry matches the search, from 0 (hidden) to 1. `title` and
 * `others` must already be through `normalizeSearchText`: an item's whole content
 * can be long, so the caller normalises it once rather than on every keystroke. Every word
 * of the search must match: anywhere in the title, loosely within the title
 * (see `isLooseMatch`), or exactly within one of the other fields.
 * Only the title is matched loosely, because letters scattered across a long
 * preview would match almost anything.
 */
export function searchScore(search: string, title: string, others: string[] = []): number {
  const tokens = normalizeSearchText(search).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 1;

  let total = 0;
  for (const token of tokens) {
    const score = tokenScore(token, title, others);
    if (score === 0) return 0;
    total += score;
  }
  return total / tokens.length;
}
