// ============================================================
// syllable-split — where an English word's syllables begin
// ============================================================
//
// `countSyllables` in @/lib/word-sync answers "how many"; this answers
// "where", which is a harder question and a guessier one. It exists to save
// the singer the boring half of sub-word mapping: on a four-syllable word
// they would otherwise place four boundaries by eye before timing any of
// them.
//
// **This is a suggestion, never an answer.** Two reasons it cannot be more:
//
//   - Orthographic syllables are not sung syllables. A melisma stretches one
//     syllable over four notes, and that is exactly the case sub-word mapping
//     was built for — so the moment the suggestion matters most, it is wrong.
//   - English hyphenation is genuinely irregular. Doing it properly means
//     Liang's pattern tables (~14k patterns, the TeX algorithm), which is a
//     large dependency for a starting guess.
//
// So this is a heuristic sized to its job: it puts boundaries in roughly the
// right places for ordinary words, and the singer drags them. It deliberately
// returns nothing rather than guessing when it cannot see a clean split.
//
// Tests: src/tests/syllable-split.test.ts
// Plan: docs/plans/lrc-mapper-studio-plan.md (Phase 4).

import { splitGraphemes } from './word-letters'

const VOWELS = 'aeiouyà-öø-ÿ'
const VOWEL_RE = new RegExp(`[${VOWELS}]`, 'i')

/**
 * Consonant pairs that begin a syllable rather than straddling one, so the
 * break goes before both letters and not between them ("de-clare", not
 * "dec-lare"). Digraphs are here for the same reason: "th" is one sound and
 * splitting it invents a syllable nobody sings.
 */
const ONSET_CLUSTERS = new Set([
  'bl',
  'br',
  'ch',
  'cl',
  'cr',
  'dr',
  'dw',
  'fl',
  'fr',
  'gh',
  'gl',
  'gn',
  'gr',
  'kl',
  'kn',
  'kr',
  'ph',
  'pl',
  'pr',
  'qu',
  'sc',
  'sh',
  'sk',
  'sl',
  'sm',
  'sn',
  'sp',
  'st',
  'sw',
  'th',
  'tr',
  'tw',
  'wh',
  'wr',
])

function isVowel(ch: string): boolean {
  return VOWEL_RE.test(ch)
}

/**
 * Boundary indices, in grapheme space, where this word's syllables start.
 *
 * Excludes 0 and the word's length: those are the word's own edges, which
 * the editor treats as its start and end rather than as splits inside it.
 * A one-syllable word therefore returns `[]`, which is correct — there is
 * nothing inside it to split.
 *
 * Indices line up with `splitGraphemes`, so they can be handed straight to
 * the letter editor without re-deriving positions from the raw string.
 */
export function syllableBoundaries(word: string): number[] {
  const graphemes = splitGraphemes(word)
  const letters: { ch: string; idx: number }[] = []
  for (let i = 0; i < graphemes.length; i++) {
    // Apostrophes and punctuation ride along with the letter before them;
    // they are never a syllable start ("I'll" is one syllable, not two).
    if (/[\p{L}]/u.test(graphemes[i]))
      letters.push({ ch: graphemes[i], idx: i })
  }
  if (letters.length < 3) return []

  const vowel = letters.map((l) => isVowel(l.ch))

  // A trailing silent "e" is not a syllable ("declare" is de-clare, never
  // de-cla-re). Demoting it to a consonant before the walk is what keeps the
  // last vowel group from finding a partner after it.
  const last = letters.length - 1
  if (
    letters[last].ch.toLowerCase() === 'e' &&
    !vowel[last - 1] &&
    vowel.filter(Boolean).length > 1
  ) {
    vowel[last] = false
  }

  const out: number[] = []

  // Walk vowel group to vowel group. Each gap between two groups holds the
  // consonants that have to be divided between the syllables either side.
  let i = 0
  while (i < letters.length) {
    if (!vowel[i]) {
      i++
      continue
    }
    // Run to the end of this vowel group.
    let vowelEnd = i
    while (vowelEnd + 1 < letters.length && vowel[vowelEnd + 1]) vowelEnd++

    // Then over the consonants that follow it.
    let consEnd = vowelEnd
    while (consEnd + 1 < letters.length && !vowel[consEnd + 1]) consEnd++
    const consonants = consEnd - vowelEnd

    // No vowel after them means this is the last syllable — its consonants
    // are its tail, not a boundary.
    if (consEnd + 1 >= letters.length) break

    // Where the next syllable starts, in the letter list:
    //   0 consonants -> straight at the next vowel ("po-em")
    //   1 consonant  -> before it ("ba-by"), the open-syllable default
    //   2+           -> between them, unless the last two start a syllable
    //                   together ("de-clare"), in which case before both
    let start: number
    if (consonants === 0) start = vowelEnd + 1
    else if (consonants === 1) start = vowelEnd + 1
    else {
      const pair = (letters[consEnd - 1].ch + letters[consEnd].ch).toLowerCase()
      start = ONSET_CLUSTERS.has(pair) ? consEnd - 1 : consEnd
    }

    // A one-letter *first* syllable is real ("o-pen", "a-way"), but a
    // one-letter tail never is — that is a split nobody sings.
    const remaining = letters.length - start
    if (remaining >= 2 && start >= 1) out.push(letters[start].idx)

    i = consEnd + 1
  }

  // A "-le" ending is a real syllable ("gent-le", "tab-le") but carries no
  // vowel of its own, so the walk above can never see it. Literally "le" —
  // widening this to any consonant + e re-breaks every silent-e word.
  const tail = letters
    .slice(-2)
    .map((l) => l.ch.toLowerCase())
    .join('')
  if (letters.length >= 4 && tail === 'le') {
    const l = letters.length - 2
    const prev = letters[l - 1].ch.toLowerCase()
    // Where the break goes depends on what precedes the "l": a cluster that
    // opens a syllable takes it along ("trou-ble"), and a doubled consonant
    // splits down the middle ("lit-tle"). Otherwise the "le" stands alone.
    const takesPrev =
      ONSET_CLUSTERS.has(`${prev}l`) ||
      (l >= 2 && prev === letters[l - 2].ch.toLowerCase())
    const start = letters[takesPrev ? l - 1 : l].idx
    if (!out.includes(start) && start >= 2) out.push(start)
  }

  return [...new Set(out)].sort((a, b) => a - b)
}
