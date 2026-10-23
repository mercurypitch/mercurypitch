// ============================================================
// plan-sync.fixture — the answers, dates and tokens the sync's tests share
// ============================================================
//
// Data and builders only: it renders nothing, asserts nothing and touches no
// store, so a test reads it as a table of what the sync is given and what the
// account should be sent. The dates are fixed so that a synced date can be
// compared exactly.

import type { PlanResponseV1 } from '@/db/services/survey-service'
import type { PlanTexts } from './plan-record'
import type { PlanChoices } from './questions'

/** When the first plan was answered. */
export const NOW = new Date('2026-10-20T12:00:00.000Z')

/** When a changed plan was answered. */
export const LATER = new Date('2026-10-21T09:30:00.000Z')

/** The moment the sync runs at, so the synced date is exact. */
export const SYNCED = new Date('2026-10-22T08:00:00.000Z')

/** Picks both options a person types under, so both lines are kept. */
export const TYPED: PlanChoices = {
  q1: 'singing',
  q2: 'audition',
  q3: ['progress', 'other'],
  q4: ['app'],
}

/** Picks neither of those options. */
export const OTHER: PlanChoices = {
  q1: 'guitar',
  q2: 'song',
  q3: ['time'],
  q4: [],
}

export const LINES: PlanTexts = {
  q3other: 'my neighbours can hear everything',
  q4app: 'Duolingo for guitar',
}

export const NO_LINES: PlanTexts = { q3other: '', q4app: '' }

/** What the account is given for an answered plan. */
export const sentFor = (
  choices: PlanChoices,
  texts: PlanTexts,
  at: Date,
): PlanResponseV1 => ({
  kind: 'plan',
  v: 1,
  status: 'answered',
  choices,
  texts,
  at: at.toISOString(),
})

/** What the account is given for TYPED and LINES, answered at NOW. */
export const SENT = sentFor(TYPED, LINES, NOW)

/** What a newer client wrote: not a version this one can read. */
export const FUTURE = JSON.stringify({
  v: 2,
  status: 'answered',
  choices: TYPED,
  at: NOW.toISOString(),
  via: 'layer',
})

/** A token as the account check reads it: a payload with a provider and an end. */
export function tokenFor(provider: string, secondsLeft = 3600): string {
  const exp = Math.floor(Date.now() / 1000) + secondsLeft
  const payload = { sub: 'user-1', provider, exp }
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `header.${body}.signature`
}
