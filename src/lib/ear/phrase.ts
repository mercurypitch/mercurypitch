// ============================================================
// phrase — a short melody as scale degrees, and a phrase tapped
// back against it.
//
// Echo and Span (and, later, Echo in the Wild and the sung modes)
// share one vocabulary: degrees 1..8 of the major scale over a
// planted tonic, 8 being the tonic above. A phrase is judged note
// by note, in order — the first slip is what the reveal points at.
// Span's phrases are drawn fresh at the staircase's length, a
// diatonic walk whose leaps stay within a fifth; the walk takes its
// randomness as an argument so a test can hold it still.
//
// Pure. Nothing here plays a sound.
// ============================================================

/** Semitones above the tonic for degrees 1..8. */
const DEGREE_SEMITONES = [0, 2, 4, 5, 7, 9, 11, 12] as const

const SOLFEGE = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Ti', 'Do′'] as const

export const PHRASE_DEGREES: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8]

export function degreeSemitone(degree: number): number {
  return DEGREE_SEMITONES[Math.min(8, Math.max(1, Math.round(degree))) - 1]
}

export function degreeSolfege(degree: number): string {
  return SOLFEGE[Math.min(8, Math.max(1, Math.round(degree))) - 1]
}

/** MIDI notes of a phrase over a tonic. */
export function phraseMidis(
  rootMidi: number,
  degrees: readonly number[],
): number[] {
  return degrees.map((degree) => rootMidi + degreeSemitone(degree))
}

/** "Do Re Mi" — the phrase said aloud. */
export function solfegeOf(degrees: readonly number[]): string {
  return degrees.map(degreeSolfege).join(' ')
}

/** The degree (1..8) nearest to a pitch `semitones` above the tonic,
 *  octave-folded: what a sung note is heard as. A note right at the
 *  octave is Do′ (8); anything nearer the tonic below is Do (1). */
export function nearestDegree(semitones: number): number {
  let rel = semitones % 12
  if (rel < 0) rel += 12
  let best = 1
  let bestDistance = Number.POSITIVE_INFINITY
  DEGREE_SEMITONES.forEach((target, i) => {
    const distance = Math.min(
      Math.abs(rel - target),
      Math.abs(rel - target + 12),
    )
    if (distance < bestDistance) {
      bestDistance = distance
      best = i + 1
    }
  })
  return best === 8 && rel < 6 ? 1 : best
}

export function largestLeap(degrees: readonly number[]): number {
  let leap = 0
  for (let i = 1; i < degrees.length; i++) {
    leap = Math.max(leap, Math.abs(degrees[i] - degrees[i - 1]))
  }
  return leap
}

export interface PhraseVerdict {
  correct: boolean
  /** Per expected note: met by the answer at the same position. */
  perNote: boolean[]
  /** 0-based index of the first note that was wrong or missing. */
  firstMiss: number | null
}

/** Position by position; an answer shorter than the phrase is missing
 *  its tail, one longer is wrong at the first extra note. */
export function judgePhrase(
  expected: readonly number[],
  answered: readonly number[],
): PhraseVerdict {
  const perNote = expected.map((degree, i) => answered[i] === degree)
  let firstMiss: number | null = perNote.indexOf(false)
  if (firstMiss === -1) {
    firstMiss = answered.length > expected.length ? expected.length : null
  }
  return { correct: firstMiss === null, perNote, firstMiss }
}

const WALK_STEPS = [-4, -3, -2, -1, 1, 2, 3, 4] as const
const WALK_STARTS = [1, 3, 5] as const

/** A diatonic walk of `length` degrees within 1..8, leaps within a
 *  fifth, starting on a chord tone. A step that would leave the
 *  octave is reflected, so every phrase stays singable. */
export function randomPhrase(
  length: number,
  random: () => number = Math.random,
): number[] {
  const count = Math.max(1, Math.round(length))
  const pick = <T>(list: readonly T[]): T =>
    list[Math.min(list.length - 1, Math.floor(random() * list.length))]
  const phrase: number[] = [pick(WALK_STARTS)]
  while (phrase.length < count) {
    const prev = phrase[phrase.length - 1]
    const step = pick(WALK_STEPS)
    const next = prev + step
    phrase.push(next >= 1 && next <= 8 ? next : prev - step)
  }
  return phrase
}
