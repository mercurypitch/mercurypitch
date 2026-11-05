// ============================================================
// Lesson 14 phrase flow — what Sing it offers next, as a pure rule
// ============================================================
//
// Sing it asks for one phrase twice (WEB-SPEC, Toys 4): take 1 as it comes,
// take 2 breathing after "star" with "star" swelling, each drawn over
// Merc's bands, recorded on the device and played back. From the comfort
// answer, the voice, whether sound and Web Audio are on, whether the
// browser can record, Move do, the takes so far (each: which take, whether
// it was Again's, whether it had voice, whether it was abandoned and
// whether its recording was kept), whether the takes were deleted, and the
// answers (the latest, and whether "Effortful" or "Uncomfortable" was ever
// given), this gives the panels, the controls, the lines and the Wrap's
// card, so every branch is unit-tested without a microphone
// (phrase-flow.test.ts, phrase-flow-walk.test.ts).
//
// The retry rules: a visit has at most three takes, every take counted,
// one with no voice and one abandoned too. Take 2 follows take 1 only after
// "Easy" or "Workable"; Again, a new take 2, at most once a visit, only
// after "Easy" or "Workable" on a take 2 and while fewer than three takes
// have been made. A take with no voice asks no feeling and its Start comes
// back while takes remain, leaving Again unused; so does an abandoned one,
// whose recording is discarded. Never a take after "Effortful" or
// "Uncomfortable": once either has been answered, no Start and no Again
// for the visit, and the takes already made stay to be played back or
// deleted. "Uncomfortable" takes the line under the chart away and shows
// the doctor lines. Both pick the rest card (`restAfterEffort`, as Lessons
// 6, 7 and 9 have it), and so does "Just listen today"; a visit with no
// microphone keeps the practice card, since singing along with nothing
// listening is no report of effort (Lesson 3's rule).
//
// A control the flow does not offer is absent, never disabled. An event the
// card cannot send in a state changes nothing, so the rule holds for events
// in any order. The flow writes nothing: only the voice and the warm-up's
// Skip are stored, by the card.

import type { Ending, Feeling } from '@/features/lessons/kit/comfort'
import { afterFeeling } from '@/features/lessons/kit/comfort'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import type { TakeId } from './song'

export type Comfort = 'sing' | 'listen'

/** At most three takes a visit, every take counted (FACTS 72). */
export const MAX_TAKES = 3

/**
 * The line for a take with too little voice: the kit's (kit/take.ts
 * `NOT_HEARD_PHRASE_LINE`), here so first paint carries no reader.
 */
export const NOT_HEARD_LINE = "We didn't hear the phrase that time."

/** A take as the flow counts it. */
export interface Take {
  readonly id: TakeId
  /** Again's new take 2. */
  readonly again: boolean
  /** It held enough voice to read as a phrase (1.5 s). */
  readonly voiced: boolean
  /** The page was left while it ran: discarded. */
  readonly abandoned: boolean
  /** Its recording is kept, to be played back. */
  readonly recorded: boolean
}

/** The take a Start begins: its number, and whether it is Again's. */
export interface NextTake {
  readonly id: TakeId
  readonly again: boolean
}

export interface PhraseVisit {
  readonly comfort: Comfort | null
  readonly voice: Voice | null
  /** A voice was stored when the visit began: the line over the choice says so. */
  readonly hadVoice: boolean
  /** The sound is on, so Merc's phrase and the count-in can be heard. */
  readonly sound: boolean
  /** The browser has Web Audio: without it nothing plays and nothing listens. */
  readonly webAudio: boolean
  /** The browser can record a take (MediaRecorder and one of the app's formats). */
  readonly canRecord: boolean
  /** The microphone was refused, missing, or its listener failed to load. */
  readonly noMic: boolean
  /** Move do, semitones from the voice's home do. */
  readonly shift: number
  readonly takes: readonly Take[]
  /** A take is under way, from its Start to its end. */
  readonly taking: NextTake | null
  /** The take is open and listening, after Merc's phrase and the count-in. */
  readonly listening: boolean
  /** The answer to the latest take with voice, or null while unanswered. */
  readonly feeling: Feeling | null
  /** "Uncomfortable" or "Effortful", once answered, for the rest of the visit. */
  readonly stopped: 'effortful' | 'uncomfortable' | null
  /** Delete your takes pressed. */
  readonly deleted: boolean
  /** Done for today pressed. */
  readonly done: boolean
}

/** The state a visit opens on: only the stored voice is known, never an earlier visit's comfort answer. */
export const openVisit = (o: {
  readonly voice: Voice | null
  readonly sound: boolean
  readonly webAudio: boolean
}): PhraseVisit => ({
  comfort: null,
  voice: o.voice,
  hadVoice: o.voice !== null,
  sound: o.sound,
  webAudio: o.webAudio,
  canRecord: true,
  noMic: false,
  shift: 0,
  takes: [],
  taking: null,
  listening: false,
  feeling: null,
  stopped: null,
  deleted: false,
  done: false,
})

export type PhraseEvent =
  | { readonly type: 'comfort'; readonly comfort: Comfort }
  | { readonly type: 'voice'; readonly voice: Voice }
  | { readonly type: 'sound'; readonly on: boolean }
  /** Known once the recorder loads: whether this browser records at all. */
  | { readonly type: 'recordable'; readonly can: boolean }
  | { readonly type: 'move'; readonly shift: number }
  /** A Start, or Again, pressed with sound on. */
  | { readonly type: 'begin' }
  /** Merc's phrase and the count-in are over: the take listens. */
  | { readonly type: 'listen' }
  /** The take ended: what it held. */
  | {
      readonly type: 'took'
      readonly voiced: boolean
      readonly abandoned: boolean
      readonly recorded: boolean
    }
  /** The sound turned off while Merc sang: no take is spent on a phrase the viewer could not hear. */
  | { readonly type: 'silenced' }
  /** The microphone was refused, missing, or its listener failed to load. */
  | { readonly type: 'nomic' }
  | { readonly type: 'feel'; readonly feeling: Feeling }
  | { readonly type: 'delete' }
  | { readonly type: 'done' }

/** The rest card after "Effortful" too, as Lessons 6, 7 and 9 have it (REQ-GVC-021). */
const AFTER_OPTIONS = { restAfterEffort: true } as const

const fine = (f: Feeling | null): boolean => f === 'easy' || f === 'workable'

/** The takes that were read: voiced, and not abandoned. */
const heardTakes = (s: PhraseVisit): readonly Take[] =>
  s.takes.filter((t) => t.voiced && !t.abandoned)

/** Singing is on offer: the comfortable answer, a voice, Web Audio and a microphone. */
export const singing = (s: PhraseVisit): boolean =>
  s.comfort === 'sing' && s.voice !== null && s.webAudio && !s.noMic

/** Again has made its take 2: one heard, from Again. */
const againUsed = (s: PhraseVisit): boolean =>
  heardTakes(s).some((t) => t.again)

/** The latest take, heard and answered "Easy" or "Workable". */
function answeredFine(s: PhraseVisit): Take | null {
  const last = s.takes.at(-1)
  return last !== undefined && last.voiced && !last.abandoned && fine(s.feeling)
    ? last
    : null
}

/** The take a Start would begin now, or null when none is offered. */
export function nextTake(s: PhraseVisit): NextTake | null {
  if (
    !singing(s) ||
    s.stopped !== null ||
    s.done ||
    s.deleted ||
    s.taking !== null ||
    s.takes.length >= MAX_TAKES
  )
    return null
  const last = s.takes.at(-1)
  if (last === undefined) return { id: 1, again: false }
  // no voice, or abandoned: the same Start comes back
  if (!last.voiced || last.abandoned) return { id: last.id, again: last.again }
  if (!fine(s.feeling)) return null
  if (last.id === 1) return { id: 2, again: false }
  return againUsed(s) ? null : { id: 2, again: true }
}

/** Every take this visit allows is made, and the last one needs no answer. */
function spent(s: PhraseVisit): boolean {
  const last = s.takes.at(-1)
  return (
    s.takes.length >= MAX_TAKES &&
    s.taking === null &&
    last !== undefined &&
    (!last.voiced || last.abandoned || s.feeling !== null)
  )
}

/** The playback stage: take 2 heard and answered, or no more takes will come. */
function reviewing(s: PhraseVisit): boolean {
  if (heardTakes(s).length === 0) return false
  if (s.stopped !== null || s.done || spent(s)) return true
  return heardTakes(s).some((t) => t.id === 2) && fine(s.feeling)
}

/** The events the card sends, each by its type. */
type EventOf<T extends PhraseEvent['type']> = Extract<PhraseEvent, { type: T }>

/** A take ended: counted, and a heard one asks afresh; one with no voice leaves the last answer. */
function took(s: PhraseVisit, e: EventOf<'took'>): PhraseVisit {
  if (s.taking === null) return s
  const voiced = e.voiced && !e.abandoned
  const take: Take = {
    ...s.taking,
    voiced: e.voiced,
    abandoned: e.abandoned,
    recorded: voiced && e.recorded,
  }
  return {
    ...s,
    takes: [...s.takes, take],
    taking: null,
    listening: false,
    feeling: voiced ? null : s.feeling,
  }
}

/** The question is showing and unanswered: after a heard take, once. */
function asking(s: PhraseVisit): boolean {
  const last = s.takes.at(-1)
  return (
    s.taking === null &&
    last !== undefined &&
    last.voiced &&
    !last.abandoned &&
    s.feeling === null
  )
}

function felt(s: PhraseVisit, e: EventOf<'feel'>): PhraseVisit {
  if (!asking(s)) return s
  const again = afterFeeling(e.feeling, AFTER_OPTIONS).again
  const stopped =
    e.feeling === 'uncomfortable'
      ? 'uncomfortable'
      : (s.stopped ?? (again ? null : 'effortful'))
  return { ...s, feeling: e.feeling, stopped }
}

function begun(s: PhraseVisit): PhraseVisit {
  const next = nextTake(s)
  return next === null || !s.sound
    ? s
    : { ...s, taking: next, listening: false }
}

/** No take is open, and the visit has made one. */
const between = (s: PhraseVisit): boolean =>
  s.taking === null && s.takes.length > 0

/** Do moves before and between takes, never during one or once the singing ends. */
const movable = (s: PhraseVisit): boolean =>
  s.taking === null && s.stopped === null && !s.done

const ON: {
  readonly [T in PhraseEvent['type']]: (
    s: PhraseVisit,
    e: EventOf<T>,
  ) => PhraseVisit
} = {
  comfort: (s, e) => (s.comfort === null ? { ...s, comfort: e.comfort } : s),
  voice: (s, e) =>
    s.comfort === null || s.taking !== null ? s : { ...s, voice: e.voice },
  sound: (s, e) => ({ ...s, sound: e.on }),
  recordable: (s, e) => ({ ...s, canRecord: e.can }),
  move: (s, e) => (movable(s) ? { ...s, shift: e.shift } : s),
  begin: begun,
  listen: (s) => (s.taking === null ? s : { ...s, listening: true }),
  took,
  silenced: (s) => ({ ...s, taking: null, listening: false }),
  nomic: (s) => ({ ...s, taking: null, listening: false, noMic: true }),
  feel: felt,
  delete: (s) => (between(s) && reviewing(s) ? { ...s, deleted: true } : s),
  // only where the card offers it, so the rule holds for events in any order
  done: (s) => (todayOf(s) ? { ...s, done: true } : s),
}

export function nextVisit(s: PhraseVisit, e: PhraseEvent): PhraseVisit {
  const on = ON[e.type] as (s: PhraseVisit, e: PhraseEvent) => PhraseVisit
  return on(s, e)
}

export type Panel =
  | 'comfort'
  | 'listen'
  | 'voice'
  | 'prepare'
  | 'live'
  | 'feel'
  | 'after'

/** The lines after an answer (LESSON.md, Sing it; Lesson 3's gentle and enough-for-today lines). */
export type Closing = 'next' | 'back' | 'drawn' | 'gentle' | 'enough'

/** Which control begins the next take: Start take 1, Start take 2, Again, or the same Start again. */
export type StartControl = 'start' | 'take2' | 'again' | 'retry'

/** The line under the chart: the take's reading, the not-heard line, or none. */
export type TakeLine = 'reading' | 'notHeard'

export interface PhraseView {
  readonly panels: readonly Panel[]
  /** Listening only: today, or with no microphone (or no Web Audio). */
  readonly listenWhy: 'listen' | 'nomic' | null
  /** Which of the voice choice's two lines shows. */
  readonly voiceLine: 'stored' | 'none'
  /** The warm-up, Your turn, the stop line and "What this does": the parts that ask for singing. */
  readonly singParts: boolean
  /** The can't-record line under "What this does". */
  readonly cantRecord: boolean
  readonly moveDo: boolean
  readonly mercPhrase: boolean
  /** The control that begins the next take, or null when none is offered. */
  readonly start: StartControl | null
  /** The words of that Start: "Start take 1", or "Start take 2" for the same Start again. */
  readonly startWord: string
  /** The hint beside the Start offered, or beside Play Merc's phrase. */
  readonly hint: 'silent' | 'noAudio' | null
  readonly answer: Feeling | null
  readonly closing: Closing | null
  readonly doctor: boolean
  readonly takeLine: TakeLine | null
  /** The playback controls: the takes whose recordings are kept. */
  readonly plays: readonly TakeId[]
  readonly del: boolean
  readonly today: boolean
  /** Take 2's plan on the chart: the breath after "star", and its swell in faint light. */
  readonly plan: boolean
  readonly card: Ending
  /** The status line, announced; null leaves it as it stands (Merc sings before a take listens). */
  readonly status: string | null
}

/** The status lines the spec words (Toys 4, states 6 and 7), and the series' for the rest. */
export const STATUS = {
  comfort: 'Before you sing: how is your voice today?',
  voiceSing: "Choose the voice you'll sing with.",
  voiceListen: 'Choose a voice: it picks the Merc who sings.',
  listen: "Just listening today: press Play Merc's phrase to hear it.",
  nomic:
    'No microphone? Sing along anyway: Merc sings the phrase first, and nothing listens.',
  noAudio: "This browser can't play sound here.",
  turn: 'Your turn: “Twinkle, twinkle, little star”, twice.',
  take1:
    "Take 1: sing the phrase when you're ready, and follow the bands as they light.",
  take2: 'Take 2: breathe, then sing through to “star”, and breathe after it.',
  left: 'That take stopped when you left, so it was not kept.',
  feel: 'How did that feel?',
  done: 'Done for today.',
  spent: "That's every take for this visit.",
  deleted: 'Your takes are deleted.',
} as const

/** The lines after an answer (LESSON.md, Sing it; FACTS 63). */
export const CLOSING: Readonly<Record<Closing, string>> = {
  next: 'Now take 2: breathe after “star”, and let “star” swell.',
  back: 'Two takes, one phrase. Play them back: where did each breathe? Did “star” grow and fade?',
  drawn:
    'Two takes, one phrase. Where did each breathe? Look for the gaps in your lines.',
  gentle: 'Keep it gentle: rest before you sing again.',
  enough:
    "Thanks for saying so. That's enough singing for today: rest your voice.",
}

/** The hints beside a Start or Play Merc's phrase (WEB-SPEC, Toys 4, states 5 and 10). */
export const HINT = {
  silent:
    "Sound is off, so nothing played. Turn sound on to hear Merc's phrase, then press Start.",
  noAudio: STATUS.noAudio,
} as const

function startOf(s: PhraseVisit, next: NextTake | null): StartControl | null {
  if (next === null) return null
  if (s.takes.length === 0) return 'start'
  const last = s.takes[s.takes.length - 1]
  if (!last.voiced || last.abandoned) return next.again ? 'again' : 'retry'
  return next.again ? 'again' : 'take2'
}

function closingOf(s: PhraseVisit): Closing | null {
  if (s.stopped !== null)
    return s.stopped === 'uncomfortable' ? 'enough' : 'gentle'
  if (s.deleted) return null
  // "Now take 2" only beside Start take 2: no line asks for a take the card cannot give
  if (answeredFine(s)?.id === 1 && nextTake(s)?.id === 2) return 'next'
  if (!reviewing(s) || !heardTakes(s).some((t) => t.id === 2)) return null
  return heardTakes(s).some((t) => t.recorded) ? 'back' : 'drawn'
}

function takeLineOf(s: PhraseVisit): TakeLine | null {
  const last = s.takes.at(-1)
  if (last === undefined || s.taking !== null || s.deleted) return null
  if (s.stopped === 'uncomfortable' || last.abandoned) return null
  return last.voiced ? 'reading' : 'notHeard'
}

/** The latest kept recording of each take, 1 then 2. */
function playsOf(s: PhraseVisit): TakeId[] {
  if (s.deleted || !reviewing(s)) return []
  const heard = heardTakes(s)
  return ([1, 2] as const).filter(
    (id) => heard.filter((t) => t.id === id).at(-1)?.recorded === true,
  )
}

/** The status before any take: the comfort check, the voice, listening only, or the briefing. */
function setUpStatus(s: PhraseVisit): string | null {
  if (s.comfort === null) return STATUS.comfort
  if (s.voice === null)
    return s.comfort === 'listen' ? STATUS.voiceListen : STATUS.voiceSing
  if (!s.webAudio) return STATUS.noAudio
  if (s.comfort === 'listen') return STATUS.listen
  return s.noMic ? STATUS.nomic : null
}

/** The status once the takes have begun: the take's words, its end, or what the card offers next. */
function takeStatus(s: PhraseVisit, closing: Closing | null): string | null {
  if (s.taking !== null)
    return s.listening ? STATUS[s.taking.id === 1 ? 'take1' : 'take2'] : null
  if (s.deleted) return STATUS.deleted
  if (s.done) return STATUS.done
  const last = s.takes.at(-1)
  if (last === undefined) return STATUS.turn
  if (last.abandoned) return STATUS.left
  if (!last.voiced) return NOT_HEARD_LINE
  if (closing !== null) return CLOSING[closing]
  return s.feeling === null ? STATUS.feel : STATUS.spent
}

function panelsOf(s: PhraseVisit, shown: boolean): Panel[] {
  if (s.comfort === null) return ['comfort']
  const open = s.taking === null
  const last = s.takes.at(-1)
  const heard = last !== undefined && last.voiced && !last.abandoned
  const panels: (Panel | false)[] = [
    (s.comfort === 'listen' || s.noMic || !s.webAudio) && 'listen',
    open && 'voice',
    shown && open && 'prepare',
    shown && 'live',
    open && heard && !s.deleted && 'feel',
    open && last !== undefined && 'after',
  ]
  return panels.filter((p): p is Panel => p !== false)
}

function listenWhyOf(s: PhraseVisit): PhraseView['listenWhy'] {
  if (s.comfort === 'listen') return 'listen'
  return s.comfort !== null && (s.noMic || !s.webAudio) ? 'nomic' : null
}

function hintOf(
  s: PhraseVisit,
  start: StartControl | null,
  listenOnly: boolean,
): PhraseView['hint'] {
  if (listenOnly) return s.webAudio ? null : 'noAudio'
  return start !== null && !s.sound ? 'silent' : null
}

/** Done for today: after a take with no voice or one abandoned, at the playback, or with the takes spent. */
function todayOf(s: PhraseVisit): boolean {
  const last = s.takes.at(-1)
  if (s.done || s.taking !== null || last === undefined) return false
  return reviewing(s) || !last.voiced || last.abandoned || spent(s)
}

export function phraseView(s: PhraseVisit): PhraseView {
  const sing = singing(s)
  const shown = s.comfort !== null && s.voice !== null
  const singingOn = sing && s.stopped === null && !s.done
  const next = nextTake(s)
  const start = startOf(s, next)
  const closing = closingOf(s)
  return {
    panels: panelsOf(s, shown),
    listenWhy: listenWhyOf(s),
    voiceLine: s.hadVoice ? 'stored' : 'none',
    singParts: singingOn,
    cantRecord: singingOn && !s.canRecord,
    moveDo: shown && s.stopped === null && !s.done,
    mercPhrase: shown,
    start,
    startWord: `Start take ${String(next?.id ?? 1)}`,
    hint: hintOf(s, start, shown && !sing),
    answer: s.feeling,
    closing,
    doctor: s.stopped === 'uncomfortable',
    takeLine: takeLineOf(s),
    plays: playsOf(s),
    del: !s.deleted && reviewing(s) && heardTakes(s).length > 0,
    today: todayOf(s),
    plan: s.taking?.id === 2 || next?.id === 2,
    card: s.comfort === 'listen' || s.stopped !== null ? 'rest' : 'practise',
    status: setUpStatus(s) ?? takeStatus(s, closing),
  }
}
