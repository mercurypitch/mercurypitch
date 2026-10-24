// ============================================================
// Lesson 12 numerals — Roman numerals in words, for a screen reader
// ============================================================
//
// A screen reader reads "vi" as a word and "vii°" as "vii degree", so every
// numeral the page prints in text is aria-hidden with its spoken form after
// it, visually hidden, as the kit's `signsHtml` does for a sharp or a flat
// (WEB-SPEC, Toys 8 and Contract). Spoken, a numeral is its number, with
// "minor" after a lower-case one and "diminished" after vii° (FACTS 10,
// 17): "I–V–vi–IV" is "one, five, six minor, four", and "vii°" "seven
// diminished". A progression's numerals are joined by en dashes, as Ear
// Lab's Cadence writes them.
//
// A caller names the numeral itself, never a whole sentence, so the word
// "I" in a line of copy can never be read as "one". Anything that is not a
// numeral throws: the page's numerals are fixed copy, held by the tests.
// This is the page's own helper; it moves into the kit when a second page
// needs it.

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const

const NUMBER_WORDS = [
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
] as const

/** A scale degree's number in words, 1 to 7: "one" to "seven". */
export function numberWord(n: number): string {
  const word = NUMBER_WORDS[n - 1] as string | undefined
  if (word === undefined) throw new Error(`lesson 12: no degree ${n}`)
  return word
}

/** One numeral: its letters, then ° for diminished or + for augmented. */
const NUMERAL = /^([IV]+|[iv]+)([°+]?)$/

function spokenOne(numeral: string): string {
  const m = NUMERAL.exec(numeral)
  const roman = m?.[1] ?? ''
  const n = ROMAN.indexOf(roman.toUpperCase() as (typeof ROMAN)[number]) + 1
  const lower = roman !== roman.toUpperCase()
  const mark = m?.[2] ?? ''
  if (n === 0 || (mark === '°' && !lower) || (mark === '+' && lower))
    throw new Error(`lesson 12: "${numeral}" is not a numeral`)
  if (mark === '°') return `${numberWord(n)} diminished`
  if (mark === '+') return `${numberWord(n)} augmented`
  return lower ? `${numberWord(n)} minor` : numberWord(n)
}

/** A numeral, or a progression joined by en dashes, in words: "I–V–vi–IV" is "one, five, six minor, four". */
export const spokenNumeral = (numerals: string): string =>
  numerals.split('–').map(spokenOne).join(', ')

/**
 * As markup that shows "vii°" and is read "seven diminished": the numeral
 * aria-hidden, its spoken form after it in a visually hidden `.sr` span.
 * `spokenNumeral` throws on anything but numerals, so nothing else reaches
 * the markup.
 */
export const numeralHtml = (numerals: string): string =>
  `<span aria-hidden="true">${numerals}</span><span class="sr">${spokenNumeral(numerals)}</span>`
