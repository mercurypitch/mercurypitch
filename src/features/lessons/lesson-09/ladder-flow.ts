// ============================================================
// Lesson 9 ladder flow — what Sing it offers next, as a pure rule
// ============================================================
//
// Sing it is one slow ladder, do-mi-so-do or the smaller do-mi-so-mi-do,
// sung back to Merc and read note by note (WEB-SPEC, Toys 4). From the
// comfort answer, the voice, whether the sound is on and the browser has
// Web Audio, the ladder pressed and Move do's place, the takes so far (the
// ladder each sang and what it came to), whether the visit's one Again has
// gone and the answers to "How did that feel?", this gives the card's
// stage, the controls it shows, what its lines say and the Wrap's card, so
// every branch is unit-tested without a microphone (ladder-flow.test.ts,
// ladder-flow-takes.test.ts, ladder-flow-sound-off.test.ts) and walked
// (ladder-flow-walk.test.ts).
// The page draws what it says: a control it does not offer is absent, never
// disabled (Move do at its ends and the feelings once answered aside, as
// the kit has them), and an event it does not offer leaves the visit as it
// was.
//
// The comfort check comes first on every visit, and with no voice stored
// the voice choice comes before either path, because the voice picks the
// Merc who sings. "Just listen today" plays Merc's ladder on a tap, asks
// nothing of the voice and picks the rest card; no microphone, or no Web
// Audio at all, leaves the same listening path with the practise card.
// The listen path shows its listen line and the doctor lines at once,
// before any voice is chosen: the referral guidance never waits on a
// choice. Merc sings the ladder before every take, so with the sound off
// Start, like every button that begins a take, plays nothing, asks for
// nothing and shows the hint, which names the button pressed; and the sound
// turned off while Merc sings, before the take listens, ends the take
// uncounted, the card back as it was before its button.
//
// The retry rules (FACTS 77, 78): at most three takes a visit, every take
// counting, and at most two sung ladders. Again comes once a visit, after
// "Easy" or "Workable", whatever the reading, with Again smaller beside it
// after the full ladder; either uses it. A take that heard no voice asks no
// feeling question, and its Start again is a fresh start that leaves the one
// Again unused; after the last take its line keeps no cue to start again,
// since no retry wording shows without a retry control. A take abandoned
// when the tab was hidden or the section left asks none either; Start comes
// back while takes remain, and if it had voice it uses the one Again up.
// Once a smaller ladder has been sung, the full ladder is offered no more.
// "Effortful" and "Uncomfortable" end the singing for the visit and pick the
// rest card (`afterFeeling` with `restAfterEffort`), and "Uncomfortable"
// takes the lines and the count away. An answer locks once given and frees
// only for the next take, as the kit's `mountFeelings` has it by default.
// Nothing here is stored, and the ladder reader, which loads with the
// listener after Start, is known here only by the shape of what it returns
// (`kindOf`).

import type { Ending, Feeling } from '@/features/lessons/kit/comfort'
import { afterFeeling } from '@/features/lessons/kit/comfort'
import { clampMove } from '@/features/lessons/kit/move-do'
import type { Voice } from '@/features/lessons/kit/voice-choice'

/** Takes a visit allows, and sung ladders (FACTS 78). */
export const MAX_TAKES = 3
export const MAX_SUNG = 2

/**
 * The two ladders by name: the full one up to the top do, and the smaller
 * do-mi-so-mi-do. Their notes and labels are the ladder data's; this rule
 * needs only which of the two.
 */
export type LadderId = 'full' | 'smaller'

/** The ladder choice's buttons, in the card's order. */
export const LADDERS: readonly LadderId[] = ['full', 'smaller']

/**
 * What a take came to: no voice within the wait; a voice but no steady
 * note; notes read, fewer than all the heard ones in the band; every heard
 * note in the band; or abandoned (the tab hidden, the section left), before
 * any voice or after one.
 */
export type TakeKind =
  | 'none'
  | 'unsteady'
  | 'some'
  | 'all'
  | 'leftSilent'
  | 'leftVoiced'

export interface TakeMark {
  readonly ladder: LadderId
  readonly kind: TakeKind
}

/** The take heard a voice: a sung ladder. */
const isVoiced = (t: TakeMark): boolean =>
  t.kind !== 'none' && t.kind !== 'leftSilent'

const isAbandoned = (t: TakeMark): boolean =>
  t.kind === 'leftSilent' || t.kind === 'leftVoiced'

/** The ladder reader's result as far as this rule reads it. */
export type LadderReadingLike =
  | { readonly heard: false }
  | {
      readonly heard: true
      readonly count: { readonly heard: number; readonly landed: number }
    }

/** What a take that ran to its end came to, from the ladder reader's result. */
export function kindOf(r: LadderReadingLike): TakeKind {
  if (!r.heard) return 'none'
  if (r.count.heard === 0) return 'unsteady'
  return r.count.landed === r.count.heard ? 'all' : 'some'
}

export interface LadderVisit {
  readonly comfort: 'sing' | 'listen' | null
  readonly voice: Voice | null
  /** A voice was stored when the visit began: the line over the choice says so. */
  readonly hadVoice: boolean
  /** A play would sound: the page's sound is on. */
  readonly sound: boolean
  /** The browser has Web Audio at all. */
  readonly webAudio: boolean
  /** The microphone was refused or missing, or the listener failed to load. */
  readonly nomic: boolean
  /** The ladder pressed in the choice. */
  readonly ladder: LadderId
  /** Move do, semitones from the voice's D. */
  readonly shift: number
  /** A take is open, on this ladder: from its button to its end (Merc's ladder, then the voice's). */
  readonly taking: LadderId | null
  /** What the open take's button changed, put back if the take is silenced before it listens. */
  readonly undo: {
    readonly ladder: LadderId
    readonly againUsed: boolean
  } | null
  /**
   * A button that begins a take (Start, Start again or an Again) or Play
   * Merc's ladder in the briefing was pressed with the sound off, or the
   * sound went off while Merc sang, and the sound has stayed off.
   */
  readonly silentPress: boolean
  readonly takes: readonly TakeMark[]
  readonly againUsed: boolean
  /** The answer to "How did that feel?" after the latest take, or null. */
  readonly feeling: Feeling | null
  /** "Effortful" or "Uncomfortable" answered this visit. */
  readonly effort: boolean
  /** The Wrap's rest card, picked by an answer this visit. */
  readonly rest: boolean
  /** The take Merc celebrated, by its index; once a visit (FACTS 83). */
  readonly celebrated: number | null
  /** Done for today pressed. */
  readonly finished: boolean
}

export interface VisitStart {
  /** The voice stored from an earlier visit, or null. */
  readonly voice: Voice | null
  readonly sound: boolean
  readonly webAudio: boolean
}

/** The visit as Sing it opens: the full ladder pressed, do where it starts. */
export const openVisit = (s: VisitStart): LadderVisit => ({
  comfort: null,
  voice: s.voice,
  hadVoice: s.voice !== null,
  sound: s.sound,
  webAudio: s.webAudio,
  nomic: false,
  ladder: 'full',
  shift: 0,
  taking: null,
  undo: null,
  silentPress: false,
  takes: [],
  againUsed: false,
  feeling: null,
  effort: false,
  rest: false,
  celebrated: null,
  finished: false,
})

export type LadderEvent =
  | { readonly type: 'comfort'; readonly sing: boolean }
  | { readonly type: 'voice'; readonly voice: Voice }
  | { readonly type: 'sound'; readonly on: boolean }
  /** The ladder choice pressed. */
  | { readonly type: 'ladder'; readonly ladder: LadderId }
  /** Move do pressed: -1 lower, 1 higher. */
  | { readonly type: 'move'; readonly step: number }
  /** Play Merc's ladder pressed. */
  | { readonly type: 'play' }
  /** Start or Start again on the pressed ladder, or an Again on its own. */
  | { readonly type: 'begin'; readonly ladder: LadderId }
  /** The open take could not listen: no microphone, or no listener. */
  | { readonly type: 'nomic' }
  /** The sound went off while Merc sang the ladder, before the take listened. */
  | { readonly type: 'silenced' }
  /** The open take ended. */
  | { readonly type: 'took'; readonly kind: TakeKind }
  | { readonly type: 'feel'; readonly feeling: Feeling }
  | { readonly type: 'done' }

/** Ladders sung this visit: every take that heard a voice, abandoned or not. */
const sungCount = (v: LadderVisit): number => v.takes.filter(isVoiced).length

/** A smaller ladder has been sung, so the full one is offered no more. */
const smallerSung = (v: LadderVisit): boolean =>
  v.takes.some((t) => t.ladder === 'smaller' && isVoiced(t))

/** Whether one more take may begin, on the visit's limits alone. */
function mayTake(v: LadderVisit): boolean {
  return (
    v.comfort === 'sing' &&
    v.voice !== null &&
    v.webAudio &&
    !v.nomic &&
    v.taking === null &&
    !v.effort &&
    !v.finished &&
    v.takes.length < MAX_TAKES &&
    sungCount(v) < MAX_SUNG
  )
}

/**
 * Where the card stands: the comfort check (state 1), the voice choice
 * waiting for one (2), just listening (3), listening with no microphone or
 * no Web Audio (9), the warm-up and briefing (4, 5), a take (6), a take
 * that heard no voice (7), the reading and "How did that feel?" (7, 8), or
 * the takes spent by an abandoned one, Done for today alone.
 */
export type Stage =
  | 'comfort'
  | 'voice'
  | 'listen'
  | 'nomic'
  | 'briefing'
  | 'take'
  | 'noVoice'
  | 'reading'
  | 'spent'

export interface LadderOffers {
  readonly stage: Stage
  /** Which line sits over the voice choice: a voice stored, none, or none on the listen path. */
  readonly voiceLine: 'stored' | 'none' | 'listen'
  readonly voiceChoice: boolean
  /** "Just listen today"'s line, shown with the doctor lines from the comfort answer on. */
  readonly listenLine: boolean
  /** The warm-up, with its two plays and Skip. */
  readonly warmUp: boolean
  /** The ladder choice's buttons; empty when it is not on the card. */
  readonly ladders: readonly LadderId[]
  /** The ladder shown pressed. */
  readonly pressed: LadderId
  readonly moveDo: boolean
  /** Play Merc's ladder. */
  readonly playMerc: boolean
  readonly start: boolean
  /** Start again, after a take that heard no voice. */
  readonly startAgain: boolean
  /** The Again buttons, by the ladder each sings: the same ladder, then the smaller after the full. */
  readonly again: readonly LadderId[]
  /** Done for today. */
  readonly done: boolean
  /**
   * The hint, as a key of LADDER_LINES: beside the button pressed with the
   * sound off, naming it, Start, Start again or Again (Play Merc's ladder
   * in the briefing shows Start's); or, with no Web Audio, beside Play
   * Merc's ladder.
   */
  readonly hint: SoundHint | 'noAudio' | null
  /** After a take with no voice, its line as a key of LADDER_LINES: with its cue while a take remains, without it after the last. */
  readonly noVoiceLine: 'noVoice' | 'noVoiceLast' | null
  /** "How did that feel?" and its four answers. */
  readonly ask: boolean
  /** The answers locked: one is given for this take. */
  readonly locked: boolean
  /** The reading's lines, one a note, with the lit edges they draw. */
  readonly lines: boolean
  /** The count: "This time, ..." or, with no note steady, the none-heard line. */
  readonly count: boolean
  /** "If that felt tricky, good: that's learning." */
  readonly tricky: boolean
  /** "Effortful"'s line, or "Uncomfortable"'s. */
  readonly closing: 'gentle' | 'enough' | null
  readonly doctor: boolean
  /** Merc celebrates this take. */
  readonly celebrate: boolean
  readonly card: Ending
}

/** The sound-off hint for each button that begins a take. */
export type SoundHint = 'soundOff' | 'soundOffStartAgain' | 'soundOffAgain'

const NONE: readonly LadderId[] = []
const SMALLER: readonly LadderId[] = ['smaller']

/** The sound-off hint `hint`, beside a button that begins a take, once one was pressed with the sound off. */
const offBeside = (
  v: LadderVisit,
  hint: SoundHint,
  beside: boolean,
): SoundHint | null => (beside && v.silentPress ? hint : null)

/** The ladders a fresh start may take. */
const openLadders = (v: LadderVisit): readonly LadderId[] =>
  smallerSung(v) ? SMALLER : LADDERS

function stageOf(v: LadderVisit): Stage {
  if (v.comfort === null) return 'comfort'
  if (v.voice === null) return 'voice'
  if (v.comfort === 'listen') return 'listen'
  if (v.nomic || !v.webAudio) return 'nomic'
  if (v.taking !== null) return 'take'
  const last = v.takes[v.takes.length - 1]
  if (last === undefined) return 'briefing'
  if (isAbandoned(last)) return mayTake(v) ? 'briefing' : 'spent'
  return isVoiced(last) ? 'reading' : 'noVoice'
}

/** What the card offers and says for the visit as it stands. */
export function offers(v: LadderVisit): LadderOffers {
  const card = cardOffers(v)
  if (!v.finished) return card
  // Done for today ends the takes, not the card: its lines and the answer
  // stay as they stand, and nothing begins a take again
  return {
    ...card,
    ladders: NONE,
    moveDo: false,
    startAgain: false,
    again: NONE,
    done: false,
    hint: null,
    noVoiceLine: card.noVoiceLine === null ? null : 'noVoiceLast',
  }
}

/** The card's controls and lines, before Done for today has its say. */
function cardOffers(v: LadderVisit): LadderOffers {
  const stage = stageOf(v)
  const listen = v.comfort === 'listen'
  const base: LadderOffers = {
    stage,
    voiceLine: v.hadVoice ? 'stored' : listen ? 'listen' : 'none',
    voiceChoice: false,
    listenLine: listen,
    warmUp: false,
    ladders: NONE,
    pressed: v.ladder,
    moveDo: false,
    playMerc: false,
    start: false,
    startAgain: false,
    again: NONE,
    done: false,
    hint: null,
    noVoiceLine: null,
    ask: false,
    locked: false,
    lines: false,
    count: false,
    tricky: false,
    closing: null,
    // the referral guidance never waits on a choice
    doctor: listen,
    celebrate: false,
    card: listen || v.rest ? 'rest' : 'practise',
  }
  switch (stage) {
    case 'comfort':
    case 'take':
      return base
    case 'voice':
      return { ...base, voiceChoice: true }
    case 'listen':
    case 'nomic':
      return {
        ...base,
        voiceChoice: true,
        ladders: openLadders(v),
        moveDo: true,
        playMerc: true,
        hint: v.webAudio ? null : 'noAudio',
      }
    case 'briefing':
      return {
        ...base,
        voiceChoice: true,
        warmUp: true,
        ladders: openLadders(v),
        moveDo: true,
        playMerc: true,
        start: true,
        hint: offBeside(v, 'soundOff', true),
      }
    case 'noVoice': {
      // a fresh start, while takes remain: the ladder and do may change first
      const more = mayTake(v)
      return {
        ...base,
        startAgain: more,
        ladders: more ? openLadders(v) : NONE,
        moveDo: more,
        done: true,
        hint: offBeside(v, 'soundOffStartAgain', more),
        noVoiceLine: more ? 'noVoice' : 'noVoiceLast',
      }
    }
    case 'spent':
      return { ...base, done: true }
    case 'reading':
      return readingOffers(v, base)
  }
}

/** After a take with voice: the lines, the question, and what its answer leaves. */
function readingOffers(v: LadderVisit, base: LadderOffers): LadderOffers {
  const last = v.takes[v.takes.length - 1]
  if (v.feeling === null) return { ...base, ask: true, lines: true }
  const a = afterFeeling(v.feeling, { restAfterEffort: true })
  const again =
    a.again && !v.againUsed && mayTake(v)
      ? last.ladder === 'full'
        ? openLadders(v)
        : SMALLER
      : NONE
  return {
    ...base,
    ask: true,
    locked: true,
    // "Uncomfortable" takes the lines away with the count
    lines: a.count,
    count: a.count,
    tricky: a.tricky && last.kind === 'some',
    closing: a.closing,
    doctor: a.doctor,
    again,
    // do may move before an Again; the Again buttons carry the ladder
    moveDo: again.length > 0,
    done: a.closing !== 'enough',
    celebrate: v.celebrated === v.takes.length - 1,
    hint: offBeside(v, 'soundOffAgain', again.length > 0),
  }
}

/** The visit after an event; one the card does not offer leaves it as it was. */
export function next(v: LadderVisit, e: LadderEvent): LadderVisit {
  const o = offers(v)
  switch (e.type) {
    case 'comfort':
      return v.comfort === null
        ? { ...v, comfort: e.sing ? 'sing' : 'listen' }
        : v
    case 'voice':
      return o.voiceChoice ? { ...v, voice: e.voice } : v
    case 'sound':
      return { ...v, sound: e.on, silentPress: false }
    case 'ladder':
      return o.ladders.includes(e.ladder) ? { ...v, ladder: e.ladder } : v
    case 'move':
      return o.moveDo ? { ...v, shift: clampMove(v.shift + e.step) } : v
    case 'play':
      // Play Merc's ladder in the briefing, with the sound off: the hint
      return o.playMerc && o.start && !v.sound && !v.silentPress
        ? { ...v, silentPress: true }
        : v
    case 'begin':
      return begin(v, o, e.ladder)
    case 'nomic':
      return v.taking === null
        ? v
        : { ...v, taking: null, undo: null, nomic: true }
    case 'silenced':
      // no take is spent on a ladder the viewer could not hear: the card
      // goes back to its button, with the hint
      return v.taking === null || v.undo === null || v.sound
        ? v
        : { ...v, ...v.undo, taking: null, undo: null, silentPress: true }
    case 'took':
      if (v.taking === null) return v
      return {
        ...v,
        taking: null,
        undo: null,
        takes: [...v.takes, { ladder: v.taking, kind: e.kind }],
        feeling: null,
        // a ladder abandoned after its voice was heard is the visit's one retry
        againUsed: v.againUsed || e.kind === 'leftVoiced',
      }
    case 'feel':
      return o.ask && !o.locked ? answered(v, e.feeling) : v
    case 'done':
      return o.done ? { ...v, finished: true } : v
  }
}

function begin(v: LadderVisit, o: LadderOffers, ladder: LadderId): LadderVisit {
  const again = o.again.includes(ladder)
  const fresh = (o.start || o.startAgain) && o.ladders.includes(ladder)
  if (!again && !fresh) return v
  // Merc sings the ladder first: with the sound off nothing plays, nothing listens
  if (!v.sound) return v.silentPress ? v : { ...v, silentPress: true }
  return {
    ...v,
    ladder,
    taking: ladder,
    undo: { ladder: v.ladder, againUsed: v.againUsed },
    againUsed: v.againUsed || again,
  }
}

function answered(v: LadderVisit, f: Feeling): LadderVisit {
  const last = v.takes[v.takes.length - 1]
  const hard = f === 'effortful' || f === 'uncomfortable'
  const earns = !hard && last.kind === 'all' && v.celebrated === null
  return {
    ...v,
    feeling: f,
    effort: v.effort || hard,
    rest: v.rest || afterFeeling(f, { restAfterEffort: true }).rest,
    celebrated: earns ? v.takes.length - 1 : v.celebrated,
  }
}

/** An Again button's accessible name: the same ladder again, or the smaller after the full. */
export function againName(ladder: LadderId, last: LadderId): string {
  if (ladder !== last) return AGAIN_NAMES.smallerAfterFull
  return ladder === 'full' ? AGAIN_NAMES.full : AGAIN_NAMES.smaller
}

export const AGAIN_NAMES = {
  full: 'Again: do-mi-so-do',
  smaller: 'Again: the smaller ladder',
  smallerAfterFull: 'Again, smaller ladder',
} as const

/** The lines the card shows for the flow's states, LESSON.md's and the WEB-SPEC's own. */
export const LADDER_LINES = {
  voiceNone:
    'Choose a voice to sing with. If you chose one in an earlier lesson, pick it again:',
  voiceStored: 'Keep the voice you chose before, or change it:',
  voiceListen: 'Choose a voice: it picks the Merc who sings.',
  listen:
    'Good call. Merc sings the ladder, and nothing listens. Rest your voice.',
  doctor:
    "If hoarseness or discomfort lasts more than a couple of weeks, see a doctor (a GP or an ear, nose and throat specialist). If it's very painful, or breathing or swallowing is hard, get help straight away.",
  nomic:
    'No microphone? Sing along anyway: Merc sings the ladder first, and nothing listens.',
  noAudio: "This browser can't play sound here.",
  soundOff:
    "Sound is off, so nothing played. Turn sound on to hear Merc's ladder, then press Start.",
  soundOffStartAgain:
    "Sound is off, so nothing played. Turn sound on to hear Merc's ladder, then press Start again.",
  soundOffAgain:
    "Sound is off, so nothing played. Turn sound on to hear Merc's ladder, then press Again.",
  take: "Your turn: start on do when you're ready. Move on each time the next band lights up.",
  noVoice:
    "We didn't hear you start that time. Start on do when its band lights.",
  noVoiceLast: "We didn't hear you start that time.",
  feel: 'How did that feel?',
  gentle: 'Keep it gentle: rest before you sing again.',
  enough:
    "Thanks for saying so. That's enough singing for today: rest your voice.",
} as const
