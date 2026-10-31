// ============================================================
// Name filter — what another singer will read
// ============================================================
//
// One check for every name a singer writes that others see: the display
// name, a profile's bio, a share's title and tags and, for the worst slurs
// only, a melody's lyrics. A text is read as the words a reader sees: case,
// width, accents, look-alike letters (Cyrillic, Greek, small capitals,
// Cherokee, enclosed letters), digits and symbols for letters ("5h1t"),
// stretched letters ("fuuuuck") and separators ("f.u.c.k") do not hide a
// word. Each word is then matched on its own against name-filter-words.ts.
// Nothing is read across two words, because "Push It", "Rabbit Chase" and
// "Who Really Cares" are not what they would spell run together; only the
// list's phrases are read as words in a row.
//
// Linear in the length of the text, a melody's lyrics included: a letter
// repeated more than three times reads as three, so no pattern backtracks
// along a long run, and no word on the list repeats a letter more than that.
//
// Pure, with no worker types, so the app can ask it before it posts, as it
// imports validation.ts.

import type { WordTier } from './name-filter-words'
import { EVERYWHERE, INNOCENT_PHRASES, INNOCENT_WORDS, NAMES, } from './name-filter-words'

/** The longest display name, as the app's name field caps it. */
export const DISPLAY_NAME_MAX = 40

export type NameProblem = 'empty' | 'too-long' | 'unreadable' | 'words'

export interface NameRules {
  /** The longest the text may be, in UTF-16 units, as a text field counts. */
  max: number
  /** The text may be left empty (a bio, a tag list). */
  optional?: boolean
  /** The text may run over several lines (a bio). */
  multiline?: boolean
}

// ── Reading a text as words ──────────────────────────────────────────

// Each character in a group's first string reads as the letter at the same
// place in its second. A text is lowercased first, so only small letters are
// listed, and written as escapes: a look-alike looks like its letter, which
// is the whole trouble with it.
const LOOK_ALIKE_GROUPS: readonly (readonly [string, string])[] = [
  // Cyrillic
  ['авекмнорстухьіјѕԁһӏԝ', 'abekmhopctyxbijsdhiw'],
  // Greek
  ['αβγεζηικμνορτυχω', 'abyeznikuvoptuxw'],
  // Latin letters with a stroke or a hook, which have no accent to strip
  ['ıłøđðħŧƒɨʂɑɡɩʋɛǝɵʉƙɗɓƭʈȿŋȷ', 'iloddhtfisagiueeoukdbttsnj'],
  // Small capitals (there is no small capital x)
  ['ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘꞯʀꜱᴛᴜᴠᴡʏᴢ', 'abcdefghijklmnopqrstuvwyz'],
]

// Cherokee capitals that read as Latin letters. A text is lowercased first,
// so each is kept by its small letter as well.
const CHEROKEE: readonly (readonly [number, string])[] = [
  [0x13a0, 'd'],
  [0x13a1, 'r'],
  [0x13a2, 't'],
  [0x13a5, 'i'],
  [0x13a9, 'y'],
  [0x13aa, 'a'],
  [0x13ab, 'j'],
  [0x13ac, 'e'],
  [0x13b3, 'w'],
  [0x13b7, 'm'],
  [0x13bb, 'h'],
  [0x13bd, 'y'],
  [0x13c0, 'g'],
  [0x13c2, 'h'],
  [0x13c3, 'z'],
  [0x13cf, 'b'],
  [0x13d2, 'r'],
  [0x13d4, 'w'],
  [0x13d5, 's'],
  [0x13d9, 'v'],
  [0x13da, 's'],
  [0x13de, 'l'],
  [0x13df, 'c'],
  [0x13e2, 'p'],
  [0x13e6, 'k'],
  [0x13f4, 'b'],
]

// Enclosed letters NFKC leaves as symbols: squared, negative circled,
// negative squared, and the regional indicators flags are spelled with.
const ENCLOSED_A: readonly number[] = [0x1f130, 0x1f150, 0x1f170, 0x1f1e6]

function buildLookAlike(): ReadonlyMap<string, string> {
  const map = new Map<string, string>([
    ['ß', 'ss'],
    ['æ', 'ae'],
    ['œ', 'oe'],
  ])
  for (const [looks, reads] of LOOK_ALIKE_GROUPS) {
    const chars = [...looks]
    if (chars.length !== reads.length) {
      throw new Error(`look-alike group out of step: ${reads}`)
    }
    chars.forEach((char, index) => map.set(char, reads[index]))
  }
  for (const [capital, letter] of CHEROKEE) {
    const small = capital >= 0x13f0 ? capital + 8 : capital - 0x13a0 + 0xab70
    map.set(String.fromCodePoint(capital), letter)
    map.set(String.fromCodePoint(small), letter)
  }
  for (const base of ENCLOSED_A) {
    for (let index = 0; index < 26; index += 1) {
      map.set(
        String.fromCodePoint(base + index),
        String.fromCharCode(97 + index),
      )
    }
  }
  return map
}

const LOOK_ALIKE = buildLookAlike()

// Digits and symbols written for letters, read as letters only inside a word
// that has a letter, so "a55" is "ass" and a year or a score stays a number.
const LEET: Readonly<Record<string, string>> = {
  '0': 'o',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '9': 'g',
  '@': 'a',
  $: 's',
  '€': 'e',
}

// Dropped without splitting a word: "f*ck", "don't".
const DROPPED_RE = /[*'‘’ʼ`]/gu
// Everything else that is not a letter, a digit or a leet symbol separates.
const SEPARATOR_RE = /[^\p{L}\p{N}@$!|€]+/u
const CAMEL_RE = /(\p{Ll})(\p{Lu})/gu
const PART_BREAK = '\u0000'
const MARK_RE = /\p{M}/gu
const FORMAT_RE = /\p{Cf}/gu
const LETTER_RE = /\p{L}/u
// "1", "!" and "|" may stand for "i" or for "l": both are read.
const ONE_RE = /[1!|]/u
const ONES_RE = /[1!|]/gu
const RUN_RE = /([a-z])\1{3,}/gu

/** Look-alikes read as their letters, each keeping its case. */
function lookAlike(text: string): string {
  let out = ''
  for (const char of text) {
    const lower = char.toLowerCase()
    const reads = LOOK_ALIKE.get(lower)
    if (reads === undefined) out += char
    else out += lower === char ? reads : reads.toUpperCase()
  }
  return out
}

/**
 * A word's parts at its capitals ("BigWord" is "Big" and "Word"), unless the
 * parts are too short to be words: "FuCk" is one word, written to dodge.
 */
function camelParts(token: string): string[] {
  const parts = token.replace(CAMEL_RE, `$1${PART_BREAK}$2`).split(PART_BREAK)
  if (parts.length === 1) return parts
  const letters = parts.reduce((sum, part) => sum + [...part].length, 0)
  return letters / parts.length >= 3 ? parts : [token]
}

/** A reading's last folds: plain letters only, "ph" as "f", runs cut to 3. */
function settle(reading: string): string {
  return reading
    .replace(/[^a-z]/gu, '')
    .replace(/ph/gu, 'f')
    .replace(RUN_RE, '$1$1$1')
}

// A letter that may stand for another, and that other: a word holding one
// is read both ways ("fvck", "niqqa").
const EITHER_WAY: readonly (readonly [string, string])[] = [
  ['v', 'u'],
  ['q', 'g'],
]

/**
 * Every way a word may be read: "1" as "i" and as "l", "v" also as "u", "q"
 * also as "g". The plain reading comes first. Empty for a word with no
 * letter in it, which is a number or a symbol.
 */
function readings(raw: string): string[] {
  if (!LETTER_RE.test(raw)) return []
  let base = ''
  for (const char of raw) base += LEET[char] ?? char
  let found = ONE_RE.test(base)
    ? [base.replace(ONES_RE, 'i'), base.replace(ONES_RE, 'l')]
    : [base]
  for (const [letter, reads] of EITHER_WAY) {
    found = found.flatMap((word) =>
      word.includes(letter) ? [word, word.replaceAll(letter, reads)] : [word],
    )
  }
  return [...new Set(found.map(settle))].filter((word) => word !== '')
}

/**
 * The words a reader sees in a text, each with its readings. Single letters
 * in a row are one word ("f u c k"); a capital inside a word starts a new
 * one ("BigWord", see camelParts).
 */
function words(text: string): string[][] {
  const plain = lookAlike(
    text
      .normalize('NFKC')
      .normalize('NFD')
      .replace(MARK_RE, '')
      .replace(FORMAT_RE, '')
      .replace(DROPPED_RE, ''),
  )
  const raws: string[] = []
  let singles = ''
  const flush = (): void => {
    if (singles !== '') raws.push(singles)
    singles = ''
  }
  for (const token of plain.split(SEPARATOR_RE)) {
    for (const part of camelParts(token)) {
      const raw = part.toLowerCase()
      if (raw.length <= 2 && [...raw].length === 1) {
        singles += raw
        continue
      }
      flush()
      if (raw !== '') raws.push(raw)
    }
  }
  flush()
  return raws.map(readings).filter((found) => found.length > 0)
}

/** The words a reader sees in a text, each as plainly read. */
export function foldedWords(text: string): string[] {
  return words(text).map(([plain]) => plain)
}

// ── The list, as patterns ────────────────────────────────────────────

/** A list word read as a name is: its plain reading. */
function fold(word: string): string {
  return readings(word)[0] ?? ''
}

/** A word as its letters and how many times each is written in a row. */
function letterRuns(word: string): [string, number][] {
  const out: [string, number][] = []
  let index = 0
  while (index < word.length) {
    const letter = word[index]
    let count = 1
    while (word[index + count] === letter) count += 1
    out.push([letter, count])
    index += count
  }
  return out
}

/** "nigger" as a pattern: each run of a letter at least as long as written. */
function runs(word: string): string {
  return letterRuns(word)
    .map(([letter, count]) =>
      count === 1 ? `${letter}+` : `${letter}{${count},}`,
    )
    .join('')
}

/**
 * A word that stands alone, as a pattern: each run as written, or stretched
 * to three ("shiiit"), never merely doubled, which an ordinary word or name
 * may be: "Anna1" reads "annal", and is not "anal".
 */
function aloneLetters(word: string): string {
  return letterRuns(word)
    .map(([letter, count]) =>
      count >= 3
        ? `${letter}{3}`
        : `${letter}{${count}}(?:${letter}{${3 - count}})?`,
    )
    .join('')
}

/** "rape:s,d" as a pattern: the word, then one of its endings or none. */
function aloneRuns(entry: string): string {
  const [word, endings = ''] = entry.split(':')
  const after = endings
    .split(',')
    .filter((ending) => ending !== '')
    .map(fold)
  return after.length === 0
    ? aloneLetters(fold(word))
    : `${aloneLetters(fold(word))}(?:${after.join('|')})?`
}

interface Matcher {
  inside: RegExp | null
  alone: RegExp | null
  phrases: string[][]
  split: RegExp | null
}

function matcher(tiers: readonly WordTier[]): Matcher {
  const alone = tiers
    .flatMap((tier) => tier.alone)
    .filter((entry) => fold(entry.split(':')[0]) !== '')
  return {
    inside: insideRegExp(tiers.flatMap((tier) => tier.inside)),
    alone:
      alone.length === 0
        ? null
        : new RegExp(`^(?:${alone.map(aloneRuns).join('|')})$`, 'u'),
    phrases: tiers.flatMap((tier) => tier.phrases).map(phraseWords),
    split: insideRegExp(tiers.flatMap((tier) => tier.split ?? [])),
  }
}

function insideRegExp(list: readonly string[]): RegExp | null {
  const folded = list.map(fold).filter((word) => word !== '')
  return folded.length === 0
    ? null
    : new RegExp(folded.map(runs).join('|'), 'u')
}

function phraseWords(phrase: string): string[] {
  return phrase.split(' ').map(fold)
}

const IN_NAMES = matcher([EVERYWHERE, NAMES])
const IN_LYRICS = matcher([EVERYWHERE])
const INNOCENT = new Set(INNOCENT_WORDS.map(fold))
const INNOCENT_RUNS = INNOCENT_PHRASES.map(phraseWords)
const HATE_NUMBER_RE = /(?:^|\D)1488(?:\D|$)/u

/** Whether the phrase's words stand in a row at `at`, by any reading. */
function phraseAt(found: string[][], phrase: string[], at: number): boolean {
  return phrase.every(
    (word, offset) => found[at + offset]?.includes(word) === true,
  )
}

/** The places of words an innocent phrase holds ("cum laude"). */
function innocentPlaces(found: string[][]): Set<number> {
  const places = new Set<number>()
  for (const phrase of INNOCENT_RUNS) {
    for (let at = 0; at < found.length; at += 1) {
      if (!phraseAt(found, phrase, at)) continue
      for (let offset = 0; offset < phrase.length; offset += 1) {
        places.add(at + offset)
      }
    }
  }
  return places
}

function spells(found: string[][], list: Matcher): boolean {
  const innocent = innocentPlaces(found)
  const word = found.some(
    (readingsOf, place) =>
      !innocent.has(place) &&
      readingsOf.some(
        (reading) =>
          !INNOCENT.has(reading) &&
          ((list.inside?.test(reading) ?? false) ||
            (list.alone?.test(reading) ?? false)),
      ),
  )
  if (word) return true
  if (splitAcross(found, list.split)) return true
  return list.phrases.some((phrase) =>
    found.some((_, at) => phraseAt(found, phrase, at)),
  )
}

/** A split word read across each two words in a row, by every reading. */
function splitAcross(found: string[][], split: RegExp | null): boolean {
  if (split === null) return false
  return found.some(
    (second, at) =>
      at > 0 &&
      found[at - 1].some((first) =>
        second.some((next) => {
          const pair = `${first}${next}`
          return !INNOCENT.has(pair) && split.test(pair)
        }),
      ),
  )
}

// ── The checks ───────────────────────────────────────────────────────

/** Whether a name or a title spells a word on the list, crude or hateful. */
export function hasFilteredWord(text: string): boolean {
  return (
    HATE_NUMBER_RE.test(text.normalize('NFKC')) || spells(words(text), IN_NAMES)
  )
}

/**
 * Whether a longer text (a melody's lyrics) carries one of the slurs no song
 * needs. Crude words pass: songs have them.
 */
export function hasSlur(text: string): boolean {
  return text.split(/\r?\n/u).some((line) => spells(words(line), IN_LYRICS))
}

const CONTROL_RE = /\p{Cc}/u
const LINE_BREAK_RE = /[\n\r]/gu
// Direction overrides and isolates turn text around, a spoofing trick.
const BIDI_RE = /[‪-‮⁦-⁩]/u
const VISIBLE_RE = /[\p{L}\p{N}\p{P}\p{S}]/u

/** What is wrong with a name another singer will read, or null. */
export function nameProblem(
  text: string,
  rules: NameRules,
): NameProblem | null {
  if (text === '') return rules.optional === true ? null : 'empty'
  if (text.length > rules.max) return 'too-long'
  const controls =
    rules.multiline === true ? text.replace(LINE_BREAK_RE, '') : text
  if (CONTROL_RE.test(controls) || BIDI_RE.test(text)) return 'unreadable'
  // Something there that shows nothing: spaces, or hidden characters only.
  if (!VISIBLE_RE.test(text)) return 'empty'
  const lines = rules.multiline === true ? text.split(/\r?\n/u) : [text]
  return lines.some(hasFilteredWord) ? 'words' : null
}

/**
 * A name a sign-in provider gave (Google's, or the one Apple asks for once),
 * made fit for the boards: clipped to a display name's length, or null when
 * the filter refuses it, and the account keeps its default handle. The singer
 * did not type it on our form, so refusing their sign-in over it would be
 * wrong; they can choose another name in Settings.
 */
export function providerName(name: string | null | undefined): string | null {
  const trimmed = name?.trim() ?? ''
  let clipped = ''
  for (const char of trimmed) {
    if (clipped.length + char.length > DISPLAY_NAME_MAX) break
    clipped += char
  }
  clipped = clipped.trimEnd()
  if (clipped === '') return null
  return nameProblem(clipped, { max: DISPLAY_NAME_MAX }) === null
    ? clipped
    : null
}
