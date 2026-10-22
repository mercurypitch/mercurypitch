// ============================================================
// Lesson 7 siren flow — what Sing it offers next, as a pure rule
// ============================================================
//
// Sing it is one gentle siren on "ng" (WEB-SPEC, Toys 4). From the comfort
// answer, whether Merc's siren has been heard, the takes so far (each:
// whether it had voice, whether it lit a band, whether it was abandoned),
// whether the visit's one Again has been used, and the answers to "How did
// that feel?", this gives what the card offers and says, and the Wrap's
// card, so every branch is unit-tested without a microphone
// (siren-flow.test.ts). The page draws what it says: a button it does not
// offer is absent, never disabled, except Start while Merc's siren has not
// been heard (hear it first: playbook rule 16).
//
// The retry rules (FACTS 58): at most three takes a visit, every take
// counting; at most two sung sirens. Again after "Easy" or "Workable" comes
// once a visit, whatever the reading. A take that heard no voice asks no
// feeling question, and its Again is a fresh start that leaves the one Again
// unused. A take abandoned when the page was hidden asks none either, and
// Start comes back while takes remain, but if it had voice it uses the one
// Again up. Never a retry after "Effortful" or "Uncomfortable": once either
// has been picked, no Again and no Start for the rest of the visit, and the
// Wrap shows the rest card, as after "Just listen today" (REQ-GVC-021,
// REQ-GVC-023, REQ-GVC-055). An answer can change until the next take; the
// strongest report the visit has had decides the closing line, because the
// singer's report outranks every reading (REQ-GVC-024). Nothing here is
// stored: the ending lasts the visit.

import type { Feeling } from '@/features/lessons/kit/comfort'

/** Takes a visit allows, and sung sirens. */
export const MAX_TAKES = 3
export const MAX_SUNG = 2

/** What a take came to: no voice at all, too little to read, or a band lit. */
export type TakeKind = 'none' | 'unsteady' | 'band'

export interface TakeMark {
  readonly kind: TakeKind
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
      return {
        ...v,
        feeling: e.feeling,
        effort:
          v.effort ||
          e.feeling === 'effortful' ||
          e.feeling === 'uncomfortable',
        discomfort: v.discomfort || e.feeling === 'uncomfortable',
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

export interface SirenOffers {
  /** The briefing's Start is on the card. */
  readonly start: boolean
  /** Start may be pressed: Merc's siren has been heard. */
  readonly startReady: boolean
  /** Why Start waits: Merc's siren not yet played, or played with the sound off. */
  readonly startHint: 'first' | 'off' | null
  /** "How did that feel?" is asked. */
  readonly ask: boolean
  readonly again: boolean
  /** Done for today. */
  readonly done: boolean
  readonly closing: Closing | null
  /** "Try again at about speaking volume.", only beside an offered Again. */
  readonly tryAgain: boolean
  readonly doctor: boolean
  /** The reading's band and line stay on the chart. */
  readonly keepBand: boolean
  /** The Wrap's rest card in place of the Vocal Range Test card. */
  readonly restCard: boolean
}

/** What the card offers and says for the visit as it stands. */
export function offers(v: SirenVisit): SirenOffers {
  const last = v.takes[v.takes.length - 1]
  const restCard = v.mode === 'listen' || v.effort
  const base: SirenOffers = {
    start: false,
    startReady: false,
    startHint: null,
    ask: false,
    again: false,
    done: false,
    closing: null,
    tryAgain: false,
    doctor: v.discomfort,
    keepBand: false,
    restCard,
  }
  if (v.mode !== 'sing' || v.finished) return base
  // the briefing: before any take, or after one abandoned
  if (last === undefined || last.abandoned) {
    const start = mayTake(v)
    return {
      ...base,
      start,
      startReady: start && v.heard,
      startHint: !start || v.heard ? null : v.silentPlay ? 'off' : 'first',
    }
  }
  // no voice came: no question, a fresh start while takes remain
  if (!last.voiced) return { ...base, again: mayTake(v), done: true }
  if (v.feeling === null) return { ...base, ask: true, keepBand: true }
  if (v.discomfort)
    return { ...base, ask: true, closing: 'enough', doctor: true }
  if (v.effort) return { ...base, ask: true, closing: 'gentle', keepBand: true }
  const again = mayTake(v) && !v.againUsed
  return {
    ...base,
    ask: true,
    again,
    done: true,
    closing: last.kind === 'band' ? 'band' : 'plain',
    tryAgain: again && last.kind === 'unsteady',
    keepBand: true,
  }
}

/** The lines the card shows, LESSON.md's own. */
export const SIREN_LINES = {
  band: "That's it: one gentle siren, done. The lit band shows where its middle notes sat today.",
  plain: "That's it: one gentle siren, done.",
  tryAgain: 'Try again at about speaking volume.',
  gentle: 'Keep it gentle: rest before you sing again.',
  enough:
    "Thanks for saying so. That's enough singing for today: rest your voice.",
  startFirst: "Play Merc's siren first",
  startOff:
    "Sound is off, so nothing played. Turn sound on to hear Merc's siren, then press Start.",
  noAudio: "This browser can't play sound here.",
} as const
