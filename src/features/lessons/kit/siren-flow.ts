// ============================================================
// Siren flow — what a page's one sung siren offers next, as a pure rule
// ============================================================
//
// Sing it as one siren on "ng" (Lesson 7's WEB-SPEC, Toys 4; Lesson 11's,
// Toys 4). From the comfort answer, whether Merc's siren has been heard, the
// takes so far (each: whether it had voice, whether it was abandoned, and
// on a page that reads its takes, what the reading made of it), whether the
// visit's one Again has been used, and the answers to "How did that feel?",
// this gives what the card offers and says, and the Wrap's card, so every
// branch is unit-tested without a microphone (siren-flow.test.ts). The page
// draws what it says: a button it does not offer is absent, never disabled,
// except Start while Merc's siren has not been heard (hear it first:
// playbook rule 16).
//
// Lesson 7's page reads each take and lights the middle half of the siren
// (`reading: true`); Lesson 11's reads nothing, since the app cannot tell a
// gear (its FACTS 27, 64). Without the reading no state closes on a band or
// says "Try again": every sung siren closes on the page's plain line.
//
// The retry rules (Lesson 7 FACTS 58, Lesson 11 FACTS 63): at most three
// takes a visit, every take counting; at most two sung sirens. Again after
// "Easy" or "Workable" comes once a visit, whatever the reading. A take
// that heard no voice asks no feeling question, and its Again is a fresh
// start that leaves the one Again unused. A take abandoned when the page
// was hidden or the section left asks none either, and Start comes back
// while takes remain, Done for today once none do; if it had voice it uses
// the one Again up. Never a retry after "Effortful" or "Uncomfortable":
// once either has been picked, no Again and no Start for the rest of the
// visit, and the Wrap shows the rest card, as after "Just listen today"
// (REQ-GVC-021, REQ-GVC-023, REQ-GVC-055). Done for today ends the takes,
// keeps the card's question, its answer and its lines, and locks the answer
// as it stands; the strongest report the visit has had decides the closing
// line, because the singer's report outranks every reading (REQ-GVC-024).
// Nothing here is stored: the ending lasts the visit.

import type { Feeling } from './comfort'
import { afterFeeling } from './comfort'

/** Takes a visit allows, and sung sirens. */
export const MAX_TAKES = 3
export const MAX_SUNG = 2

/** What a reading made of a take: no voice at all, too little to read, or a band lit. */
export type TakeKind = 'none' | 'unsteady' | 'band'

export interface TakeMark {
  /** On a page that reads its takes, what the reading made of it. */
  readonly kind?: TakeKind
  /** Ended because the viewer left (the tab hidden, the section left). */
  readonly abandoned: boolean
  /** It heard a voice: an abandoned take may have, or not. */
  readonly voiced: boolean
}

export interface SirenVisit {
  /** 'sing' after "I'm comfortable", 'listen' after "Just listen today", 'nomic' with no microphone or no Web Audio. */
  readonly mode: 'sing' | 'listen' | 'nomic' | null
  /** Merc's siren has sounded with the sound on. */
  readonly heard: boolean
  /** Play Merc's siren was pressed with the sound off, and nothing has sounded since. */
  readonly silentPlay: boolean
  readonly takes: readonly TakeMark[]
  readonly againUsed: boolean
  /** The latest answer to "How did that feel?" after the latest take. */
  readonly feeling: Feeling | null
  /** "Effortful" or "Uncomfortable" picked at any time this visit. */
  readonly effort: boolean
  /** "Uncomfortable" picked at any time this visit. */
  readonly discomfort: boolean
  /** The Wrap's rest card, picked by an answer this visit. */
  readonly rest: boolean
  /** Done for today pressed. */
  readonly finished: boolean
}

export const freshVisit = (): SirenVisit => ({
  mode: null,
  heard: false,
  silentPlay: false,
  takes: [],
  againUsed: false,
  feeling: null,
  effort: false,
  discomfort: false,
  rest: false,
  finished: false,
})

export type SirenEvent =
  | { readonly type: 'comfort'; readonly sing: boolean }
  | { readonly type: 'nomic' }
  | { readonly type: 'played'; readonly audible: boolean }
  | { readonly type: 'took'; readonly take: TakeMark }
  | { readonly type: 'feel'; readonly feeling: Feeling }
  | { readonly type: 'again' }
  | { readonly type: 'done' }

/** The visit after an event. */
export function next(v: SirenVisit, e: SirenEvent): SirenVisit {
  switch (e.type) {
    case 'comfort':
      return { ...v, mode: e.sing ? 'sing' : 'listen' }
    case 'nomic':
      return { ...v, mode: 'nomic' }
    case 'played':
      return e.audible
        ? { ...v, heard: true, silentPlay: false }
        : { ...v, silentPlay: !v.heard }
    case 'took':
      return {
        ...v,
        takes: [...v.takes, e.take],
        feeling: null,
        // a siren abandoned after its voice was heard is the visit's one retry
        againUsed: v.againUsed || (e.take.abandoned && e.take.voiced),
      }
    case 'feel':
      // after Done for today the answer stands
      if (v.finished) return v
      return {
        ...v,
        feeling: e.feeling,
        effort:
          v.effort ||
          e.feeling === 'effortful' ||
          e.feeling === 'uncomfortable',
        discomfort: v.discomfort || e.feeling === 'uncomfortable',
        rest: v.rest || afterFeeling(e.feeling, { restAfterEffort: true }).rest,
      }
    case 'again': {
      // the Again after a sung siren is the visit's one; after silence, a fresh start
      const last = v.takes[v.takes.length - 1]
      const sung = last !== undefined && last.voiced && !last.abandoned
      return { ...v, againUsed: v.againUsed || sung }
    }
    case 'done':
      return { ...v, finished: true }
  }
}

/** Sirens sung this visit: every take that heard a voice. */
export const sungCount = (v: SirenVisit): number =>
  v.takes.filter((t) => t.voiced).length

/** Whether one more take may begin, by Start or Again, on the visit's limits alone. */
export function mayTake(v: SirenVisit): boolean {
  return (
    v.mode === 'sing' &&
    !v.effort &&
    !v.finished &&
    v.takes.length < MAX_TAKES &&
    sungCount(v) < MAX_SUNG
  )
}

/** The line after an answer: a band lit, none lit, "Effortful"'s, or "Uncomfortable"'s. */
export type Closing = 'band' | 'plain' | 'gentle' | 'enough'

/** How a page runs the flow. */
export interface FlowOptions {
  /**
   * The page reads each take and lights a band (Lesson 7): a take with a
   * band closes on the band's line, and one too unsteady to read says "Try
   * again" beside its Again. Off (Lesson 11), every sung siren closes on
   * the plain line, and nothing says "Try again".
   */
  readonly reading?: boolean
}

export interface SirenOffers {
  /** The briefing's Start is on the card. */
  readonly start: boolean
  /** Start may be pressed: Merc's siren has been heard. */
  readonly startReady: boolean
  /** Why Start waits: Merc's siren not yet played, or played with the sound off. */
  readonly startHint: 'first' | 'off' | null
  /** "How did that feel?" is asked. */
  readonly ask: boolean
  /** Its four answers are locked, the one picked still pressed: Done for today was pressed. */
  readonly locked: boolean
  readonly again: boolean
  /** Done for today. */
  readonly done: boolean
  readonly closing: Closing | null
  /** "Try again at about speaking volume.", only beside an offered Again, and only on a page that reads. */
  readonly tryAgain: boolean
  readonly doctor: boolean
  /** The take's line stays on the chart, and on a page that reads, its band. */
  readonly keepLine: boolean
  /** The Wrap's rest card in place of the Vocal Range Test card. */
  readonly restCard: boolean
}

/** What the card offers and says for the visit as it stands. */
export function offers(v: SirenVisit, o: FlowOptions = {}): SirenOffers {
  const card = cardOffers(v, o.reading === true)
  if (!v.finished) return card
  // Done for today ends the takes, not the card: the question, its answer
  // and its lines stay as they stand, the answer locked, nothing starts a
  // take again, and Done for today itself is gone
  return {
    ...card,
    locked: true,
    start: false,
    startReady: false,
    startHint: null,
    again: false,
    done: false,
    tryAgain: false,
  }
}

/** The card's question, lines and buttons, before Done for today has its say. */
function cardOffers(v: SirenVisit, reading: boolean): SirenOffers {
  const last = v.takes[v.takes.length - 1]
  const restCard = v.mode === 'listen' || v.rest
  const base: SirenOffers = {
    start: false,
    startReady: false,
    startHint: null,
    ask: false,
    locked: false,
    again: false,
    done: false,
    closing: null,
    tryAgain: false,
    doctor: v.discomfort,
    keepLine: false,
    restCard,
  }
  if (v.mode !== 'sing') return base
  // the briefing: before any take, or after one abandoned; Done for today
  // in Start's place once the visit allows no more
  if (last === undefined || last.abandoned) {
    const start = mayTake(v)
    return {
      ...base,
      start,
      done: !start,
      startReady: start && v.heard,
      startHint: !start || v.heard ? null : v.silentPlay ? 'off' : 'first',
    }
  }
  // no voice came: no question, a fresh start while takes remain
  if (!last.voiced) return { ...base, again: mayTake(v), done: true }
  if (v.feeling === null) return { ...base, ask: true, keepLine: true }
  if (v.discomfort)
    return { ...base, ask: true, closing: 'enough', doctor: true }
  if (v.effort) return { ...base, ask: true, closing: 'gentle', keepLine: true }
  const again = mayTake(v) && !v.againUsed
  return {
    ...base,
    ask: true,
    again,
    done: true,
    closing: reading && last.kind === 'band' ? 'band' : 'plain',
    tryAgain: reading && again && last.kind === 'unsteady',
    keepLine: true,
  }
}
