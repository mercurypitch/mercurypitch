// ============================================================
// Hold flow — what follows a held note, as a pure rule
// ============================================================
//
// Sing it holds one note, once or twice (Lesson 5's ten seconds then
// fifteen, Lesson 13's ten alone): the page passes its holds' lengths as
// data (`HoldPlan`), and a second hold comes only after an "Easy" or
// "Workable" first hold and a rest the singer ends. From the hold, the
// takes so far and the answer to "How did that feel?", this gives the next
// state, the buttons and whether Merc celebrates, so every branch is
// unit-tested without a microphone (hold-flow.test.ts, and Lesson 5's). The
// page draws what it says, and a button it does not offer is absent, never
// disabled.
//
// The singer's answer outranks the reading (REQ-GVC-024). "Effortful" keeps
// the reading but offers no Again and no longer hold: a report of effort
// suppresses immediate-repeat encouragement (REQ-GVC-021, REQ-GVC-055); it
// picks the Wrap's rest card too where the page's coach has chosen that
// (`restAfterEffort`, as kit/comfort.ts has it). "Uncomfortable" takes away
// the reading, any retry and any more singing, and leaves the doctor lines
// and the Wrap's rest card (REQ-GVC-021, REQ-GVC-023). Merc celebrates only
// after "Easy" or "Workable", at most once a hold, and only for a take in
// the band for at least 80 % of its length: never because a hold was
// longer. Each hold allows three takes, as Lesson 3 allows three tries a
// note (Lesson 5 FACTS 52: more would add singing, not learning).

import type { Feeling } from './comfort'

export type HoldNo = 1 | 2

/** A page's holds: the length of each, seconds, one or two; and whether "Effortful" picks the rest card. */
export interface HoldPlan {
  readonly lengths: readonly [number] | readonly [number, number]
  readonly restAfterEffort?: boolean
}

/** Takes a hold allows, as take.ts's MAX_TRIES allows a note (Lesson 3). */
export const TAKES_PER_HOLD = 3

/** Merc celebrates a take in the band for at least this share of its length. */
export const CELEBRATE_SHARE = 0.8
/** Rule 15's line follows a take in the band for less than this share. */
export const TRICKY_SHARE = 0.5

/** What the flow reads from a take: whether a voice came, whether it was read, and its share in the band. */
export interface TakeMark {
  /** 'silent': no voice came; 'unsteady': too little to read; 'read': a reading. */
  readonly kind: 'silent' | 'unsteady' | 'read'
  /** Seconds in the band over the hold's length, 0 to 1 (0 unless read). */
  readonly share: number
}

/** Every take so far, by hold, and the holds Merc has celebrated. */
export interface HoldRecord {
  readonly takes: Readonly<Record<HoldNo, readonly TakeMark[]>>
  readonly celebrated: Readonly<Record<HoldNo, boolean>>
}

export const emptyRecord = (): HoldRecord => ({
  takes: { 1: [], 2: [] },
  celebrated: { 1: false, 2: false },
})

/** The record with one more take on `hold`. */
export function withTake(
  r: HoldRecord,
  hold: HoldNo,
  take: TakeMark,
): HoldRecord {
  return { ...r, takes: { ...r.takes, [hold]: [...r.takes[hold], take] } }
}

/** The record with `hold` celebrated. */
export function withCelebration(r: HoldRecord, hold: HoldNo): HoldRecord {
  return { ...r, celebrated: { ...r.celebrated, [hold]: true } }
}

/** The latest take with a reading, which the hold counts; null for none. */
export function counted(takes: readonly TakeMark[]): TakeMark | null {
  for (let i = takes.length - 1; i >= 0; i--)
    if (takes[i].kind === 'read') return takes[i]
  return null
}

/** Whether a hold that has had these takes may have another. */
export const againAllowed = (takes: readonly TakeMark[]): boolean =>
  takes.length < TAKES_PER_HOLD

/**
 * Straight after a take: "How did that feel?" unless nothing was sung, when
 * the reading asks again with Again (while the hold allows one) and Done
 * for today.
 */
export function afterTake(
  hold: HoldNo,
  r: HoldRecord,
): { readonly ask: boolean; readonly again: boolean } {
  const takes = r.takes[hold]
  const last = takes[takes.length - 1]
  if (last === undefined || last.kind !== 'silent')
    return { ask: true, again: false }
  return { ask: false, again: againAllowed(takes) }
}

/** What the answer to "How did that feel?" leaves on the card. */
export interface FlowStep {
  /** 'rest': the rest after a hold with none, or one more, to follow; 'end': the two readings after the second; 'gentle': Effortful's close; 'enough': Uncomfortable's. */
  readonly next: 'rest' | 'end' | 'gentle' | 'enough'
  /** The take's own reading stays on the card (after any hold but a second). */
  readonly reading: boolean
  /** The holds' readings together (after the second hold). */
  readonly summary: boolean
  readonly celebrate: boolean
  /** "If that felt tricky, good: that's learning." */
  readonly tricky: boolean
  /** The doctor lines. */
  readonly doctor: boolean
  /** The Wrap's rest card in place of the Voice Mirror card. */
  readonly restCard: boolean
  readonly offers: {
    /** The second, longer hold (Lesson 5's Hold for 15 seconds). */
    readonly nextHold: boolean
    readonly again: boolean
    /** 'today': Done for today; 'done': the same words on the primary button, after the second hold; null: no button at all. */
    readonly done: 'today' | 'done' | null
  }
}

const NO_OFFERS = { nextHold: false, again: false, done: null } as const

/** Whether `hold` is a plan's second hold, whose close reads both holds together. */
const isSecond = (plan: HoldPlan, hold: HoldNo): boolean =>
  hold === 2 && plan.lengths.length === 2

/** Whether the latest take earns Merc's one celebration of the hold. */
function earns(hold: HoldNo, r: HoldRecord): boolean {
  const takes = r.takes[hold]
  const last = takes[takes.length - 1]
  return (
    last?.kind === 'read' &&
    last.share >= CELEBRATE_SHARE &&
    !r.celebrated[hold]
  )
}

/** Whether a take with a reading sat in the band for less than half its length. */
const under = (t: TakeMark | null | undefined): boolean =>
  t?.kind === 'read' && t.share < TRICKY_SHARE

/** "Easy" or "Workable": the rest after a hold, or the two readings after a second. */
function easyStep(plan: HoldPlan, hold: HoldNo, r: HoldRecord): FlowStep {
  const takes = r.takes[hold]
  const last = takes[takes.length - 1]
  const second = isSecond(plan, hold)
  return {
    next: second ? 'end' : 'rest',
    reading: !second,
    summary: second,
    celebrate: earns(hold, r),
    tricky: second
      ? under(counted(r.takes[1])) || under(counted(r.takes[2]))
      : under(last),
    doctor: false,
    restCard: false,
    offers: {
      nextHold: hold < plan.lengths.length && counted(takes) !== null,
      again: againAllowed(takes),
      done: second ? 'done' : 'today',
    },
  }
}

/** The answer to "How did that feel?" after a take on `hold` of `plan` (the record holds that take). */
export function afterFeeling(
  plan: HoldPlan,
  hold: HoldNo,
  feeling: Feeling,
  r: HoldRecord,
): FlowStep {
  if (feeling === 'uncomfortable')
    return {
      next: 'enough',
      reading: false,
      summary: false,
      celebrate: false,
      tricky: false,
      doctor: true,
      restCard: true,
      offers: NO_OFFERS,
    }
  if (feeling === 'effortful')
    return {
      next: 'gentle',
      reading: !isSecond(plan, hold),
      summary: isSecond(plan, hold),
      celebrate: false,
      tricky: false,
      doctor: false,
      // the coach decides whether effort leads to the rest card too
      restCard: plan.restAfterEffort === true,
      offers: { nextHold: false, again: false, done: 'today' },
    }
  return easyStep(plan, hold, r)
}
