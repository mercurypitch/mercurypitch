// ============================================================
// Store-shot fixtures — a fictional lived-in week, built by the core itself
// ============================================================
//
// Every record comes out of the same pure transitions the app runs
// (createCue, activateCue, setDailyTargetTimeRule, createManualOccurrence,
// recordOccurrenceOutcome) and passes the validation the app applies on
// load, so a fixture cannot hold a state the app could never have written.
//
// The plan uses catalogue strings only (src/content/pulls.ts, actions.ts),
// stored in the shape finishSetup stores them. No names, no personal text.

import type { BesideCueStateV1, CueOccurrenceOutcome, } from '@irchiinnuss/beside-cue-core'
import { activateCue, addLocalDays, aggregateSevenDayBSides, assertStateIdentityInvariants, createCue, createInitialState, createManualOccurrence, recordOccurrenceOutcome, setDailyTargetTimeRule, } from '@irchiinnuss/beside-cue-core'
import type { Page } from '@playwright/test'

/** The page clock starts here: a Thursday evening, just after the reminder. */
export const SHOT_NOW = '2026-09-10T18:40:00.000Z'
/** SHOT_NOW's calendar date. The shot projects run with timezoneId UTC. */
const SHOT_TODAY = '2026-09-10'

// Storage the app owns, mirrored rather than imported: app modules would pull
// the whole content graph into the Playwright process. A drifted value fails
// loudly, because the app then opens on another screen and the landmark wait
// times out.
/** src/app-config.ts, onboarding.revision */
const ONBOARDING_REVISION = 'beside-cue-v2.5-main-v1'
/** src/onboarding/cinematic-onboarding-preference.ts */
const ONBOARDING_PREFERENCE_KEY = 'beside-cue:cinematic-onboarding'
/** src/infrastructure/indexed-db-repository.ts */
const SNAPSHOT_DATABASE = {
  name: 'beside-cue',
  version: 1,
  store: 'state',
  key: 'current',
} as const

export interface DeviceSeed {
  /** Written to IndexedDB exactly as the app's repository saves it. */
  readonly state?: BesideCueStateV1
  readonly localStorage: Readonly<Record<string, string>>
}

/** The one plan of the lived-in week. */
export const LIVED_IN_PLAN = {
  pullCategoryId: 'scrolling',
  pullLabel: 'Endless scrolling',
  /** A built-in Pull is saved with its defaultSideAText as Side A. */
  pullText: 'Keep scrolling',
  cueContextSuggestionId: 'anchor.scrolling.open-feed',
  cueContextText: 'When I open the feed without deciding to.',
  bSideSuggestionId: 'bside.street-walk',
  bSideText: 'Walk to the end of the street.',
  reminderTime: '18:30',
} as const

const CUE_ID = 'shots-plan-scrolling'
const RULE_ID = 'shots-reminder-evening'
const PLAN_SAVED_AT = '2026-09-03T20:12:00.000Z'

interface Turn {
  readonly daysAgo: number
  /** HH:MM in UTC. */
  readonly at: string
  readonly outcome: CueOccurrenceOutcome
}

/** Seven days ending today: mostly Side B, two "not now", one quiet day. */
const WEEK: readonly Turn[] = [
  { daysAgo: 6, at: '18:33', outcome: 'b_side' },
  { daysAgo: 5, at: '11:10', outcome: 'b_side' },
  { daysAgo: 5, at: '18:36', outcome: 'b_side' },
  { daysAgo: 4, at: '18:31', outcome: 'b_side' },
  { daysAgo: 3, at: '18:34', outcome: 'not_now' },
  { daysAgo: 2, at: '18:32', outcome: 'b_side' },
  { daysAgo: 2, at: '21:05', outcome: 'b_side' },
  { daysAgo: 1, at: '16:45', outcome: 'not_now' },
  { daysAgo: 1, at: '18:31', outcome: 'b_side' },
  { daysAgo: 1, at: '20:14', outcome: 'b_side' },
  { daysAgo: 1, at: '22:02', outcome: 'b_side' },
  { daysAgo: 0, at: '18:32', outcome: 'b_side' },
]

function livedInWeekState(): BesideCueStateV1 {
  const plan = LIVED_IN_PLAN
  let state = createCue(createInitialState(), {
    id: CUE_ID,
    pullCategoryId: plan.pullCategoryId,
    pullText: plan.pullText,
    cueContextSuggestionId: plan.cueContextSuggestionId,
    cueContextText: plan.cueContextText,
    bSideSuggestionId: plan.bSideSuggestionId,
    bSideText: plan.bSideText,
    mascotSetId: 'corktop-v1',
    at: PLAN_SAVED_AT,
  }).state
  state = activateCue(state, CUE_ID, PLAN_SAVED_AT).state
  state = setDailyTargetTimeRule(state, {
    id: RULE_ID,
    cueId: CUE_ID,
    localTime: plan.reminderTime,
    at: PLAN_SAVED_AT,
  }).state

  for (const turn of WEEK) {
    const date = addLocalDays(SHOT_TODAY, -turn.daysAgo)
    const openedAt = `${date}T${turn.at}:00.000Z`
    const id = `shots-turn-${date}-${turn.at.replace(':', '')}`
    state = createManualOccurrence(state, {
      id,
      cueId: CUE_ID,
      at: openedAt,
    }).state
    state = recordOccurrenceOutcome(state, {
      occurrenceId: id,
      outcome: turn.outcome,
      outcomeAt: new Date(Date.parse(openedAt) + 90_000).toISOString(),
      outcomeLocalDate: date,
    }).state
  }

  assertStateIdentityInvariants(state)
  return state
}

function onboardingSeen(): Record<string, string> {
  return {
    [ONBOARDING_PREFERENCE_KEY]: JSON.stringify({
      revision: ONBOARDING_REVISION,
      outcome: 'finished',
      recordedAt: PLAN_SAVED_AT,
    }),
  }
}

/** A returning user: onboarding seen, one plan, a reminder, a week of turns. */
export function livedInWeek(): DeviceSeed {
  return { state: livedInWeekState(), localStorage: onboardingSeen() }
}

/** The seven-day totals Reflection must show for livedInWeek(). */
export function livedInWeekTotals(): { today: number; week: number } {
  const progress = aggregateSevenDayBSides(livedInWeekState(), SHOT_TODAY)
  return { today: progress.today, week: progress.total }
}

/** Onboarding seen and no plan yet: the app opens on Welcome. */
export function onboardingSeenNoPlan(): DeviceSeed {
  return { localStorage: onboardingSeen() }
}

/**
 * Loads the origin once, writes the seed where the app keeps its data, then
 * opens `path` in a fresh document, so the app boots on the seed the way it
 * boots on a device.
 */
export async function seedDevice(
  page: Page,
  seed: DeviceSeed,
  path = '/',
): Promise<void> {
  await page.goto('/')
  await page.locator('main').first().waitFor()
  await page.evaluate(
    async ({ database, state, storage }) => {
      for (const [key, value] of Object.entries(storage)) {
        window.localStorage.setItem(key, value)
      }
      if (state === null) return

      const connection = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = window.indexedDB.open(database.name, database.version)
        request.addEventListener('upgradeneeded', () => {
          if (!request.result.objectStoreNames.contains(database.store)) {
            request.result.createObjectStore(database.store)
          }
        })
        request.addEventListener('success', () => resolve(request.result))
        request.addEventListener('error', () =>
          reject(
            request.error ?? new Error('The snapshot store did not open.'),
          ),
        )
        request.addEventListener('blocked', () =>
          reject(new Error('The snapshot store is blocked by another tab.')),
        )
      })
      try {
        const transaction = connection.transaction(database.store, 'readwrite')
        transaction.objectStore(database.store).put(state, database.key)
        await new Promise<void>((resolve, reject) => {
          transaction.addEventListener('complete', () => resolve())
          transaction.addEventListener('abort', () =>
            reject(transaction.error ?? new Error('The seed write aborted.')),
          )
          transaction.addEventListener('error', () =>
            reject(transaction.error ?? new Error('The seed write failed.')),
          )
        })
      } finally {
        connection.close()
      }
    },
    {
      database: SNAPSHOT_DATABASE,
      state: seed.state ?? null,
      storage: seed.localStorage,
    },
  )
  await page.goto(path)
}
