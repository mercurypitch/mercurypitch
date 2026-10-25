// ============================================================
// plan-choices.fixture — the answers the plan's tests share, and a clean slate to answer them on
// ============================================================
//
// The plan's rules and its Home card are tested in several files, and each had
// written out the same few sets of answers and the same lines that put the
// plan's state back. They are said once here. It renders nothing and asserts
// nothing, so any test may read it. That is why it is a fixture of its own and
// not part of PlanLayer.fixture.tsx, which mounts the whole layer and cannot be
// imported by a test of a rule or a card.
//
// The stores are the real ones. A case that writes to them (a record, a first
// value, a stop opened) starts from `fresh()`: `localStorage.clear()` does not
// reach the module signals the plan keeps over its keys, and a record left by
// one case would be the next case's starting point.

import type { FirstValueKind } from '@/lib/first-value'
import { FIRST_VALUE_KEY, resetFirstValueForTests } from '@/lib/first-value'
import { GUIDE_FUNNEL_STORAGE_KEY } from '@/lib/guide-funnel'
import { applyPersistedValue } from '@/lib/storage'
import { setPracticeScope, setUiMode } from '@/stores/settings-store'
import { PLAN_OPENED_KEY, PLAN_RECORD_KEY } from './plan-keys'
import type { PlanRecordV1, PlanTexts } from './plan-record'
import { closePlanLayer, savePlanAnswers } from './plan-store'
import type { PlanChoices } from './questions'

// ── Answers, each named for the plan it makes ──────────────────────────

export const DAY = 24 * 60 * 60 * 1000

/** Nothing typed under "Something else". */
export const NO_TEXTS: PlanTexts = { q3other: '', q4app: '' }

/** Singing for an audition: Start here Sing, Learn Hear Yourself, Play Karaoke Night. */
export const AUDITION: PlanChoices = {
  q1: 'singing',
  q2: 'audition',
  q3: ['progress', 'tune'],
  q4: ['teacher'],
}

/** Just starting to sing: Start here Sing, Learn Lesson 1 (a page, which has no first value). */
export const STARTING: PlanChoices = {
  q1: 'singing',
  q2: null,
  q3: [],
  q4: ['starting'],
}

/** Singing with other people: Start here Sing, Play Jam, which a narrower menu hides. */
export const TOGETHER: PlanChoices = {
  q1: 'singing',
  q2: 'together',
  q3: [],
  q4: [],
}

/** Only the first question answered: a plan of Start here Sing alone. */
export const SINGING_ONLY: PlanChoices = {
  q1: 'singing',
  q2: null,
  q3: [],
  q4: [],
}

/** Singing with no time to spare: Start here is today's session, on Home. */
export const SHORT_ON_TIME: PlanChoices = {
  q1: 'singing',
  q2: null,
  q3: ['time'],
  q4: [],
}

// ── The device ─────────────────────────────────────────────────────────

/** The plan as nobody has met it: no record, nothing opened, no first value, a whole menu. */
export function fresh(): void {
  localStorage.clear()
  applyPersistedValue(PLAN_RECORD_KEY, 'null', { persist: false })
  applyPersistedValue(PLAN_OPENED_KEY, '[]', { persist: false })
  resetFirstValueForTests()
  closePlanLayer()
  setPracticeScope('all')
  setUiMode('advanced')
}

/** A moment `days` days ago, for a record that was written then. */
export const ago = (days: number): Date => new Date(Date.now() - days * DAY)

/** Saves the answers of someone who answered `days` days ago. */
export function answeredAgo(
  days: number,
  choices: PlanChoices = AUDITION,
): void {
  savePlanAnswers(choices, NO_TEXTS, null, ago(days))
}

/**
 * A plan answered on another device lands here, as the settings pull applies
 * it: after a sign-in, the account's plan arrives once the page has already
 * read its own.
 */
export function answeredElsewhere(choices: PlanChoices): void {
  const record: PlanRecordV1 = {
    v: 1,
    status: 'answered',
    choices,
    at: '2026-10-20T10:00:00.000Z',
    via: 'first-light',
    syncedAt: '2026-10-20T10:00:01.000Z',
  }
  applyPersistedValue(PLAN_RECORD_KEY, JSON.stringify(record))
}

/** Gives the device exactly these first values, as saved runs and finished songs do. */
export function seeFirstValue(...kinds: FirstValueKind[]): void {
  localStorage.setItem(
    FIRST_VALUE_KEY,
    JSON.stringify(
      Object.fromEntries(
        kinds.map((kind) => [kind, '2026-10-20T12:00:00.000Z']),
      ),
    ),
  )
}

/** What the guide funnel was told since the case began, in order. */
export function sent(): string[] {
  const raw = localStorage.getItem(GUIDE_FUNNEL_STORAGE_KEY) ?? '[]'
  return (JSON.parse(raw) as { event: string }[]).map((entry) => entry.event)
}
