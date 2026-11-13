// ============================================================
// Lesson 26 Sing it's plan — the two parts in G, the sets, and their words
// ============================================================
//
// The data and the words of Sing it (WEB-SPEC, Toys 5; FACTS 50 to 61), as
// pure functions, so every line and every rule is unit-tested without a
// microphone. In G, with do on G3 for the lower voice and G4 for the
// higher, and no Move do and no other octave (FACTS 50): the tune is do re
// mi re do; the lower voice's part is la ti do ti la, a third below it,
// and the higher voice's mi fa so fa mi, a third above it (FACTS 51). Each
// part is five notes at 60 BPM, a beat each and the last two, 6.0 s. A set
// is one part sung in runs: the learner's part, then, after Easy or
// Workable, the tune in the swap, Merc or Tavi singing the other part. A
// set allows three takes, every take counted (FACTS 57). Nothing
// celebrates a run (FACTS 60).

import type { Feeling } from '@/features/lessons/kit/comfort'
import { afterFeeling } from '@/features/lessons/kit/comfort'
import type { Voice } from '@/features/lessons/kit/voice-choice'

/** The runs' tempo: a beat a second (FACTS 54). */
export const BPM = 60
/** The count-in: one bar of four clicks, beat 1 higher. */
export const COUNT_IN = 4
/** Each note's beats: four of one beat, the last of two (FACTS 54). */
export const BEATS = [1, 1, 1, 1, 2] as const
/** Seconds of a part: six beats at 60 BPM. */
export const PART_SEC = 6

/** Do for each voice, MIDI: G3, and G4 an octave up (FACTS 50). */
export const DO: Readonly<Record<Voice, number>> = { lower: 55, higher: 67 }

/** The two sets: the learner's part, then the swap, the learner singing the tune. */
export type SetId = 'part' | 'swap'

/** A part: its notes, MIDI, in order, and each one's syllable. */
export interface Part {
  readonly midis: readonly number[]
  readonly syllables: readonly string[]
}

/** The tune and each voice's part, semitones from do (FACTS 51). */
const TUNE_STEPS = [0, 2, 4, 2, 0] as const
const PART_STEPS: Readonly<Record<Voice, readonly number[]>> = {
  lower: [-3, -1, 0, -1, -3],
  higher: [4, 5, 7, 5, 4],
}
const SYLLABLES: Readonly<Record<'tune' | Voice, readonly string[]>> = {
  tune: ['do', 're', 'mi', 're', 'do'],
  lower: ['la', 'ti', 'do', 'ti', 'la'],
  higher: ['mi', 'fa', 'so', 'fa', 'mi'],
}

/** The tune in `v`'s octave: do re mi re do. */
export const tuneOf = (v: Voice): Part => ({
  midis: TUNE_STEPS.map((s) => DO[v] + s),
  syllables: SYLLABLES.tune,
})

/** `v`'s part: a third below the tune for the lower voice, above it for the higher. */
export const partOf = (v: Voice): Part => ({
  midis: PART_STEPS[v].map((s) => DO[v] + s),
  syllables: SYLLABLES[v],
})

/** What the learner sings in a set, and what Merc or Tavi sings with them. */
export function setParts(
  v: Voice,
  set: SetId,
): { readonly mine: Part; readonly other: Part } {
  return set === 'part'
    ? { mine: partOf(v), other: tuneOf(v) }
    : { mine: tuneOf(v), other: partOf(v) }
}

/** A part's notes with their beats from bar 1's first beat, as the reader takes them. */
export function beatsOf(
  midis: readonly number[],
): { midi: number; beat: number; beats: number }[] {
  let beat = 0
  return midis.map((midi, i) => {
    const n = { midi, beat, beats: BEATS[i] }
    beat += BEATS[i]
    return n
  })
}

/** Who sings for each voice: Merc for the lower, Tavi for the higher. */
export const singerOf = (v: Voice): 'Merc' | 'Tavi' =>
  v === 'lower' ? 'Merc' : 'Tavi'

/** Whose the other part is, in the lines: "Merc's". */
export const ownerOf = (v: Voice): string => `${singerOf(v)}'s`

/** The other part as the checks name it: "Merc's part". */
export const partName = (v: Voice): string => `${ownerOf(v)} part`

/** A syllable with its first letter raised, as a line begins: "La". */
export const title = (s: string): string => s[0].toUpperCase() + s.slice(1)

/** Your turn's first line: the part the set sings (FACTS 55). */
export function turnFirst(v: Voice, set: SetId): string {
  if (set === 'swap') return 'do re mi re do, the tune.'
  return v === 'lower'
    ? 'la ti do ti la, a third below the tune.'
    : 'mi fa so fa mi, a third above the tune.'
}

/** Takes a set allows in a visit, every take counted (kit/take.ts `MAX_TRIES`; FACTS 57). */
export const TAKES_PER_SET = 3

/** The tricky line follows a run with under half its notes in the band (FACTS 57). */
export const TRICKY_SHARE = 0.5

/** What a run left: no voice, cut short when the page was left, or read, with its notes in the band. */
export type RunMark =
  | { readonly kind: 'silent' }
  | { readonly kind: 'left' }
  | { readonly kind: 'read'; readonly inBand: number; readonly notes: number }

/** Whether a set that has had these runs may have another. */
export const againAllowed = (runs: readonly RunMark[]): boolean =>
  runs.length < TAKES_PER_SET

/** What the answer to "How did that feel?" leaves on the card after a run, or after a sing-along. */
export interface AfterRun {
  /** The lines and the pitch line stay. */
  readonly readings: boolean
  /** "If that felt tricky, good: that's learning." */
  readonly tricky: boolean
  /** The closing line: the swap offered, Effortful's, Uncomfortable's, or none. */
  readonly closing: 'swap' | 'gentle' | 'enough' | null
  readonly doctor: boolean
  /** The Wrap's rest card, and no more singing this visit. */
  readonly rest: boolean
  readonly offers: {
    readonly swap: boolean
    readonly again: boolean
    readonly alongAgain: boolean
    readonly today: boolean
  }
}

/** The rest card after "Effortful" too, as Lessons 18 and 24 have it (REQ-GVC-021). */
const OPTIONS = { restAfterEffort: true } as const

/**
 * The answer to "How did that feel?" after a run of `set` (its runs so far,
 * the latest last), or after a sing-along of it (`along`, with whether its
 * Again has been sung this visit): Easy or Workable offers the swap after
 * the learner's part, Again while the set has takes left, or the
 * sing-along's Again once a visit, and Done for today; Effortful keeps the
 * lines and offers only Done for today; Uncomfortable takes the lines away
 * and offers nothing (WEB-SPEC, Toys 5, states 9 and 11).
 */
export function afterRun(
  set: SetId,
  runs: readonly RunMark[],
  f: Feeling,
  along: { readonly again: boolean } | null = null,
): AfterRun {
  const a = afterFeeling(f, OPTIONS)
  const last = runs.at(-1)
  const fine = a.closing === null
  const tricky =
    fine &&
    along === null &&
    last?.kind === 'read' &&
    last.inBand < last.notes * TRICKY_SHARE
  return {
    readings: a.count && along === null,
    tricky,
    closing: fine ? (set === 'part' ? 'swap' : null) : a.closing,
    doctor: a.doctor,
    rest: a.rest,
    offers: {
      swap: fine && set === 'part',
      again: fine && along === null && againAllowed(runs),
      alongAgain: fine && along !== null && !along.again,
      today: a.closing !== 'enough',
    },
  }
}

/**
 * The figure's time axis, in beats either side of the bars: the take's
 * (kit/take-in-time.ts `OPEN_BEATS`, kit/read-in-time.ts `WINDOW_BEATS`),
 * held here so the figure draws before the take's module loads (a test
 * keeps the two equal).
 */
export const AXIS = { lead: 0.5, tail: 0.25 } as const

/** Seconds after a run before its pitch line and its lines are drawn. */
export const AFTER_SEC = 0.5

/** Every status line Sing it says, beside the reader's own and the checks'. */
export const STATUS = {
  comfort: 'Before you sing: how is your voice today?',
  voice: "Choose the voice you'll sing with.",
  voiceListen: 'Choose a voice: it picks who sings.',
  listen: 'Just listening today: the microphone stays off.',
  phones: 'Put on headphones, or choose the sing-along.',
  brief: 'Read what this does, then press Start.',
  asking: 'Asking your browser for the microphone.',
  counting: 'Counting in: one bar.',
  along:
    'The sing-along: hear your part alone, then sing it with the other part after the count-in. Nothing listens.',
  nomic:
    'No microphone? Sing along anyway: hear your part alone, then sing it with the other part. Nothing listens.',
  left: 'That run stopped when you left, so nothing was read.',
  silent: "We didn't hear you start that time.",
  feel: 'How did that feel?',
  both: 'That was both parts: the tune and its harmony.',
  alongDone: 'You sang your part against the other one.',
  gentle: 'Keep it gentle: rest before you sing again.',
  enough:
    "Thanks for saying so. That's enough singing for today: rest your voice.",
  spent: "That's every run this set has today.",
  done: 'Done for today.',
} as const

/** What Start says under itself with sound off, asking for nothing (WEB-SPEC, Toys 5, state 5). */
export const startSoundOff = (v: Voice): string =>
  `Sound is off, so nothing played. Turn sound on to hear ${partName(v)}, then press Start.`

/** The model's status line: "Merc sings your part alone first." */
export const modelStatus = (v: Voice): string =>
  `${singerOf(v)} sings your part alone first.`

/** The take's status line: "Your turn: sing your part with Merc's." */
export const takeStatus = (v: Voice): string =>
  `Your turn: sing your part with ${ownerOf(v)}.`

/** The swap's line: "Now swap: sing the tune while Merc sings your part." */
export const swapLine = (v: Voice): string =>
  `Now swap: sing the tune while ${singerOf(v)} sings your part.`

/** The figure's words, before a run: "Your part as five bands: la, ti, do, ti and la, with Merc's tune beside it". */
export function figureWords(v: Voice, set: SetId): string {
  const { mine } = setParts(v, set)
  const notes = `${mine.syllables.slice(0, -1).join(', ')} and ${mine.syllables.at(-1) ?? ''}`
  const beside = set === 'part' ? `${ownerOf(v)} tune` : `${ownerOf(v)} part`
  return `Your part as five bands: ${notes}, with ${beside} beside it`
}

/** The figure's words after a run: the pitch line over the bands, folded where the voice sat an octave away. */
export function pitchWords(v: Voice, set: SetId, octaves: number): string {
  const folded = octaves === 0 ? '' : " It is drawn in your part's octave."
  return `${figureWords(v, set)}, and your pitch line over the bands.${folded}`
}

/** The note of a part sounding `t` s after bar 1's first beat, by its place; null before bar 1 and after the part. */
export function noteAt(t: number): number | null {
  const spb = 60 / BPM
  let start = 0
  for (let i = 0; i < BEATS.length; i++) {
    const end = start + BEATS[i] * spb
    if (t >= start && t < end) return i
    start = end
  }
  return null
}
