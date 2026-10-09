// ============================================================
// offer-rules — the launch offer's rule, as pure functions
// ============================================================
//
// "Finish five, double up" (launch offer plan, design B; owner decisions D1,
// D3, D4, D9): an account that uses all of its launch credits within 14
// days of claiming them gets 30 extra credits on its next pack.
//
//   - The window runs from the start of the claim's UTC day to the end of
//     the UTC day 14 days later. Both days count in full, so "Use all 5 by
//     23 October" holds until midnight UTC on the 23rd.
//   - An account that claimed before the offer started (OFFER_START_AT)
//     counts from that day instead.
//   - "Used" is credits spent on separations on the web (`uvr-job` debits)
//     inside the window, less what a failed job gave back (`uvr-refund`,
//     matched by jobRef, whenever it came). Credits are interchangeable: any
//     five count, the launch ones or a pack's.
//   - Earning it is written once (offerUnlocks) and never taken back, and the
//     reward does not expire (D4): only the window for earning it closes.
//
// launch-finisher.ts reads the facts from D1 and writes the unlock and the
// bonus; this file decides.

import type { Env } from './auth'
import type { LedgerRow } from './songs-allowance'
import { SEPARATION_REFUND, WEB_SEPARATION } from './songs-allowance'

/** The offer's name in offerUnlocks, in checkout metadata and on the bonus
 *  row's jobRef. */
export const FINISHER_CAMPAIGN = 'launch-finisher'
/** The launch promo code (migration 0054). */
const DEFAULT_PROMO_ID = 'promo-2026-q4'
const DEFAULT_WINDOW_DAYS = 14
const DEFAULT_BONUS_CREDITS = 30
const DAY_MS = 24 * 60 * 60 * 1000

export type FinisherEnv = Pick<
  Env,
  | 'OFFER_START_AT'
  | 'OFFER_FINISHER_DAYS'
  | 'OFFER_BONUS_CREDITS'
  | 'OFFER_PROMO_ID'
>

export interface FinisherConfig {
  /** The promo code whose claim starts an account's window. */
  promoId: string
  /** The first moment the offer counts: 00:00 UTC of OFFER_START_AT. */
  startsAt: number
  /** Days the window stays open after the day it starts. */
  windowDays: number
  /** Extra credits on the next pack. */
  bonusCredits: number
}

function utcDayStart(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS
}

/** A whole number from 1 to `max`, or `fallback`. */
function count(value: string | undefined, max: number, fallback: number) {
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 && n <= max ? n : fallback
}

/** The promo code whose claim starts the window, whether or not the offer
 *  is on: a bonus promised at checkout is recorded under it either way. */
export function finisherPromoId(env: FinisherEnv): string {
  const promoId = (env.OFFER_PROMO_ID ?? '').trim()
  return promoId === '' ? DEFAULT_PROMO_ID : promoId
}

/** The offer's settings, or null while it is off: OFFER_START_AT unset or
 *  not a date. */
export function finisherConfig(env: FinisherEnv): FinisherConfig | null {
  const start = Date.parse(env.OFFER_START_AT ?? '')
  if (!Number.isFinite(start)) return null
  return {
    promoId: finisherPromoId(env),
    startsAt: utcDayStart(start),
    windowDays: count(env.OFFER_FINISHER_DAYS, 90, DEFAULT_WINDOW_DAYS),
    bonusCredits: count(env.OFFER_BONUS_CREDITS, 1000, DEFAULT_BONUS_CREDITS),
  }
}

export interface FinisherWindow {
  /** 00:00:00.000 UTC of the first day. */
  start: number
  /** 23:59:59.999 UTC of the last day. */
  end: number
}

export function finisherWindow(
  claimedAt: number,
  config: FinisherConfig,
): FinisherWindow {
  const start = utcDayStart(Math.max(claimedAt, config.startsAt))
  return { start, end: start + (config.windowDays + 1) * DAY_MS - 1 }
}

/** Credits spent on web separations inside the window, less what failed
 *  jobs gave back. */
export function creditsUsed(
  rows: readonly LedgerRow[],
  window: FinisherWindow,
): number {
  const spent = new Map<string, number>()
  for (const row of rows) {
    if (row.reason !== WEB_SEPARATION || row.jobRef === null) continue
    const at = Date.parse(row.createdAt ?? '')
    if (!(at >= window.start && at <= window.end)) continue
    const debit = -Number(row.delta)
    if (debit > 0) spent.set(row.jobRef, (spent.get(row.jobRef) ?? 0) + debit)
  }
  for (const row of rows) {
    if (row.reason !== SEPARATION_REFUND || row.jobRef === null) continue
    const debit = spent.get(row.jobRef)
    if (debit !== undefined) spent.set(row.jobRef, debit - Number(row.delta))
  }
  let used = 0
  for (const credits of spent.values()) used += Math.max(0, credits)
  return used
}

/** What GET /api/billing/me says of the offer. */
export interface FinisherOffer {
  /** counting: the window is open. unlocked: earned, waiting for a pack.
   *  used: the bonus came with a pack. lapsed: the window closed short. */
  state: 'counting' | 'unlocked' | 'used' | 'lapsed'
  /** Credits used in the window, never more than `goal`. */
  used: number
  /** The launch credits the claim gave: what there is to use. */
  goal: number
  /** The last moment of the window, ISO, in UTC. */
  deadline: string
  /** Extra credits on the next pack. */
  bonusCredits: number
}

export interface FinisherFacts {
  /** When the account claimed the code, ms. */
  claimedAt: number
  /** The credits the code gave. */
  goal: number
  /** The account's ledger rows, with createdAt. */
  rows: readonly LedgerRow[]
  /** offerUnlocks holds a row for the account. */
  unlocked: boolean
  /** The bonus row exists: the reward came with a pack. */
  bonusGranted: boolean
}

/** Where an account stands. An `unlocked` answer with `facts.unlocked`
 *  false is earned now: the caller writes the unlock. */
export function finisherState(
  facts: FinisherFacts,
  config: FinisherConfig,
  now: number,
): FinisherOffer {
  const window = finisherWindow(facts.claimedAt, config)
  const base = {
    goal: facts.goal,
    deadline: new Date(window.end).toISOString(),
    bonusCredits: config.bonusCredits,
  }
  if (facts.bonusGranted) return { state: 'used', used: facts.goal, ...base }
  if (facts.unlocked) return { state: 'unlocked', used: facts.goal, ...base }
  const used = creditsUsed(facts.rows, window)
  if (used >= facts.goal) {
    return { state: 'unlocked', used: facts.goal, ...base }
  }
  return { state: now > window.end ? 'lapsed' : 'counting', used, ...base }
}
