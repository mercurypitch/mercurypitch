// ============================================================
// Ladder flow — what a sung ladder's Sing it offers next, as a pure rule
// ============================================================
//
// Sing it is one ladder of notes, the full one or a smaller one, sung back
// to Merc and read note by note: Lesson 9's do-mi-so-do and do-mi-so-mi-do
// (its WEB-SPEC, Toys 4), Lesson 20's run up to la and its smaller run up
// to so (its WEB-SPEC, Toys 6). The rule began as Lesson 9's and moved
// into the kit for Lesson 20 (Lesson 20 WEB-SPEC, What the kit and the app
// still need, item 5): the two ladders are the kit's ids, 'full' and
// 'smaller', and each page sings them, names them and words the card's
// lines (kit/ladder-sing.ts's plan). From the comfort answer, the voice,
// whether the sound is on and the browser has Web Audio, the ladder pressed
// and Move do's place, the takes so far (the ladder each sang and what it
// came to), whether the visit's one Again has gone and the answers to "How
// did that feel?", this gives the card's stage, the controls it shows,
// which of the page's lines it says and the Wrap's card, so every branch is
// unit-tested without a microphone (Lesson 9's ladder-flow tests, which
// walk every route a visit can take).
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
// The retry rules (Lesson 9 FACTS 77, 78): at most three takes a visit,
// every take counting, and at most two sung ladders. Again comes once a
// visit, after "Easy" or "Workable", whatever the reading, with Again
// smaller beside it after the full ladder; either uses it. A take that heard
// no voice asks no feeling question, and its Start again is a fresh start
// that leaves the one Again unused; after the last take its line keeps no
// cue to start again, since no retry wording shows without a retry control.
// A take abandoned when the tab was hidden or the section left asks none
// either; Start comes back while takes remain, and if it had voice it uses
// the one Again up. Once a smaller ladder has been sung, the full ladder is
// offered no more. "Effortful" and "Uncomfortable" end the singing for the
// visit and pick the rest card (`afterFeeling` with `restAfterEffort`), and
// "Uncomfortable" takes the lines and the count away. An answer locks once
// given and frees only for the next take, as the kit's `mountFeelings` has
// it by default. Nothing here is stored, and the ladder reader, which loads
// with the listener after Start, is known here only by the shape of what it
// returns (`kindOf`).
//
// Two options are Lesson 20's (its WEB-SPEC, Toys 6, and FACTS 52, 57 and
// 63). Move do's reach may differ by voice (`reach`): the run goes higher
// only, three semitones for the lower voice and four for the higher, and a
// change of voice brings do back within the new voice's reach. And a page
// may offer the faster pass (`fasterPass`), Again, faster, once a visit
// after "Easy" or "Workable": Merc's ladder again at a faster pace, the
// count-in and the guide, with nothing listening and nothing counted. It is
// not a take: it spends no take and no sung ladder, it asks "How did that
// feel?" again, whose "Easy" or "Workable" says the faster line in place of
// the count, and Merc does not celebrate it. With the sound off it plays
// nothing and shows the hint, unspent; cut short, by the sound going off or
// the viewer leaving, it is unspent too, the card as it was before its
// button.

import type { Ending, Feeling } from './comfort'
import { afterFeeling } from './comfort'
import type { MoveReach } from './move-do'
import { clampMove, MOVE_REACH } from './move-do'
import type { Voice } from './voice-choice'

/** Sing it's two ladders: the full one, or the smaller one a page offers beside it. */
export type LadderId = 'full' | 'smaller'

/** Takes a visit allows, and sung ladders (Lesson 9 FACTS 78). */
export const MAX_TAKES = 3
export const MAX_SUNG = 2

/**
 * The ladder choice's buttons, in the card's order. The ladders' notes and
 * labels are the page's; this rule needs only which of the two.
 */
export const LADDER_ORDER: readonly LadderId[] = ['full', 'smaller']

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
  /** The take Merc celebrated, by its index; once a visit (Lesson 9 FACTS 83). */
  readonly celebrated: number | null
  /** Done for today pressed. */
  readonly finished: boolean
  /** Move do's reach for each voice. */
  readonly reach: Readonly<Record<Voice, MoveReach>>
  /** The page offers the faster pass, once a visit. */
  readonly fasterPass: boolean
  /** The faster pass is open, on this ladder: from its button to its end. */
  readonly passing: LadderId | null
  /** The faster pass has run to its end this visit. */
  readonly fasterUsed: boolean
  /** The faster pass was the latest ladder sung: "How did that feel?" asks about it. */
  readonly passed: boolean
}

export interface VisitStart {
  /** The voice stored from an earlier visit, or null. */
  readonly voice: Voice | null
  readonly sound: boolean
  readonly webAudio: boolean
  /** Move do's reach for each voice, where a page's is not the kit's four either way. */
  readonly reach?: Readonly<Record<Voice, MoveReach>>
  /** The page offers the faster pass. */
  readonly fasterPass?: boolean
}

/** Move do's reach either way for both voices unless a page gives its own. */
const KIT_REACH: Readonly<Record<Voice, MoveReach>> = {
  lower: MOVE_REACH,
  higher: MOVE_REACH,
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
  reach: s.reach ?? KIT_REACH,
  fasterPass: s.fasterPass ?? false,
  passing: null,
  fasterUsed: false,
  passed: false,
})

/** Move do's reach for the voice the visit sings in, the lower until one is chosen. */
export const reachOf = (v: LadderVisit): MoveReach =>
  v.reach[v.voice ?? 'lower']

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
  /** Again, faster pressed. */
  | { readonly type: 'faster' }
  /** The faster pass ended: run to its end, or cut short. */
  | { readonly type: 'passed'; readonly whole: boolean }

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
    v.passing === null &&
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
 * that heard no voice (7), the reading and "How did that feel?" (7, 8), the
 * faster pass, or the takes spent by an abandoned one, Done for today
 * alone.
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
  | 'faster'
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
  /** Again, faster. */
  readonly faster: boolean
  /** Done for today. */
  readonly done: boolean
  /**
   * The hint, as a key of the page's `LadderLines`: beside the button
   * pressed with the sound off, naming it, Start, Start again or Again
   * (Play Merc's ladder in the briefing shows Start's); or, with no Web
   * Audio, beside Play Merc's ladder.
   */
  readonly hint: SoundHint | 'noAudio' | null
  /** After a take with no voice, its line as a key of the page's `LadderLines`: with its cue while a take remains, without it after the last. */
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
  /** "Effortful"'s line, or "Uncomfortable"'s; or, after the faster pass, its "Easy" and "Workable" line. */
  readonly closing: 'gentle' | 'enough' | 'faster' | null
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
  smallerSung(v) ? SMALLER : LADDER_ORDER

function stageOf(v: LadderVisit): Stage {
  if (v.comfort === null) return 'comfort'
  if (v.voice === null) return 'voice'
  if (v.comfort === 'listen') return 'listen'
  if (v.nomic || !v.webAudio) return 'nomic'
  if (v.taking !== null) return 'take'
  if (v.passing !== null) return 'faster'
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
    faster: false,
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
    faster: false,
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
    case 'faster':
      // the take's lines and lit edges stay: the faster pass reads nothing
      return { ...base, lines: true }
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

/**
 * After a take with voice, or the faster pass: the lines, the question,
 * and what its answer leaves.
 */
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
  const faster = a.again && v.fasterPass && !v.fasterUsed
  // the faster pass reads nothing: no count, no tricky line, no celebration
  const scored = !v.passed
  return {
    ...base,
    ask: true,
    locked: true,
    // "Uncomfortable" takes the lines away with the count
    lines: a.count,
    count: a.count && scored,
    tricky: scored && a.tricky && last.kind === 'some',
    closing: a.closing ?? (scored ? null : 'faster'),
    doctor: a.doctor,
    again,
    faster,
    // do may move before an Again; the Again buttons carry the ladder
    moveDo: again.length > 0,
    done: a.closing !== 'enough',
    celebrate: scored && v.celebrated === v.takes.length - 1,
    hint: offBeside(v, 'soundOffAgain', again.length > 0 || faster),
  }
}

/** The visit after an event; one the card does not offer leaves it as it was. */
export function next(v: LadderVisit, e: LadderEvent): LadderVisit {
  const o = offers(v)
  switch (e.type) {
    case 'comfort':
      return comfortAnswered(v, e.sing)
    case 'voice':
      // do comes back within the new voice's reach
      return o.voiceChoice
        ? { ...v, voice: e.voice, shift: clampMove(v.shift, v.reach[e.voice]) }
        : v
    case 'sound':
      return { ...v, sound: e.on, silentPress: false }
    case 'ladder':
      return o.ladders.includes(e.ladder) ? { ...v, ladder: e.ladder } : v
    case 'move':
      return o.moveDo
        ? { ...v, shift: clampMove(v.shift + e.step, reachOf(v)) }
        : v
    case 'play':
      return mercPlayed(v, o)
    case 'begin':
      return begin(v, o, e.ladder)
    case 'nomic':
      return v.taking === null
        ? v
        : { ...v, taking: null, undo: null, nomic: true }
    case 'silenced':
      return silenced(v)
    case 'took':
      return took(v, e.kind)
    case 'feel':
      return o.ask && !o.locked ? answered(v, e.feeling) : v
    case 'done':
      return o.done ? { ...v, finished: true } : v
    case 'faster':
      return fasterBegun(v, o)
    case 'passed':
      return fasterEnded(v, e.whole)
  }
}

/** The comfort check's answer: the first one stands. */
function comfortAnswered(v: LadderVisit, sing: boolean): LadderVisit {
  if (v.comfort !== null) return v
  return { ...v, comfort: sing ? 'sing' : 'listen' }
}

/** Play Merc's ladder in the briefing, with the sound off: the hint. */
function mercPlayed(v: LadderVisit, o: LadderOffers): LadderVisit {
  return o.playMerc && o.start && !v.sound && !v.silentPress
    ? { ...v, silentPress: true }
    : v
}

/**
 * The sound went off while Merc sang the ladder: no take is spent on a
 * ladder the viewer could not hear, and the card goes back to its button,
 * with the hint.
 */
function silenced(v: LadderVisit): LadderVisit {
  if (v.taking === null || v.undo === null || v.sound) return v
  return { ...v, ...v.undo, taking: null, undo: null, silentPress: true }
}

/** The open take ended: it joins the takes, and the card asks again how it felt. */
function took(v: LadderVisit, kind: TakeKind): LadderVisit {
  if (v.taking === null) return v
  return {
    ...v,
    taking: null,
    undo: null,
    takes: [...v.takes, { ladder: v.taking, kind }],
    feeling: null,
    passed: false,
    // a ladder abandoned after its voice was heard is the visit's one retry
    againUsed: v.againUsed || kind === 'leftVoiced',
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
  const earns =
    !v.passed && !hard && last.kind === 'all' && v.celebrated === null
  return {
    ...v,
    feeling: f,
    effort: v.effort || hard,
    rest: v.rest || afterFeeling(f, { restAfterEffort: true }).rest,
    celebrated: earns ? v.takes.length - 1 : v.celebrated,
  }
}

/**
 * Again, faster: the ladder last sung, at the faster pace. With the sound
 * off nothing plays, nothing is spent, and the hint says why.
 */
function fasterBegun(v: LadderVisit, o: LadderOffers): LadderVisit {
  if (!o.faster) return v
  if (!v.sound) return v.silentPress ? v : { ...v, silentPress: true }
  return { ...v, passing: v.takes[v.takes.length - 1].ladder }
}

/**
 * The faster pass ended. Run to its end, it is spent, and the card asks
 * how it felt; cut short, it is not, the card as it was before its button,
 * with the hint if the sound went off.
 */
function fasterEnded(v: LadderVisit, whole: boolean): LadderVisit {
  if (v.passing === null) return v
  if (!whole)
    return { ...v, passing: null, silentPress: v.silentPress || !v.sound }
  return { ...v, passing: null, fasterUsed: true, passed: true, feeling: null }
}

/** The Again buttons' accessible names: the same ladder again, either one, or the smaller after the full. */
export interface AgainNames {
  readonly full: string
  readonly smaller: string
  readonly smallerAfterFull: string
}

/** An Again button's accessible name: the same ladder again, or the smaller after the full. */
export function againName(
  ladder: LadderId,
  last: LadderId,
  names: AgainNames,
): string {
  if (ladder !== last) return names.smallerAfterFull
  return ladder === 'full' ? names.full : names.smaller
}

/**
 * The lines a page's card says for the flow's states, its own words: the
 * line over the voice choice, the listen and no-microphone lines, the
 * hints, the take's line, the lines after a take with no voice, the
 * question and the two closing lines.
 */
export interface LadderLines {
  readonly voiceNone: string
  readonly voiceStored: string
  readonly voiceListen: string
  readonly listen: string
  readonly nomic: string
  readonly noAudio: string
  readonly soundOff: string
  readonly soundOffStartAgain: string
  readonly soundOffAgain: string
  readonly take: string
  readonly noVoice: string
  readonly noVoiceLast: string
  readonly feel: string
  readonly gentle: string
  readonly enough: string
  /** While the faster pass runs: "Sing along as each bead lights, if you like." */
  readonly passing?: string
  /** After the faster pass, "Easy" or "Workable": "That's the run, faster." */
  readonly faster?: string
}
