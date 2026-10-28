// ============================================================
// Merc's lines, and the room's own words — everything the Ear Lab with
// Merc says that the drills did not already say, in one place.
//
// The drills keep their words: a prompt, a verdict and a reading are
// said exactly as the web says them. These are Merc's: the line on the
// bench tied to its one action, the one over a plate, and the few the
// room needs that no drill had (ending a run, the sound stopping, the
// sealed protocol, a day's three done). Dry and warm. No exclamation
// marks, no streak headlines, no "three for three": he says what
// happened and what is next, and leaves the counting to the numbers.
// ============================================================

import type { FacultyId } from '@/lib/ear/drills'

// ── The bench ───────────────────────────────────────────────────

/** Today's state, as the bench and Merc read it. */
export interface TodayState {
  /** Segments not yet run today. */
  left: number
  /** The next segment's drill, by name. */
  next: string | null
  /** Nothing measured anywhere yet. */
  firstRun: boolean
}

/** Over the bench: one line, tied to the one filled button. */
export function benchLine(today: TodayState): string {
  if (today.firstRun) return "New here? Start with today's three."
  if (today.next === null) return 'Done for today. The stations stay open.'
  if (today.left === 1) return `One left. ${today.next}.`
  if (today.left === 2) return `Two left. ${today.next} next?`
  return `Three short ones today. ${today.next} first?`
}

/** The bench headline before anything is measured. */
export const FIRST_RUN_HEADLINE = {
  lead: 'No readings yet.',
  rest: "Today's three make the first.",
}

/** Under the glass. */
export function glassCaption(args: {
  sealed: number | null
  sealedOn: string | null
  estimate: number | null
}): string {
  if (args.sealed === null && args.estimate === null) {
    return 'A sealed calibration marks the glass: your Mercury Index.'
  }
  const sealed =
    args.sealed === null
      ? 'Not sealed yet'
      : `Sealed ${args.sealedOn ?? ''}`.trim()
  return args.estimate === null
    ? sealed
    : `${sealed} · practice estimate ${args.estimate}, not marked`
}

/** Today's one filled button. */
export function startLabel(args: { name: string; firstRun: boolean }): {
  label: string
  sub: string
} {
  return args.firstRun
    ? { label: `Start with ${args.name}`, sub: 'about a minute' }
    : { label: `Start ${args.name}`, sub: 'short run' }
}

/** "1st day at the bench": days with a finished three, counted, never
 *  a streak. */
export function benchDays(day: number): string {
  const rem100 = day % 100
  const rem10 = day % 10
  const suffix =
    rem100 >= 11 && rem100 <= 13
      ? 'th'
      : rem10 === 1
        ? 'st'
        : rem10 === 2
          ? 'nd'
          : rem10 === 3
            ? 'rd'
            : 'th'
  return `${day}${suffix} day at the bench`
}

/** The task, in a few words: today's rows and the station rows. */
export const TASK: Readonly<Record<string, string>> = {
  hairline: 'Which tone is higher',
  'beat-hunt': 'Which pair is beating',
  home: 'Name the degree',
  gravity: 'Any of the twelve over a key',
  'the-pull': 'Which note leans harder',
  cadence: 'Name the progression',
  bassline: 'Tap the roots back in order',
  'the-grid': 'Which click was off',
  drift: 'Did the tempo hold, gain or lose',
  pulse: 'Tap the call back',
  chart: 'Tap a written bar at sight',
  subdivide: 'Name the metre',
  leap: 'Name the interval',
  contour: 'Up, down or level',
  echo: 'Tap the phrase back',
  span: 'How many notes hold',
  stack: "Name the chord's quality",
  'desk-colour': 'The mixing desk, on your songs',
}

/** Each station's line on its sheet. */
export const STATION_LINE: Record<FacultyId, string> = {
  resolution: 'Hairline is the finest ruler on the bench. Start there.',
  function: 'Home carries into real songs. Start there.',
  shape: 'Leap names the distance. Contour only asks which way.',
  colour:
    'Stack is one chord, Cadence a few in a row. The Desk wants a song of yours.',
  time: 'The Grid is pure listening. The rest want your taps.',
  wild: 'Your own songs, read for the notes your voice lands on.',
}

/** What a station measures, under its title. */
export const STATION_MEASURES: Record<FacultyId, string> = {
  resolution: 'How small a difference your ear still hears.',
  function: 'Where a note sits in its key, and where it wants to go.',
  shape: 'The distance and the direction between notes.',
  colour: 'What chords sound like, alone and in a row, and what a mix does.',
  time: 'Where a beat lands, and how steadily.',
  wild: 'The same hearing, on the songs you sing.',
}

/** The Field Book with nothing in it. */
export const FIELD_BOOK_EMPTY =
  'No songs yet. Import one in the Karaoke room and its page appears here.'

/** The Ear Report's line wherever it is offered. */
export const REPORT_LINE =
  'Which sounds your ear mixes up, and how each faculty has moved.'

// ── The drill room ──────────────────────────────────────────────

/** The mode line under the drill's name. */
export function modeWords(
  run: 'practice' | 'rated' | 'sealed',
  short: boolean,
): string {
  if (run === 'sealed') return 'sealed calibration'
  if (short) return "today's short run"
  return run === 'rated' ? 'rated run' : 'practice run'
}

/** A seal's tracks on its plate, each by its letter in track order: "A
 *  9.4 · B 10.2 · C 9.9", and a track that found no threshold said so
 *  in its place rather than closing the gap. */
export function tracksLine(
  values: ReadonlyArray<number | null>,
  format: (value: number) => string,
): string {
  return values
    .map((value, i) => {
      const letter = String.fromCharCode(65 + i)
      return `${letter} ${value === null ? 'no reading' : format(value)}`
    })
    .join(' · ')
}

/** The pinned row's right side, before an answer, when Hear it again
 *  is held back. */
export function onceLines(run: 'rated' | 'sealed'): readonly string[] {
  return [
    run === 'sealed' ? 'Calibration plays once.' : 'Rated runs play once.',
    'Replays open after you answer.',
  ]
}

const NUMBER_WORDS = [
  'no',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
]

function counted(count: number, noun: string): string {
  const word = NUMBER_WORDS[count] ?? String(count)
  return `${word} ${noun}${count === 1 ? '' : 's'}`
}

/** Close's question, mid-run. */
export function exitWords(progress: { count: number; noun: string } | null): {
  title: string
  body: string
  leave: string
  stay: string
} {
  const where =
    progress !== null && progress.count > 0
      ? `You are ${counted(progress.count, progress.noun)} in. `
      : ''
  return {
    title: 'End the run?',
    body: `${where}Nothing from this run is kept, and Today stays as it was.`,
    leave: 'End the run',
    stay: 'Keep going',
  }
}

/** Why the sound stopped. */
export type SoundStop = 'headphones' | 'route' | 'away' | 'interrupted'

export function soundStoppedWords(args: {
  cause: SoundStop
  /** A question was sounding: it plays again from its start. */
  voided: boolean
  /** The sound now comes from the phone's own speaker. */
  onSpeaker: boolean
  /** The question is two sounds (Hairline's pair). */
  pair: boolean
}): { title: string; cause: string; merc: string; body: string } {
  const cause = {
    headphones: 'Headphones disconnected',
    route: 'The sound moved to another output',
    away: 'Mercury Pitch went to the background',
    interrupted: 'Another sound took over',
  }[args.cause]
  return {
    title: 'The sound stopped',
    cause: `${cause} · the run is paused`,
    merc: args.voided
      ? `I'll wait. This ${args.pair ? 'pair' : 'one'} plays again from the start.`
      : "I'll wait. Nothing was lost.",
    body: `Your answers so far are kept.${
      args.onSpeaker
        ? ' Resume plays through the phone speaker; headphones give a truer reading.'
        : ''
    }`,
  }
}

/** Calibration's "before you start". */
export function calibrationBefore(args: {
  pair: boolean
  estimate: number | null
  sealed: number | null
}): {
  title: string
  sub: string
  merc: string
  terms: ReadonlyArray<{ head: string; line: string }>
  later: string
  begin: string
} {
  const one = args.pair ? 'pair' : 'question'
  return {
    title: 'Calibration',
    sub: 'Sealed. The only reading that marks the glass.',
    merc: `Find a quiet spot. Each ${one} plays once.`,
    terms: [
      {
        head: 'Three staircases, shuffled together',
        line: 'About 50 questions, about three minutes',
      },
      {
        head: 'No hints, no replays first',
        line: `After you answer, you can hear the ${one} again.`,
      },
      {
        head: 'Headphones help',
        line: 'A phone speaker blurs the finest gaps.',
      },
      {
        head: 'It marks the glass',
        line:
          args.estimate === null
            ? 'This seals where you are now.'
            : `Practice estimates ${args.estimate}. This seals where you are now.`,
      },
      {
        head: 'Stop whenever you like',
        line:
          args.sealed === null
            ? 'Nothing is kept until the end. The glass stays unmarked.'
            : `Nothing is kept until the end. The glass stays at ${args.sealed}.`,
      },
    ],
    later: 'Not now',
    begin: 'Begin calibration',
  }
}

// ── Plates ──────────────────────────────────────────────────────

/** What a drill's number means, under it on the plate. */
export const MEANING: Readonly<Record<string, string>> = {
  hairline: 'The finest difference your ear still resolves.',
  'beat-hunt': 'The faintest beating your ear still catches.',
  'the-grid': 'The smallest timing flaw your ear still catches.',
  drift: 'The smallest change of tempo you still catch.',
  span: 'How many notes your ear holds at once.',
  'desk-colour': 'The smallest boost you still place.',
  'desk-weight': 'The smallest weight you still hear added.',
  home: 'How surely you place a note in its key.',
  gravity: 'How surely you place any note over a key.',
  'the-pull': 'How surely you feel where a note wants to go.',
  cadence: 'How surely you name a progression by ear.',
  bassline: 'How surely you follow the roots under a song.',
  leap: 'How surely you name the distance between two notes.',
  contour: 'How surely you hear which way a line moves.',
  echo: 'How surely you hold a phrase and give it back.',
  stack: "How surely you hear a chord's quality.",
  pulse: 'How cleanly you give a rhythm back.',
  chart: 'How cleanly you tap a written rhythm.',
  subdivide: 'How surely you hear the metre.',
}

export const INDEX_MEANING = 'Your ear, in a number that cannot flatter you.'

/** "Finer than last time (11.2 ¢)": a reading against the one before. */
export function comparedLine(args: {
  value: number
  previous: number | null
  lowerIsBetter: boolean
  format: (value: number) => string
  unitShort: string
}): string {
  if (args.previous === null) return 'Your first reading here'
  const was = `${args.format(args.previous)} ${args.unitShort.trim()}`.trim()
  if (args.format(args.value) === args.format(args.previous)) {
    return `Same as last time (${was})`
  }
  const better = args.lowerIsBetter
    ? args.value < args.previous
    : args.value > args.previous
  if (args.lowerIsBetter) {
    return better
      ? `Finer than last time (${was})`
      : `Not as fine as last time (${was})`
  }
  return better
    ? `More than last time (${was})`
    : `Fewer than last time (${was})`
}

/** Under a reading's number: which way is better. */
export function directionWord(lowerIsBetter: boolean): string {
  return lowerIsBetter ? 'lower is finer' : 'higher is better'
}

/** The rating's move against the one the run found. */
export function ratingMoveLine(rating: number, before: number): string {
  if (rating > before) return `Up ${rating - before} from ${before}`
  if (rating < before) return `Down ${before - rating} from ${before}`
  return `Same as before, ${before}`
}

/** "12 rounds · 9 named · no replays". */
export function roundsLine(
  rounds: number,
  right: number,
  word: string,
): string {
  return `${rounds} round${rounds === 1 ? '' : 's'} · ${right} ${word} · no replays`
}

/** "14 questions · 4 turns · 1 replay". */
export function staircaseStats(
  trials: number,
  turns: number,
  replays: number,
): string {
  const replayWord =
    replays === 0
      ? 'no replays'
      : `${replays} replay${replays === 1 ? '' : 's'}`
  return `${trials} question${trials === 1 ? '' : 's'} · ${turns} turn${
    turns === 1 ? '' : 's'
  } · ${replayWord}`
}

export function timesWord(count: number): string {
  if (count === 1) return 'once'
  if (count === 2) return 'twice'
  return `${counted(count, 'time')}`
}

/** Over a threshold plate. */
export function thresholdPlateLine(args: {
  value: number | null
  shown: string
  unit: string
  previous: number | null
  lowerIsBetter: boolean
}): string {
  if (args.value === null)
    return 'Nothing to read yet. Start again when you like.'
  const head = `${args.shown} ${args.unit}.`
  if (args.previous === null) return `${head} A first reading.`
  if (args.value === args.previous) return `${head} Steady.`
  const better = args.lowerIsBetter
    ? args.value < args.previous
    : args.value > args.previous
  if (!better) return `${head} One run is weather; the trend is what counts.`
  return args.lowerIsBetter
    ? `${head} Finer than last time.`
    : `${head} More than last time.`
}

/** Over a rated plate. */
export function ratingPlateLine(args: {
  rating: number
  before: number
  rounds: number
  slip: { expected: string; answered: string; count: number } | null
}): string {
  if (args.rounds === 0) return 'Nothing kept. Start again when you like.'
  const delta = args.rating - args.before
  const head =
    delta > 0
      ? `${args.rating}, up ${delta}.`
      : delta < 0
        ? `${args.rating}, down ${-delta}. Ratings breathe.`
        : `${args.rating}, holding.`
  if (args.slip === null) return head
  return `${head} ${args.slip.expected} slipped to ${args.slip.answered} ${timesWord(args.slip.count)}.`
}

export function sealedPlateLine(index: number): string {
  return `The glass is marked: ${index}.`
}

/** "Up 8 from 243, sealed 21 Oct", or a first mark. */
export function sealedMoveLine(
  index: number,
  previous: { index: number; on: string } | null,
): string {
  if (previous === null) return 'The first mark on the glass'
  return `${ratingMoveLine(index, previous.index)}, sealed ${previous.on}`
}

export const SEALED_SMALL_PRINT =
  'Practice moves the faint line. This mark stays until you calibrate again.'

// ── The day's three, done ──────────────────────────────────────

export const TODAY_DONE = {
  headline: 'All three done.',
  merc: 'Three readings in. Same time tomorrow?',
}

const ORDINAL_WORDS = [
  'First',
  'Second',
  'Third',
  'Fourth',
  'Fifth',
  'Sixth',
  'Seventh',
  'Eighth',
  'Ninth',
  'Tenth',
  'Eleventh',
]

/** "Seventh orb lit: First rhythm take." */
export function orbLine(position: number, label: string): string {
  const word = ORDINAL_WORDS[position - 1] ?? `Orb ${position}`
  return `${word} orb lit: ${label}.`
}
