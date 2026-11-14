// ============================================================
// Lesson 28 Sing it's plan — your part of the song, its run and its words
// ============================================================
//
// The data and the words of Sing it (WEB-SPEC, Toys 6; FACTS 53 to 69), as
// pure functions, so every line and rule is tested without a microphone.
// The learner sings bars 1 to 8 of their part from the staff, in G: the
// lower voice Merc's part in the bass clef, with do on G3, the higher
// Tavi's in the treble, with do on G4, and no Move do and no other octave
// (FACTS 68). Each part is fourteen notes, twelve halves and two wholes, at
// 72 BPM, 26.67 s, breathing after bars 2, 4 and 6; with headphones the
// other part sings under the take from bar 1. Merc, or Tavi for the higher
// voice, sings do; whoever's part the learner does not sing is "the other
// part". A visit allows three takes, every one counted, one with no voice
// or cut short too (FACTS 65). Nothing celebrates a run.

import type { Feeling } from '@/features/lessons/kit/comfort'
import { afterFeeling } from '@/features/lessons/kit/comfort'
import type { WrittenNote } from '@/features/lessons/kit/read-in-time'
import type { ScoreNote, ScoreScene } from '@/features/lessons/kit/score-layout'
import { midiOf } from '@/features/lessons/kit/staff-places'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { A, BAR_SEC, BEAT_SEC, DO_MERC, DO_TAVI, sceneOf } from './song'

/** The count-in: one bar of four clicks, beat 1 higher. */
export const COUNT_IN = 4
/** Seconds of a part: eight bars at 72 BPM. */
export const PART_SEC = 8 * BAR_SEC
/** Seconds do is sung before a run. */
export const DO_SEC = 1
/** Seconds after a run before its pitch line and its lines are drawn. */
export const AFTER_SEC = 0.5
/**
 * Beats before bar 1's first beat the take opens: the take's
 * (kit/take-in-time.ts `OPEN_BEATS`), held here so the sing-along books its
 * part before the take's module loads (a test keeps the two equal).
 */
export const OPEN_BEATS = 0.5

/** A part as Sing it takes it: its notes, MIDI, each one's beats, and its syllables in G. */
export interface Part {
  readonly midis: readonly number[]
  readonly beats: readonly number[]
  readonly syllables: readonly string[]
}

/** G major's syllables by letter: F is F sharp, ti. */
const SOLFA: Readonly<Record<string, string>> = {
  G: 'do',
  A: 're',
  B: 'mi',
  C: 'fa',
  D: 'so',
  E: 'la',
  F: 'ti',
}

const partOfBars = (bars: readonly (readonly ScoreNote[])[]): Part => {
  const notes = bars.flat()
  return {
    midis: notes.map((n) => midiOf(n.note)),
    beats: notes.map((n) => n.value),
    syllables: notes.map((n) => SOLFA[n.note.letter] ?? ''),
  }
}

/** Merc's part, bars 1 to 8: do ti, la do, re do, so, do re, mi do, so so, do (FACTS 29). */
export const MERC_PART = partOfBars(A.merc)
/** Tavi's part, bars 1 to 8: mi re, do mi, fa mi, re, mi fa, so mi, re ti, do. */
export const TAVI_PART = partOfBars(A.tavi)

/** Each staff on the score, top to bottom: Tavi's treble, Merc's bass. */
export const TAVI_STAFF = 0
export const MERC_STAFF = 1
/** Both staffs, to light both parts' notes. */
export const BOTH_STAFFS = [TAVI_STAFF, MERC_STAFF] as const

/** The part `v` sings: Merc's for the lower voice, Tavi's for the higher. */
export const mineOf = (v: Voice): Part =>
  v === 'lower' ? MERC_PART : TAVI_PART
/** The other part, which sings under a take with headphones. */
export const otherOf = (v: Voice): Part =>
  v === 'lower' ? TAVI_PART : MERC_PART
/** The staff of the part `v` sings, and of the other. */
export const mineStaff = (v: Voice): number =>
  v === 'lower' ? MERC_STAFF : TAVI_STAFF
export const otherStaff = (v: Voice): number =>
  v === 'lower' ? TAVI_STAFF : MERC_STAFF

/** Do for each voice, MIDI: G3, and G4 an octave up (FACTS 68). */
export const DO: Readonly<Record<Voice, number>> = {
  lower: midiOf(DO_MERC),
  higher: midiOf(DO_TAVI),
}

/** Who sings do, and whose part the learner sings: Merc for the lower voice, Tavi for the higher. */
export const singerOf = (v: Voice): 'Merc' | 'Tavi' =>
  v === 'lower' ? 'Merc' : 'Tavi'
/** Who sings the other part: Tavi for the lower voice, Merc for the higher. */
export const partnerOf = (v: Voice): 'Merc' | 'Tavi' =>
  v === 'lower' ? 'Tavi' : 'Merc'
/** Whose the other part is, in the lines: "Tavi's". */
export const ownerOf = (v: Voice): string => `${partnerOf(v)}'s`
/** The other part as the page names it: "Tavi's part". */
export const partName = (v: Voice): string => `${ownerOf(v)} part`
/** The sing-along's line: "Tavi sings her part". */
export const alongWho = (v: Voice): string =>
  v === 'lower' ? 'Tavi sings her part' : 'Merc sings his part'

/** A syllable with its first letter raised, as a line begins: "Do". */
export const title = (s: string): string => s[0].toUpperCase() + s.slice(1)

/** A part's notes with their beats from bar 1's first beat, as the reader takes them. */
export function writtenOf(p: Part): WrittenNote[] {
  let beat = 0
  return p.midis.map((midi, i) => {
    const n = { midi, beat, beats: p.beats[i] }
    beat += p.beats[i]
    return n
  })
}

/** The notes a breath follows, by place: the last of bars 2, 4 and 6 (WEB-SPEC, Toys 2). */
export const BREATHS: readonly number[] = [2, 4, 6].map(
  (bar) => A.merc.slice(0, bar).flat().length - 1,
)

/** The place of the note sounding `t` s after bar 1's first beat, the same in both parts; null before bar 1 and after bar 8. */
export function noteAt(t: number): number | null {
  if (t < 0) return null
  let start = 0
  for (let i = 0; i < MERC_PART.beats.length; i++) {
    const end = start + MERC_PART.beats[i] * BEAT_SEC
    if (t < end) return i
    start = end
  }
  return null
}

/** The breaths after bars 2, 4 and 6, and the house on do on each staff. */
const MARKS = {
  breaths: [1, 3, 5],
  home: [DO_TAVI, DO_MERC],
}

/**
 * Bars 1 to 8 on the staffs, with the breaths and the house: in the parts'
 * own colours until a voice is chosen, then the learner's part amber and
 * the other part's notes chrome (WEB-SPEC, Toys 6).
 */
export function singScene(v: Voice | null): ScoreScene {
  const scene = sceneOf(A, 1, MARKS)
  if (v === null) return scene
  return {
    ...scene,
    staffs: scene.staffs.map((s, k) => ({
      ...s,
      tone: k === mineStaff(v) ? 'learner' : 'other',
    })),
  }
}

/** Takes a visit allows, every take counted (kit/take.ts `MAX_TRIES`; FACTS 65). */
export const TAKES = 3

/** The tricky line follows a run with under half its notes in the band (FACTS 65). */
export const TRICKY_SHARE = 0.5

/** What a run left: no voice, cut short when the page was left, or read, with its notes in the band. */
export type RunMark =
  | { readonly kind: 'silent' }
  | { readonly kind: 'left' }
  | { readonly kind: 'read'; readonly inBand: number; readonly notes: number }

/** Whether a visit that has had these runs may have another. */
export const againAllowed = (runs: readonly RunMark[]): boolean =>
  runs.length < TAKES

/** What the answer to "How did that feel?" leaves on the card after a run, or after a sing-along. */
export interface AfterRun {
  /** The lines and the pitch line stay. */
  readonly readings: boolean
  /** "If that felt tricky, good: that's learning." */
  readonly tricky: boolean
  /** The closing line: Easy or Workable's after a run, Effortful's, Uncomfortable's, or none. */
  readonly closing: 'ok' | 'gentle' | 'enough' | null
  readonly doctor: boolean
  /** The Wrap's rest card and the close's rest version, and no more singing this visit. */
  readonly rest: boolean
  readonly offers: {
    readonly again: boolean
    readonly alongAgain: boolean
    readonly today: boolean
  }
}

/** The rest card after "Effortful" too, as Lessons 18, 24 and 26 have it (REQ-GVC-021). */
const OPTIONS = { restAfterEffort: true } as const

/**
 * The answer to "How did that feel?" after a run (the visit's runs so far,
 * the latest last), or after a sing-along (`along`, with whether its Again
 * has been sung this visit): Easy or Workable offers Again while the visit
 * has takes left, or the sing-along's Again once a visit, and Done for
 * today; Effortful keeps the lines and offers only Done for today;
 * Uncomfortable takes the lines away and offers nothing (WEB-SPEC, Toys 6,
 * states 10 and 11).
 */
export function afterRun(
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
    closing: fine ? (along === null ? 'ok' : null) : a.closing,
    doctor: a.doctor,
    rest: a.rest,
    offers: {
      again: fine && along === null && againAllowed(runs),
      alongAgain: fine && along !== null && !along.again,
      today: a.closing !== 'enough',
    },
  }
}

/** Every status line Sing it says, beside the reader's own and the checks'. */
export const STATUS = {
  comfort: 'Before you sing: how is your voice today?',
  voice: "Choose the voice you'll sing with.",
  listen: 'Just listening today: the microphone stays off.',
  phones: 'Put on headphones, or choose No headphones to sing alone.',
  brief: 'Read what this does, then press Start.',
  asking: 'Asking your browser for the microphone.',
  counting: 'Counting in: one bar.',
  take: 'Your turn: sing in time with the cursor.',
  nomic: 'No microphone? Sing along anyway: nothing listens.',
  left: 'That run stopped when you left, so nothing was read.',
  silent: "We didn't hear you start that time.",
  feel: 'How did that feel?',
  ok: 'Your part, read in time from the page.',
  alongDone: 'You sang your part with the other one.',
  gentle: 'Keep it gentle: rest before you sing again.',
  enough:
    "Thanks for saying so. That's enough singing for today: rest your voice.",
  spent: "That's every take this visit has.",
  deleted: 'Your take is deleted. The lines stay.',
  soundOff: 'Sound is off, so nothing played.',
  done: 'Done for today.',
} as const

/** What Start says under itself with sound off, asking for nothing (WEB-SPEC, Toys 6, state 5). */
export const START_SOUND_OFF =
  'Sound is off, so nothing played. Turn sound on to hear do, then press Start.'

/** The briefing's status on the alone path: Start, and the other part first if wanted. */
export const aloneStatus = (v: Voice): string =>
  `Read what this does, then press Start, or hear ${partName(v)} first.`

/** Do's status line: "Merc sings do." */
export const doStatus = (v: Voice): string => `${singerOf(v)} sings do.`

/** The alone path's first turn: "Tavi's part alone. Nothing listens." */
export const firstStatus = (v: Voice): string =>
  `${partName(v)} alone. Nothing listens.`

/** The playback's status line: "Your take with Tavi's part." */
export const playbackStatus = (v: Voice): string =>
  `Your take with ${partName(v)}.`

/** The staffs' words: what they hold, and whose part is whose once a voice is chosen. */
export function scoreWords(v: Voice | null): string {
  const both = "The song's bars 1 to 8 on two staffs, Tavi's part above Merc's"
  if (v === null) return `${both}.`
  return `${both}: yours, ${singerOf(v)}'s, in amber, breathing after bars 2, 4 and 6.`
}
