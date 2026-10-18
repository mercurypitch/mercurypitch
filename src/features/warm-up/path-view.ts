// ============================================================
// What the Warm-up path shows: its state, each stop and the words
// ============================================================
//
// Pure: today's run (routine.ts), the last move (the stop just finished or
// skipped, in memory: warm-up-store.ts) and whether a run may start (the
// free run, N3) in; the path's view out. The screen (WarmUpPath.tsx) draws
// it and runs the motion between views.
//
//   start     a fresh run: "3 min", the first stop next, "Start warm-up"
//   between   back from a stop: its card ("Lip roll: 86% lit", Again),
//             then Skip and "Next: Ng slides", which counts down
//   resume    the same day after leaving halfway, or after a restart: "1
//             of 4 today", results under the names, "Next: Long note" (N4)
//   end       the run has just reached its end with a stop finished: the
//             titles "Warmed up" and "4 of 4 today", every result under its
//             stop's name, Done and Sing a song (§5.8)
//   done      opened again the same day once warmed up: "Warmed up
//             today", Warm up again and Sing a song (§5.9)
//   locked    the Warm-up's free run is used: the first visit's path, and a
//             padlocked "Warm up with Premium" (N3, pw-free). Only once the
//             gate exists (the flip); no build locks it today
//
// The stops are the plan's, any number of them in any order (owner,
// pw-stops): a room's name and glyph come from its id, and the song stop
// says "Your song".

import { EXERCISE_ECHO_STARS, EXERCISE_LIP_ROLL_BAY, EXERCISE_LONG_NOTE_LANTERN, EXERCISE_NG_SLIDES_BRIDGE, } from '@/lib/domain/exercise-contracts'
import type { ExerciseLevel } from '@/stores/exercise-level'
import type { MercSpot } from './path-layout'
import type { StopMark, WarmUpDay } from './routine'
import { atEnd, nextStop, tally } from './routine'
import type { WarmUpRoomId, WarmUpStop } from './warm-up-plan'
import { isRoomStop } from './warm-up-plan'
import type { LastMove } from './warm-up-store'

export type PathState =
  | 'start'
  | 'between'
  | 'resume'
  | 'end'
  | 'done'
  | 'locked'

/** The orb's look: one sprite each (art/warm-stop-*.webp). */
export type OrbState = 'waiting' | 'next' | 'done' | 'lit'

/** The glyph in the orb: one per room, and the song's notes. */
export type StopGlyph = 'wave' | 'arch' | 'lantern' | 'stars' | 'notes'

/** A room's name on the path, as its card in the picker names it. */
const ROOM_NAMES: Record<WarmUpRoomId, string> = {
  [EXERCISE_LIP_ROLL_BAY]: 'Lip roll',
  [EXERCISE_NG_SLIDES_BRIDGE]: 'Ng slides',
  [EXERCISE_LONG_NOTE_LANTERN]: 'Long note',
  [EXERCISE_ECHO_STARS]: 'Echo',
}

const ROOM_GLYPHS: Record<WarmUpRoomId, StopGlyph> = {
  [EXERCISE_LIP_ROLL_BAY]: 'wave',
  [EXERCISE_NG_SLIDES_BRIDGE]: 'arch',
  [EXERCISE_LONG_NOTE_LANTERN]: 'lantern',
  [EXERCISE_ECHO_STARS]: 'stars',
}

/** The words the path says, outside the stops' names. */
export const PATH_WORDS = {
  song: 'Your song',
  start: 'Start warm-up',
  skipped: 'Skipped',
  skip: 'Skip',
  again: 'Again',
  done: 'Done',
  sing: 'Sing a song',
  warmUpAgain: 'Warm up again',
  warmedUp: 'Warmed up',
  warmedUpToday: 'Warmed up today',
  premium: 'Warm up with Premium',
  freeUsed: "You've used your free warm-up.",
  stay: 'Stay here',
  stops: 'Warm-up stops',
} as const

/**
 * The level pill's lines on the path (pw-level: the path carries the
 * level, the rooms hide theirs in the Warm-up): what each level asks across
 * the four stops, from the rooms' own lines.
 */
export const WARM_UP_LEVEL_LINES: Readonly<Record<ExerciseLevel, string>> = {
  learning:
    'Slow waves and slides with plenty of room, more room around the long note, and three slow notes a phrase in Echo.',
  singer:
    'Steady waves and slides, a light vibrato on the long note, and four notes a phrase in Echo.',
  professional:
    'Quick waves and slides with no notes in the breaths, a near-straight long note, and five quick notes a phrase in Echo.',
}

/** "Next: Ng slides" */
export function nextLabel(name: string): string {
  return `Next: ${name}`
}

/** "1 of 4 today" */
export function todayLabel(done: number, rooms: number): string {
  return `${done} of ${rooms} today`
}

/** "3 min" */
export function minutesLabel(minutes: number): string {
  return `${minutes} min`
}

/** What a screen reader hears of the countdown, once. */
export function countdownSaid(name: string, seconds: number): string {
  return `${nextLabel(name)} in ${seconds} seconds. Choose ${PATH_WORDS.stay} to wait.`
}

export function stopName(stop: WarmUpStop): string {
  return isRoomStop(stop) ? ROOM_NAMES[stop.id] : PATH_WORDS.song
}

function stopGlyph(stop: WarmUpStop): StopGlyph {
  return isRoomStop(stop) ? ROOM_GLYPHS[stop.id] : 'notes'
}

export interface StopView {
  readonly index: number
  readonly name: string
  readonly glyph: StopGlyph
  readonly orb: OrbState
  /** Under the name: the result ("86% lit"), "Skipped", or nothing. */
  readonly line: string | null
  /** A screen reader's reading: "Lip roll, done, 86% lit". */
  readonly said: string
  /** The song stop: at the end it opens what Sing a song opens. */
  readonly song: boolean
}

/** The card between stops: the stop just finished or skipped. */
export interface PathCard {
  /** "Lip roll: 86% lit", or "Ng slides skipped". */
  readonly line: string
  /** Again runs this stop once more; null for a skipped one. */
  readonly again: number | null
}

export interface PathView {
  readonly state: PathState
  readonly stops: readonly StopView[]
  /** The stop Start, Next and the countdown open; null at the end. */
  readonly next: number | null
  /** The chip under the bar; null between stops and at the end. */
  readonly chip: string | null
  /** The end's second title: "4 of 4 today". */
  readonly today: string
  readonly card: PathCard | null
  /** Where Merc stands once the view has settled. */
  readonly merc: MercSpot
}

export interface PathInput {
  readonly day: WarmUpDay
  readonly last: LastMove | null
  /** A run may start: the Warm-up's free run is not used (N3). */
  readonly canStart: boolean
  /** The chip's estimate at the singer's level (estimate.ts). */
  readonly minutes: number
}

/** The last move still describes the run: its stop is marked as it says. */
function liveMove(day: WarmUpDay, last: LastMove | null): LastMove | null {
  if (last === null) return null
  return day.marks[last.index]?.state === last.state ? last : null
}

export function pathState(input: PathInput): PathState {
  const { day } = input
  const { done, skipped } = tally(day)
  const last = liveMove(day, input.last)
  if (atEnd(day) && done > 0) return last === null ? 'done' : 'end'
  if (done + skipped === 0) return input.canStart ? 'start' : 'locked'
  return last === null ? 'resume' : 'between'
}

function orbOf(
  mark: StopMark | undefined,
  state: PathState,
  isNext: boolean,
): OrbState {
  const ended = state === 'end' || state === 'done'
  if (mark?.state === 'done') return ended ? 'lit' : 'done'
  if (isNext && state !== 'locked') return 'next'
  return 'waiting'
}

function lineOf(mark: StopMark | undefined): string | null {
  if (mark?.state === 'done') return mark.line
  if (mark?.state === 'skipped') return PATH_WORDS.skipped
  return null
}

const SAID_STATE: Record<OrbState, string> = {
  waiting: 'waiting',
  next: 'next',
  done: 'done',
  lit: 'done',
}

function stopView(
  day: WarmUpDay,
  state: PathState,
  next: number | null,
  index: number,
): StopView {
  const stop = day.plan.stops[index]!
  const mark = day.marks[index]
  const song = !isRoomStop(stop)
  const ended = state === 'end' || state === 'done'
  const orb = song && ended ? 'lit' : orbOf(mark, state, index === next)
  const line = song ? null : lineOf(mark)
  const word = mark?.state === 'skipped' ? 'skipped' : SAID_STATE[orb]
  const name = stopName(stop)
  return {
    index,
    name,
    glyph: stopGlyph(stop),
    orb,
    line,
    said: [
      name,
      word,
      ...(line === null || line === PATH_WORDS.skipped ? [] : [line]),
    ].join(', '),
    song,
  }
}

function cardOf(day: WarmUpDay, last: LastMove | null): PathCard | null {
  if (last === null) return null
  const stop = day.plan.stops[last.index]
  const mark = day.marks[last.index]
  if (stop === undefined || mark === undefined) return null
  const name = stopName(stop)
  if (mark.state === 'done') {
    return { line: `${name}: ${mark.line}`, again: last.index }
  }
  return { line: `${name} skipped`, again: null }
}

function chipOf(input: PathInput, state: PathState): string | null {
  const { done, rooms } = tally(input.day)
  switch (state) {
    case 'start':
    case 'locked':
      return minutesLabel(input.minutes)
    case 'resume':
      return todayLabel(done, rooms)
    case 'done':
      return PATH_WORDS.warmedUpToday
    default:
      return null
  }
}

/** The song stop, or the top stop of a plan without one: Merc's at the end. */
function topIndex(day: WarmUpDay): number {
  return day.plan.stops.length - 1
}

function mercOf(
  day: WarmUpDay,
  state: PathState,
  next: number | null,
): MercSpot {
  if (state === 'end' || state === 'done') {
    return { at: 'on', index: topIndex(day) }
  }
  if (state === 'start' || state === 'locked' || next === null) {
    return { at: 'floor' }
  }
  return { at: 'beside', index: next }
}

export function pathView(input: PathInput): PathView {
  const { day } = input
  const state = pathState(input)
  const next = nextStop(day)
  const { done, rooms } = tally(day)
  return {
    state,
    stops: day.plan.stops.map((_, i) => stopView(day, state, next, i)),
    next: state === 'end' || state === 'done' ? null : next,
    chip: chipOf(input, state),
    today: todayLabel(done, rooms),
    card: state === 'between' ? cardOf(day, liveMove(day, input.last)) : null,
    merc: mercOf(day, state, next),
  }
}
