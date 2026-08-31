// ============================================================
// wild — the Field Book's items, read from a song the user separated.
//
// A song reaches the Ear Lab as three readings the app already knows
// how to make: the vocal stem's notes (midi-generator's detectNotes),
// the key those notes imply (detectKeyFromNotes) and the chords under
// them (NNLS chroma → detectChords). This is the pure part: it turns
// those readings into the three kinds of item In The Wild asks about,
// every note and root named as a degree of the song's own key —
// do-based, so a minor song's third is Me and its seventh Te, the way
// Gravity names them. Nothing here touches audio or stores.
//
// The items are the user's own song, not an authored bank: their
// seeds only order the picking and are never refined, and they rate
// on the Field Book's own tracks, never the Column.
// ============================================================

import type { EarBankItem } from './banks'
import type { IdentificationDrill } from './drills'
import { findIdentificationDrill } from './drills'
import { HOME_DEGREES } from './item-bank'

export type WildMode = 'major' | 'minor'

export interface WildKey {
  /** 0 = C … 11 = B. */
  tonicPc: number
  mode: WildMode
  /** The app's key name, e.g. 'F#'. */
  keyName: string
}

export interface WildNote {
  midi: number
  startS: number
  endS: number
}

export interface WildChord {
  rootPc: number
  startS: number
  endS: number
}

export interface WildHomeItem {
  kind: 'home'
  itemId: string
  startS: number
  endS: number
  degree: number
  midi: number
}

export interface WildEchoItem {
  kind: 'echo'
  itemId: string
  startS: number
  endS: number
  degrees: number[]
  midis: number[]
  /** Each note's onset, seconds after startS — the chain lights on it. */
  onsetsS: number[]
}

export interface WildBasslineItem {
  kind: 'bassline'
  itemId: string
  startS: number
  endS: number
  fromDegree: number
  toDegree: number
  /** Seconds after startS at which the root moves. */
  switchS: number
}

export type WildItem = WildHomeItem | WildEchoItem | WildBasslineItem
export type WildKind = WildItem['kind']

export interface WildBook {
  sessionId: string
  key: WildKey
  home: WildHomeItem[]
  echo: WildEchoItem[]
  bassline: WildBasslineItem[]
}

export const WILD_LIMITS = {
  /** A landing is a note held at least this long. */
  homeHoldS: 0.45,
  /** The excerpt before a landing, and the grace after it. */
  homeLeadS: 2.5,
  homeTailS: 0.15,
  /** Notes closer than this belong to one phrase. */
  phraseGapS: 0.5,
  phraseMinNoteS: 0.12,
  phraseMin: 3,
  phraseMax: 6,
  phraseLeadS: 0.3,
  phraseTailS: 0.25,
  /** Both chords of a root motion must hold this long. */
  chordMinS: 0.6,
  /** How much of each chord the excerpt plays. */
  chordLeadS: 2,
  chordTailS: 2,
  /** Items kept per kind, spread across the song. */
  perKind: 24,
} as const

const MAJOR_STEPS: readonly number[] = [0, 2, 4, 5, 7, 9, 11]
const MINOR_STEPS: readonly number[] = [0, 2, 3, 5, 7, 8, 10]

const NAME_TO_PC: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  'E#': 5,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
  Cb: 11,
  'B#': 0,
}

export function pitchClassOfName(name: string): number | null {
  const pc = NAME_TO_PC[name.trim()]
  return pc === undefined ? null : pc
}

export function scaleSteps(mode: WildMode): readonly number[] {
  return mode === 'major' ? MAJOR_STEPS : MINOR_STEPS
}

/** The degree (1..7) a pitch class is in the key, or null off the scale. */
export function degreeOfPitchClass(pc: number, key: WildKey): number | null {
  const rel = (((pc - key.tonicPc) % 12) + 12) % 12
  const index = scaleSteps(key.mode).indexOf(rel)
  return index === -1 ? null : index + 1
}

export function degreeOfMidi(midi: number, key: WildKey): number | null {
  return degreeOfPitchClass(((Math.round(midi) % 12) + 12) % 12, key)
}

const MAJOR_NUMERALS = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']
const MINOR_NUMERALS = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII']
const MAJOR_SOLFEGE = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Ti']
const MINOR_SOLFEGE = ['Do', 'Re', 'Me', 'Fa', 'Sol', 'Le', 'Te']

export function numeralOf(degree: number, mode: WildMode): string {
  const table = mode === 'major' ? MAJOR_NUMERALS : MINOR_NUMERALS
  return table[Math.min(7, Math.max(1, Math.round(degree))) - 1]
}

export function solfegeOfDegree(degree: number, mode: WildMode): string {
  const table = mode === 'major' ? MAJOR_SOLFEGE : MINOR_SOLFEGE
  return table[Math.min(7, Math.max(1, Math.round(degree))) - 1]
}

export function solfegeOfPhrase(
  degrees: readonly number[],
  mode: WildMode,
): string {
  return degrees.map((degree) => solfegeOfDegree(degree, mode)).join(' ')
}

export function keyLabel(key: WildKey): string {
  return `${key.keyName} ${key.mode}`
}

/** Up to `limit` items, evenly spaced through the list, order kept —
 *  a song's verse and chorus both get asked about. */
export function spreadAcross<T>(items: readonly T[], limit: number): T[] {
  if (items.length <= limit) return [...items]
  const picked: T[] = []
  for (let i = 0; i < limit; i++) {
    picked.push(items[Math.floor((i * items.length) / limit)])
  }
  return picked
}

const round3 = (value: number): number => Math.round(value * 1000) / 1000

/** Landings: notes held at least homeHoldS, on the scale. The excerpt
 *  is the lead-in ending on the note. */
export function homeItems(
  notes: readonly WildNote[],
  key: WildKey,
  sessionId: string,
): WildHomeItem[] {
  const held = notes.filter(
    (note) =>
      note.endS - note.startS >= WILD_LIMITS.homeHoldS &&
      degreeOfMidi(note.midi, key) !== null,
  )
  return spreadAcross(held, WILD_LIMITS.perKind).map((note, i) => ({
    kind: 'home',
    itemId: `wild:${sessionId}:home:${i}`,
    startS: round3(Math.max(0, note.endS - WILD_LIMITS.homeLeadS)),
    endS: round3(note.endS + WILD_LIMITS.homeTailS),
    degree: degreeOfMidi(note.midi, key) ?? 1,
    midi: Math.round(note.midi),
  }))
}

/** Phrases: runs of on-scale notes closer than phraseGapS, cut into
 *  pieces of three to six. A note off the scale ends the run. */
export function echoItems(
  notes: readonly WildNote[],
  key: WildKey,
  sessionId: string,
): WildEchoItem[] {
  const runs: WildNote[][] = []
  let run: WildNote[] = []
  const close = () => {
    if (run.length >= WILD_LIMITS.phraseMin) runs.push(run)
    run = []
  }
  for (const note of notes) {
    if (note.endS - note.startS < WILD_LIMITS.phraseMinNoteS) continue
    if (degreeOfMidi(note.midi, key) === null) {
      close()
      continue
    }
    if (
      run.length > 0 &&
      note.startS - run[run.length - 1].endS > WILD_LIMITS.phraseGapS
    ) {
      close()
    }
    run.push(note)
  }
  close()

  const pieces: WildNote[][] = []
  for (const whole of runs) {
    for (let i = 0; i < whole.length; i += WILD_LIMITS.phraseMax) {
      const piece = whole.slice(i, i + WILD_LIMITS.phraseMax)
      if (piece.length >= WILD_LIMITS.phraseMin) pieces.push(piece)
    }
  }

  return spreadAcross(pieces, WILD_LIMITS.perKind).map((piece, i) => ({
    kind: 'echo',
    itemId: `wild:${sessionId}:echo:${i}`,
    startS: round3(Math.max(0, piece[0].startS - WILD_LIMITS.phraseLeadS)),
    endS: round3(piece[piece.length - 1].endS + WILD_LIMITS.phraseTailS),
    degrees: piece.map((note) => degreeOfMidi(note.midi, key) ?? 1),
    midis: piece.map((note) => Math.round(note.midi)),
    onsetsS: piece.map((note) =>
      round3(
        note.startS - Math.max(0, piece[0].startS - WILD_LIMITS.phraseLeadS),
      ),
    ),
  }))
}

/** Root motions: two chords in a row with different on-scale roots,
 *  each held at least chordMinS. The excerpt plays the end of the
 *  first and the start of the second. */
export function basslineItems(
  chords: readonly WildChord[],
  key: WildKey,
  sessionId: string,
): WildBasslineItem[] {
  const motions: { from: WildChord; to: WildChord }[] = []
  for (let i = 1; i < chords.length; i++) {
    const from = chords[i - 1]
    const to = chords[i]
    if (from.rootPc === to.rootPc) continue
    if (from.endS - from.startS < WILD_LIMITS.chordMinS) continue
    if (to.endS - to.startS < WILD_LIMITS.chordMinS) continue
    if (
      degreeOfPitchClass(from.rootPc, key) === null ||
      degreeOfPitchClass(to.rootPc, key) === null
    ) {
      continue
    }
    motions.push({ from, to })
  }
  return spreadAcross(motions, WILD_LIMITS.perKind).map(({ from, to }, i) => ({
    kind: 'bassline',
    itemId: `wild:${sessionId}:bassline:${i}`,
    startS: round3(Math.max(from.startS, from.endS - WILD_LIMITS.chordLeadS)),
    endS: round3(Math.min(to.endS, to.startS + WILD_LIMITS.chordTailS)),
    fromDegree: degreeOfPitchClass(from.rootPc, key) ?? 1,
    toDegree: degreeOfPitchClass(to.rootPc, key) ?? 1,
    switchS: round3(
      to.startS - Math.max(from.startS, from.endS - WILD_LIMITS.chordLeadS),
    ),
  }))
}

export function buildWildBook(
  sessionId: string,
  notes: readonly WildNote[],
  chords: readonly WildChord[],
  key: WildKey,
): WildBook {
  const sorted = [...notes].sort((a, b) => a.startS - b.startS)
  return {
    sessionId,
    key,
    home: homeItems(sorted, key, sessionId),
    echo: echoItems(sorted, key, sessionId),
    bassline: basslineItems(chords, key, sessionId),
  }
}

// ── Bank items for the identification controller ──────────────

function homeSeed(degree: number): number {
  return HOME_DEGREES.find((entry) => entry.degree === degree)?.seed ?? 1100
}

function largestStep(degrees: readonly number[]): number {
  let largest = 0
  for (let i = 1; i < degrees.length; i++) {
    largest = Math.max(largest, Math.abs(degrees[i] - degrees[i - 1]))
  }
  return largest
}

/** The picker orders by seed; nothing ever refines these. */
export function wildBankItem(item: WildItem, mode: WildMode): EarBankItem {
  switch (item.kind) {
    case 'home':
      return {
        itemId: item.itemId,
        label: String(item.degree),
        name: solfegeOfDegree(item.degree, mode),
        seed: homeSeed(item.degree),
        payload: [item.degree],
      }
    case 'echo':
      return {
        itemId: item.itemId,
        label: item.degrees.join(' '),
        name: solfegeOfPhrase(item.degrees, mode),
        seed:
          850 +
          100 * (item.degrees.length - WILD_LIMITS.phraseMin) +
          40 * largestStep(item.degrees),
        payload: item.degrees,
      }
    case 'bassline':
      return {
        itemId: item.itemId,
        label: `${numeralOf(item.fromDegree, mode)}–${numeralOf(item.toDegree, mode)}`,
        name: `${numeralOf(item.fromDegree, mode)} to ${numeralOf(item.toDegree, mode)}`,
        seed: 950 + 50 * Math.abs(item.toDegree - item.fromDegree),
        payload: [item.fromDegree, item.toDegree],
      }
  }
}

// ── The Field Book's drills ───────────────────────────────────

export type WildTrack = 'wild-home' | 'wild-echo' | 'wild-bassline'
export const WILD_TRACKS: readonly WildTrack[] = [
  'wild-home',
  'wild-echo',
  'wild-bassline',
]

function wildDrill(
  baseId: string,
  id: WildTrack,
  name: string,
): IdentificationDrill {
  const base = findIdentificationDrill(baseId)
  if (base === undefined) throw new Error(`${baseId} missing from catalogue`)
  return { ...base, id, name, faculty: 'wild' }
}

/** The catalogue drills the three item kinds borrow their engine
 *  settings from, under the Field Book's own ids and faculty. Their
 *  ratings live on these ids and never reach the Column. */
export const WILD_DRILLS: Record<WildTrack, IdentificationDrill> = {
  'wild-home': wildDrill('home', 'wild-home', 'Home in the Wild'),
  'wild-echo': wildDrill('echo', 'wild-echo', 'Echo in the Wild'),
  'wild-bassline': wildDrill(
    'bassline',
    'wild-bassline',
    'Bassline in the Wild',
  ),
}
