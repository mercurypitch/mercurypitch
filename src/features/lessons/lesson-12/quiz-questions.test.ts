// ============================================================
// Lesson 12 question tests — ids, keys, the copy, the step links
// ============================================================
//
// WEB-SPEC, Tests 10 and the quick-check half of Tests 11: four questions,
// l12-q1 to l12-q4, three answers each, one right, stored under
// fyp-l12-seed and fyp-l12-quiz-v1; no feedback starts "Right", "Yes" or
// "Correct", since the kit prints "Right." or "Not quite." first; every
// line is LESSON.md's, passes the claims check and speaks its signs and
// numerals in words (Toys 8). The recall's half joins once the page is
// built.

import { describe, expect, it } from 'vitest'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import { QUIZ_KEYS, QUIZ_QUESTIONS } from './quiz-questions'

/** Markup as the eye reads it: the signs and numerals shown, the spoken words dropped. */
const seen = (html: string): string =>
  html.replace(/<span class="sr">[^<]*<\/span>/g, '').replace(/<[^>]+>/g, '')

/** Markup as a screen reader reads it: the hidden signs and numerals dropped. */
const heard = (html: string): string =>
  html
    .replace(/<span aria-hidden="true">[^<]*<\/span>/g, '')
    .replace(/<[^>]+>/g, '')

/** A Roman numeral standing as a word, or the diminished circle. */
const BARE = /\b(?:[IV]+|[iv]+)\b|°/

/** Every question, answer and feedback line, as markup. */
const lines = (): string[] =>
  QUIZ_QUESTIONS.flatMap((q) => [
    q.question,
    ...q.options.flatMap((o) => [o.text, o.feedback]),
  ])

/** LESSON.md's quick check, as the page shows it (its straight quotes set as curly ones). */
const LESSON: readonly string[] = [
  'In C major, which notes make the chord on la?',
  'A, C and E',
  "La, do and mi: A, with the scale's notes a third and a fifth above it.",
  'A, C♯ and E',
  "C♯ isn't in C major, and the key's chords use only its notes. Try Step 3 again.",
  'F, A and C',
  "That's the chord on fa, IV. The chord on la is built up from A. Try Step 1 again.",
  'In C major, the chord on re is written ii. What does that tell you?',
  "Its root is the scale's second note, and it's minor",
  'Re is degree 2, and small letters mean minor: D, F, A.',
  "It's the second chord in the song",
  "A numeral names the root's place in the scale, not the chord's place in a song. Try Step 2 again.",
  "Its root is the scale's second note, and it's diminished",
  'A diminished chord adds a small circle, as in vii°. D, F, A is 3 then 4 semitones: minor.',
  'In C major, what are the roots of I–V–vi–IV?',
  'C, G, A and F',
  'Do, so, la and fa: degrees 1, 5, 6 and 4.',
  'C, D, E and F',
  "Those are the scale's first four notes. The numerals point to degrees 1, 5, 6 and 4. Try Step 4 again.",
  'A, E, F and D',
  "That counts from A. The numerals count from the key's do, C. Try Step 2 again.",
  "A friend says: “Those two songs use the same four chords. They're the same song.” What does this lesson suggest?",
  'Not necessarily: the tune, in its rhythm, can make them two songs',
  "Ask someone to sing a song, and they'll usually sing its tune. Two tunes can share every chord.",
  'Same chords, same song',
  "This lesson's two tunes share every chord and are still two tunes. Try Step 5 again.",
  "Only if they're in the same key",
  'Even in the same key, a different tune over the same chords can make a different song.',
]

describe('the quick check (Toys 8, Tests 11)', () => {
  it('asks four questions, l12-q1 to l12-q4, three answers each, one of them right', () => {
    // Assert
    expect(QUIZ_QUESTIONS.map((q) => q.id)).toEqual([
      'l12-q1',
      'l12-q2',
      'l12-q3',
      'l12-q4',
    ])
    for (const q of QUIZ_QUESTIONS) {
      expect(q.options).toHaveLength(3)
      expect(q.options.filter((o) => o.correct === true)).toHaveLength(1)
    }
  })

  it('stores its answer order and record under fyp-l12-seed and fyp-l12-quiz-v1', () => {
    // Assert: WEB-SPEC Toys 8 and Contract
    expect(QUIZ_KEYS).toEqual({
      seed: 'fyp-l12-seed',
      record: 'fyp-l12-quiz-v1',
    })
  })

  it('starts no feedback line with "Right", "Yes" or "Correct"', () => {
    // Act
    const feedback = QUIZ_QUESTIONS.flatMap((q) =>
      q.options.map((o) => seen(o.feedback)),
    )

    // Assert: Tests 10; the kit prints "Right." or "Not quite." first
    for (const line of feedback)
      expect(line).not.toMatch(/^(Yes|Right|Correct)\b/)
  })

  it('links back to Steps 3, 1, 2, 4, 2 and 5, in that order', () => {
    // Act
    const steps = QUIZ_QUESTIONS.flatMap((q) =>
      q.options.flatMap((o) =>
        Array.from(o.feedback.matchAll(/data-goto-step="(\d)"/g), (m) => m[1]),
      ),
    )

    // Assert
    expect(steps).toEqual(['3', '1', '2', '4', '2', '5'])
  })

  it('plays no sound: no question has a slot or a button', () => {
    // Assert: Toys 8, "None of the four plays a sound"
    for (const q of QUIZ_QUESTIONS) {
      expect(q.slot).toBeUndefined()
      expect(q.question).not.toContain('<button')
    }
  })
})

describe('the copy (Tests 10)', () => {
  it("shows LESSON.md's questions, answers and feedback word for word, in authored order", () => {
    // Act
    const shown = lines().map(seen)

    // Assert
    expect(shown).toEqual(LESSON)
  })

  it('speaks every sign and numeral in words, so nothing a screen reader hears holds one', () => {
    // Act
    const spoken = lines().map(heard)

    // Assert: Contract and Toys 8
    for (const line of spoken) {
      expect(line, line).not.toMatch(/[♯♭]/)
      expect(line, line).not.toMatch(BARE)
    }
    expect(heard(QUIZ_QUESTIONS[2].question)).toBe(
      'In C major, what are the roots of one, five, six minor, four?',
    )
    expect(heard(QUIZ_QUESTIONS[0].options[1].text)).toBe('A, C sharp and E')
  })

  it('passes the claims check, as shown and as heard', () => {
    for (const line of [...lines().map(seen), ...lines().map(heard)]) {
      // Act
      const { violations } = validateGuidedDynamicClaim({
        surface: 'finding',
        text: line,
      })

      // Assert
      expect(violations, line).toEqual([])
    }
  })
})
