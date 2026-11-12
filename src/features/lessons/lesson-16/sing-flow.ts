// ============================================================
// Lesson 16 sing flow — what Sing it offers next, as a pure rule
// ============================================================
//
// Sing it reads two phrases from the page, each found from do (WEB-SPEC,
// Toys 6): Merc, or Tavi for the higher voice, sings the start, then a take
// listens while the cursor reader lights each next written note. From the
// comfort answer, the voice, whether sound and Web Audio are on, whether a
// microphone answered, the takes so far (each: which phrase it read,
// whether it had voice and whether it was abandoned) and the answers (the
// latest, whether "Effortful" or "Uncomfortable" was ever given, and
// whether Stop here was pressed), this gives the panels, the controls, the
// lines and the Wrap's card, so every branch is unit-tested without a
// microphone (sing-flow.test.ts).
//
// The retry rules (FACTS 50): a visit has at most three takes, every take
// counted, one with no voice, one with no steady note and one abandoned
// when the page was hidden. A take with no voice asks no feeling, and its
// Start again comes back while takes remain; so does an abandoned one. The
// second phrase follows the first only after "Easy" or "Workable", and
// never after Stop here; there is no Again for either phrase. Never a take
// after "Effortful" or "Uncomfortable": once either has been answered, no
// Start for the visit. "Uncomfortable" takes the lines and the pitch line
// away and shows the doctor lines. Both pick the rest card
// (`restAfterEffort`), and so does "Just listen today"; Stop here and a
// visit with no microphone keep the practice card, since neither reports
// effort (FACTS 49, 51).
//
// Play Merc's phrases shows only once the singing has ended, so the second
// phrase is never heard before it is read: after the second phrase's
// answer, Stop here, "Effortful" or "Uncomfortable", Just listen today, the
// visit's last take, or with no microphone. With no voice stored, nothing
// past the voice choice shows until one is chosen, because the voice picks
// who sings and the staff that shows.
//
// A control the flow does not offer is absent, never disabled. An event the
// card cannot send in a state changes nothing, so the rule holds for events
// in any order. The flow writes nothing: only the voice is stored, by the
// kit's voice choice.

import type { Ending, Feeling } from '@/features/lessons/kit/comfort'
import { afterFeeling } from '@/features/lessons/kit/comfort'
import type { Voice } from '@/features/lessons/kit/voice-choice'

export type Comfort = 'sing' | 'listen'

/** The two phrases: the tune Tavi sang, then a line never heard (FACTS 52). */
export type PhraseId = 1 | 2

/** At most three takes a visit, every take counted (FACTS 50). */
export const MAX_TAKES = 3

/** A take as the flow counts it. */
export interface Take {
  readonly phrase: PhraseId
  /** A voiced frame came within 8 s: the take was read. */
  readonly voiced: boolean
  /** The page was hidden while it ran. */
  readonly abandoned: boolean
}

export interface SingVisit {
  readonly comfort: Comfort | null
  readonly voice: Voice | null
  /** A voice was stored when the visit began: the line over the choice says so. */
  readonly hadVoice: boolean
  /** The sound is on, so the start can be heard. */
  readonly sound: boolean
  /** The browser has Web Audio: without it nothing plays and nothing listens. */
  readonly webAudio: boolean
  /** The microphone was refused, missing, or its listener failed to load. */
  readonly noMic: boolean
  readonly takes: readonly Take[]
  /** A Start is under way, from its press to the take's end: the phrase it reads. */
  readonly taking: PhraseId | null
  /** The start is over and the take listens. */
  readonly listening: boolean
  /** The answer to the latest take with voice, or null while unanswered. */
  readonly feeling: Feeling | null
  /** "Uncomfortable" or "Effortful", once answered, for the rest of the visit. */
  readonly stopped: 'effortful' | 'uncomfortable' | null
  /** Stop here pressed. */
  readonly halted: boolean
}

/** The state a visit opens on: only the stored voice is known, never an earlier visit's comfort answer. */
export const openVisit = (o: {
  readonly voice: Voice | null
  readonly sound: boolean
  readonly webAudio: boolean
}): SingVisit => ({
  comfort: null,
  voice: o.voice,
  hadVoice: o.voice !== null,
  sound: o.sound,
  webAudio: o.webAudio,
  noMic: false,
  takes: [],
  taking: null,
  listening: false,
  feeling: null,
  stopped: null,
  halted: false,
})

export type SingEvent =
  | { readonly type: 'comfort'; readonly comfort: Comfort }
  | { readonly type: 'voice'; readonly voice: Voice }
  | { readonly type: 'sound'; readonly on: boolean }
  /** A Start, or Start again, or Start phrase 2, pressed with sound on. */
  | { readonly type: 'begin' }
  /** The start is over: the take listens. */
  | { readonly type: 'listen' }
  /** The take ended: what it held. */
  | {
      readonly type: 'took'
      readonly voiced: boolean
      readonly abandoned: boolean
    }
  /** The sound turned off during the start: it ends with no take counted. */
  | { readonly type: 'silenced' }
  /** The microphone was refused, missing, or its listener failed to load. */
  | { readonly type: 'nomic' }
  | { readonly type: 'feel'; readonly feeling: Feeling }
  /** Stop here: no second phrase this visit. */
  | { readonly type: 'halt' }

/** The rest card after "Effortful" too, as Lessons 6, 7, 9 and 14 have it (REQ-GVC-021). */
const AFTER_OPTIONS = { restAfterEffort: true } as const

const fine = (f: Feeling | null): boolean => f === 'easy' || f === 'workable'

/** A take that was read: voiced, and not abandoned. */
const heard = (t: Take | undefined): boolean =>
  t !== undefined && t.voiced && !t.abandoned

/** Singing is on offer: the comfortable answer, a voice, Web Audio and a microphone. */
export const singing = (s: SingVisit): boolean =>
  s.comfort === 'sing' && s.voice !== null && s.webAudio && !s.noMic

/** The phrase a Start would read now, or null when none is offered. */
export function nextPhrase(s: SingVisit): PhraseId | null {
  if (
    !singing(s) ||
    s.stopped !== null ||
    s.halted ||
    s.taking !== null ||
    s.takes.length >= MAX_TAKES
  )
    return null
  const last = s.takes.at(-1)
  if (last === undefined) return 1
  // no voice, or abandoned: the same phrase's Start again comes back
  if (!heard(last)) return last.phrase
  if (!fine(s.feeling)) return null
  return last.phrase === 1 ? 2 : null
}

/** The feeling question shows, unanswered: after a heard take, once. */
function asking(s: SingVisit): boolean {
  return s.taking === null && heard(s.takes.at(-1)) && s.feeling === null
}

/** Every take this visit allows is made, and the last one needs no answer. */
function spent(s: SingVisit): boolean {
  const last = s.takes.at(-1)
  return (
    s.takes.length >= MAX_TAKES &&
    s.taking === null &&
    last !== undefined &&
    (!heard(last) || s.feeling !== null)
  )
}

/** The singing has ended for the visit: Play Merc's phrases may show. */
export function ended(s: SingVisit): boolean {
  if (s.voice === null || s.comfort === null) return false
  if (s.comfort === 'listen' || !s.webAudio || s.noMic) return true
  if (s.taking !== null) return false
  if (s.stopped !== null || s.halted || spent(s)) return true
  const last = s.takes.at(-1)
  return heard(last) && last?.phrase === 2 && fine(s.feeling)
}

/** The events the card sends, each by its type. */
type EventOf<T extends SingEvent['type']> = Extract<SingEvent, { type: T }>

/** A take ended: counted, and a heard one asks afresh; one with no voice leaves the last answer. */
function took(s: SingVisit, e: EventOf<'took'>): SingVisit {
  if (s.taking === null) return s
  const take: Take = {
    phrase: s.taking,
    voiced: e.voiced,
    abandoned: e.abandoned,
  }
  return {
    ...s,
    takes: [...s.takes, take],
    taking: null,
    listening: false,
    feeling: heard(take) ? null : s.feeling,
  }
}

function felt(s: SingVisit, e: EventOf<'feel'>): SingVisit {
  if (!asking(s)) return s
  const again = afterFeeling(e.feeling, AFTER_OPTIONS).again
  const stopped =
    e.feeling === 'uncomfortable'
      ? 'uncomfortable'
      : (s.stopped ?? (again ? null : 'effortful'))
  return { ...s, feeling: e.feeling, stopped }
}

function begun(s: SingVisit): SingVisit {
  const next = nextPhrase(s)
  return next === null || !s.sound
    ? s
    : { ...s, taking: next, listening: false }
}

/** Stop here shows after the first phrase's Easy or Workable, until phrase 2 starts. */
function canHalt(s: SingVisit): boolean {
  const last = s.takes.at(-1)
  return (
    s.taking === null &&
    !s.halted &&
    s.stopped === null &&
    heard(last) &&
    last?.phrase === 1 &&
    fine(s.feeling)
  )
}

const ON: {
  readonly [T in SingEvent['type']]: (s: SingVisit, e: EventOf<T>) => SingVisit
} = {
  comfort: (s, e) => (s.comfort === null ? { ...s, comfort: e.comfort } : s),
  voice: (s, e) =>
    s.comfort === null || s.taking !== null ? s : { ...s, voice: e.voice },
  sound: (s, e) => ({ ...s, sound: e.on }),
  begin: begun,
  listen: (s) => (s.taking === null ? s : { ...s, listening: true }),
  took,
  // only during the start: a listening take ends by `took`
  silenced: (s) =>
    s.taking === null || s.listening
      ? s
      : { ...s, taking: null, listening: false },
  nomic: (s) => ({ ...s, taking: null, listening: false, noMic: true }),
  feel: felt,
  // only where the card offers it, so the rule holds for events in any order
  halt: (s) => (canHalt(s) ? { ...s, halted: true } : s),
}

export function nextVisit(s: SingVisit, e: SingEvent): SingVisit {
  const on = ON[e.type] as (s: SingVisit, e: SingEvent) => SingVisit
  return on(s, e)
}

export type Panel =
  | 'comfort'
  | 'listen'
  | 'voice'
  | 'prepare'
  | 'feel'
  | 'after'

/**
 * The line in the after panel: the second phrase offered, both phrases
 * read, the take with no voice, or Lesson 3's gentle and enough-for-today
 * lines (LESSON.md, Sing it).
 */
export type Closing = 'next' | 'done' | 'silent' | 'gentle' | 'enough'

/** Which control begins the next take: Start, Start again, or Start phrase 2. */
export type StartControl = 'start' | 'again' | 'phrase-2'

export interface SingView {
  readonly panels: readonly Panel[]
  /** Listening only: today, or with no microphone (or no Web Audio). */
  readonly listenWhy: 'listen' | 'nomic' | null
  /** Which of the voice choice's two lines shows. */
  readonly voiceLine: 'stored' | 'none'
  /** Your turn and the stop line: the parts that ask for singing, a microphone or none. */
  readonly singParts: boolean
  /** The phrase the staff shows; with no microphone both are drawn. */
  readonly phrase: PhraseId
  /** The control that begins the next take, or null when none is offered. */
  readonly start: StartControl | null
  readonly stopHere: boolean
  /** Play the start: the no-microphone path's do, then do, mi, so, mi, do. */
  readonly playStart: boolean
  /** Play Merc's phrases: the start and both phrases, once the singing has ended. */
  readonly merc: boolean
  /** The hint beside the Start offered, or beside Play Merc's phrases. */
  readonly hint: 'silent' | 'noAudio' | null
  readonly answer: Feeling | null
  readonly closing: Closing | null
  /** The no-voice line keeps its cue while a Start again is offered. */
  readonly cue: boolean
  readonly doctor: boolean
  /** The lines under the staff and the pitch line: the latest take's reading, kept. */
  readonly readings: boolean
  readonly card: Ending
  /** The status line, announced; null leaves it as it stands (the start sings before a take listens). */
  readonly status: string | null
}

/** The status lines the spec words (Toys 6, states 1 to 9). */
export const STATUS = {
  comfort: 'Before you sing: how is your voice today?',
  voiceSing: "Choose the voice you'll sing with.",
  voiceListen: 'Choose a voice: it picks who sings.',
  listen: "Just listening today: press Play Merc's phrases to hear them.",
  nomic:
    'No microphone? Play the start, read and sing anyway, then play Merc’s phrases to check.',
  noAudio: "This browser can't play sound here.",
  turn: 'Your turn: two phrases from the page.',
  phrase2: 'Phrase 2: a line you’ve never heard, with the names off.',
  take: "Your turn: start on do when you're ready.",
  left: 'That take stopped when you left, so it was not kept.',
  feel: 'How did that feel?',
  stopped: 'Singing is over for this visit.',
  spent: "That's every take for this visit.",
} as const

/** The hints beside a Start or Play Merc's phrases (WEB-SPEC, Toys 6, states 5 and 9). */
export const HINT = {
  silent:
    'Sound is off, so nothing played. Turn sound on to hear the start, then press Start.',
  noAudio: STATUS.noAudio,
} as const

function startOf(s: SingVisit, next: PhraseId | null): StartControl | null {
  if (next === null) return null
  const last = s.takes.at(-1)
  if (last === undefined) return 'start'
  if (!heard(last)) return 'again'
  return 'phrase-2'
}

function closingOf(s: SingVisit): Closing | null {
  if (s.taking !== null) return null
  if (s.stopped !== null)
    return s.stopped === 'uncomfortable' ? 'enough' : 'gentle'
  const last = s.takes.at(-1)
  if (last === undefined) return null
  if (!last.voiced && !last.abandoned) return 'silent'
  if (!heard(last) || !fine(s.feeling)) return null
  if (last.phrase === 2) return 'done'
  return s.halted ? null : 'next'
}

/** The line before any take: the comfort check, the voice choice, or why nothing listens; undefined once singing is on offer. */
function openingStatus(
  s: SingVisit,
  panels: readonly Panel[],
): string | undefined {
  if (panels.includes('comfort')) return STATUS.comfort
  if (s.voice === null)
    return s.comfort === 'listen' ? STATUS.voiceListen : STATUS.voiceSing
  if (!s.webAudio) return STATUS.noAudio
  if (s.comfort === 'listen') return STATUS.listen
  return s.noMic ? STATUS.nomic : undefined
}

/** The line while singing is on offer: the take, the question, or what comes next. */
function singingStatus(s: SingVisit): string | null {
  // the start sings: the line stands until the take listens
  if (s.taking !== null) return s.listening ? STATUS.take : null
  if (s.stopped !== null || s.halted) return STATUS.stopped
  if (asking(s)) return STATUS.feel
  if (spent(s)) return STATUS.spent
  if (s.takes.at(-1)?.abandoned === true) return STATUS.left
  return nextPhrase(s) === 2 ? STATUS.phrase2 : STATUS.turn
}

/** The panels showing: the comfort check, then the voice choice and what follows it once a voice is chosen. */
function panelsOf(s: SingVisit): Panel[] {
  if (s.comfort === null) return ['comfort']
  if (s.voice === null) return ['voice']
  // the no-microphone path, Web Audio's absence too, is the prepare
  // panel's: the staff, its line and Play the start
  const panels: Panel[] = [
    'voice',
    s.comfort === 'listen' ? 'listen' : 'prepare',
  ]
  if (asking(s)) panels.push('feel')
  if (closingOf(s) !== null || s.halted || ended(s)) panels.push('after')
  return panels
}

/** The hint beside Start or Play Merc's phrases. */
function hintOf(s: SingVisit, next: PhraseId | null): SingView['hint'] {
  if (!s.webAudio) return 'noAudio'
  return next !== null && !s.sound && s.taking === null ? 'silent' : null
}

export function viewOf(s: SingVisit): SingView {
  const panels = panelsOf(s)
  const next = nextPhrase(s)
  const last = s.takes.at(-1)
  const closing = s.voice === null ? null : closingOf(s)
  return {
    panels,
    listenWhy:
      s.comfort === 'listen'
        ? 'listen'
        : !s.webAudio || s.noMic
          ? 'nomic'
          : null,
    voiceLine: s.hadVoice ? 'stored' : 'none',
    singParts: s.comfort === 'sing' && s.voice !== null,
    phrase: s.taking ?? (next === 2 ? 2 : (last?.phrase ?? 1)),
    start: startOf(s, next),
    stopHere: canHalt(s),
    playStart:
      s.comfort === 'sing' && s.voice !== null && (s.noMic || !s.webAudio),
    merc: ended(s),
    hint: hintOf(s, next),
    answer: s.feeling,
    closing,
    cue: closing === 'silent' && next !== null,
    doctor: s.comfort === 'listen' || s.stopped === 'uncomfortable',
    readings: heard(last) && s.stopped !== 'uncomfortable' && s.taking === null,
    card: s.comfort === 'listen' || s.stopped !== null ? 'rest' : 'practise',
    status: openingStatus(s, panels) ?? singingStatus(s),
  }
}
