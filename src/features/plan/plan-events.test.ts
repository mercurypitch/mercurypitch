// ============================================================
// Plan events — what the funnel is told, and that the catalog can take it
// ============================================================
//
// Three promises. The answers are reported once, as one name per option,
// and a question that was passed is named too, so a missing answer is never
// mistaken for a missing event. Not now names the question it came on and
// reports only the questions before it. And the catalog, which the worker
// reads and which cannot import the questions, lists exactly the events the
// questions and the flow can send: the names the catalog holds are checked
// against the ones this module derives from the questions, so adding an
// option without adding its event fails here, not in a report that stays
// empty. The last block holds the catalog to being plain literals, because
// the worker imports it and a browser-only import would break that build.

import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { GUIDE_FUNNEL_EVENTS } from '@/lib/funnel-event-catalog'
import { allPlanEventNames, planDeclinedEvents, planDoneEvents, } from './plan-events'
import type { PlanChoices, Q1Answer } from './questions'
import { EMPTY_CHOICES, INSTRUMENTS, q2Options, q3Options, q4Options, } from './questions'

/** Choices with only the fields a case cares about; the rest stay empty. */
const choices = (c: Partial<PlanChoices>): PlanChoices => ({
  ...EMPTY_CHOICES,
  q3: [],
  q4: [],
  ...c,
})

/** Every first answer, a skipped one included: each offers its own options. */
const FIRST_ANSWERS: readonly (Q1Answer | null)[] = [
  ...INSTRUMENTS.map((i) => i.id),
  'everything',
  null,
]

/** The thirty answer names, as the spec lists them: one for each option of every column. */
const ANSWER_NAMES = [
  'plan_q1_singing',
  'plan_q1_guitar',
  'plan_q1_piano',
  'plan_q1_ear',
  'plan_q1_everything',
  'plan_q2_song',
  'plan_q2_together',
  'plan_q2_audition',
  'plan_q2_basics',
  'plan_q2_fun',
  'plan_q2_tune',
  'plan_q2_intervals',
  'plan_q2_exam',
  'plan_q2_by_ear',
  'plan_q2_curious',
  'plan_q3_time',
  'plan_q3_progress',
  'plan_q3_what',
  'plan_q3_tune',
  'plan_q3_difference',
  'plan_q3_tempo',
  'plan_q3_setup',
  'plan_q3_shy',
  'plan_q3_alone',
  'plan_q3_other',
  'plan_q4_video',
  'plan_q4_teacher',
  'plan_q4_app',
  'plan_q4_along',
  'plan_q4_starting',
]

/** The twenty names the flow itself sends, as the spec lists them. */
const FLOW_NAMES = [
  'plan_shown_new',
  'plan_shown_existing',
  'plan_shown_skipper',
  'plan_skipped_q1',
  'plan_skipped_q2',
  'plan_skipped_q3',
  'plan_skipped_q4',
  'plan_declined_q1',
  'plan_declined_q2',
  'plan_declined_q3',
  'plan_declined_q4',
  'plan_skipped_plan',
  'plan_done',
  'plan_rooms',
  'plan_stop_start',
  'plan_stop_learn',
  'plan_stop_play',
  'scope_offer_accept',
  'showcase_done',
  'showcase_skipped',
]

/** The catalog's plan names: everything in the guide list that is not a tour or a first value. */
const planNamesInCatalog = (): string[] =>
  GUIDE_FUNNEL_EVENTS.filter(
    (e) => !e.startsWith('tour_') && !e.startsWith('first_value_'),
  )

describe('a finished plan', () => {
  it('reports a finished plan once, picks and skips together', () => {
    expect(
      planDoneEvents({
        q1: 'guitar',
        q2: null,
        q3: ['time', 'alone'],
        q4: ['app'],
      }),
    ).toEqual([
      'plan_q1_guitar',
      'plan_skipped_q2',
      'plan_q3_time',
      'plan_q3_alone',
      'plan_q4_app',
      'plan_done',
    ])
  })

  it('names every question as skipped when nothing was answered', () => {
    expect(planDoneEvents(EMPTY_CHOICES)).toEqual([
      'plan_skipped_q1',
      'plan_skipped_q2',
      'plan_skipped_q3',
      'plan_skipped_q4',
      'plan_done',
    ])
  })

  it('reports Q3 and Q4 picks in the order they were tapped', () => {
    expect(
      planDoneEvents(
        choices({ q1: 'ear', q3: ['setup', 'time'], q4: ['video', 'teacher'] }),
      ),
    ).toEqual([
      'plan_q1_ear',
      'plan_skipped_q2',
      'plan_q3_setup',
      'plan_q3_time',
      'plan_q4_video',
      'plan_q4_teacher',
      'plan_done',
    ])
  })

  it('reports "A bit of everything" under its own name', () => {
    expect(planDoneEvents(choices({ q1: 'everything' }))[0]).toBe(
      'plan_q1_everything',
    )
  })

  it('leaves the choices it is given as they were', () => {
    const c = choices({ q1: 'piano', q3: ['time'], q4: ['starting'] })
    const before = JSON.stringify(c)

    planDoneEvents(c)
    planDeclinedEvents(c, 'q4')

    expect(JSON.stringify(c)).toBe(before)
  })

  it('reports an event the catalog knows for every answer a person can give', () => {
    const catalog = new Set<string>(GUIDE_FUNNEL_EVENTS)
    const unknown: string[] = []
    const check = (c: PlanChoices): void => {
      unknown.push(...planDoneEvents(c).filter((e) => !catalog.has(e)))
    }
    for (const q1 of FIRST_ANSWERS) {
      check(choices({ q1 }))
      for (const o of q2Options(q1)) check(choices({ q1, q2: o.id }))
      for (const o of q3Options(q1)) check(choices({ q1, q3: [o.id] }))
      for (const o of q4Options(q1)) check(choices({ q1, q4: [o.id] }))
    }

    expect(unknown).toEqual([])
  })
})

describe('Not now', () => {
  it('reports Not now with the question it came on', () => {
    expect(
      planDeclinedEvents({ q1: 'singing', q2: 'fun', q3: [], q4: [] }, 'q3'),
    ).toEqual(['plan_q1_singing', 'plan_q2_fun', 'plan_declined_q3'])
  })

  it('reports only the questions before the one it came on', () => {
    const all = choices({
      q1: 'guitar',
      q2: 'song',
      q3: ['time', 'tempo'],
      q4: ['app'],
    })

    expect(planDeclinedEvents(all, 'q1')).toEqual(['plan_declined_q1'])
    expect(planDeclinedEvents(all, 'q2')).toEqual([
      'plan_q1_guitar',
      'plan_declined_q2',
    ])
    expect(planDeclinedEvents(all, 'q3')).toEqual([
      'plan_q1_guitar',
      'plan_q2_song',
      'plan_declined_q3',
    ])
    expect(planDeclinedEvents(all, 'q4')).toEqual([
      'plan_q1_guitar',
      'plan_q2_song',
      'plan_q3_time',
      'plan_q3_tempo',
      'plan_declined_q4',
    ])
  })

  it('names the questions passed before Not now as skipped', () => {
    expect(planDeclinedEvents(EMPTY_CHOICES, 'q4')).toEqual([
      'plan_skipped_q1',
      'plan_skipped_q2',
      'plan_skipped_q3',
      'plan_declined_q4',
    ])
  })
})

describe('the catalog and the questions', () => {
  it('keeps the catalog and the questions in step', () => {
    expect(new Set(allPlanEventNames())).toEqual(new Set(planNamesInCatalog()))
  })

  it('names each event once, thirty answers and twenty from the flow', () => {
    const names = allPlanEventNames()

    expect(names).toHaveLength(50)
    expect(new Set(names).size).toBe(50)
    expect(planNamesInCatalog()).toHaveLength(50)
    expect([...names].sort()).toEqual([...ANSWER_NAMES, ...FLOW_NAMES].sort())
  })
})

describe('the catalog the worker imports', () => {
  it('writes the plan names as plain literals, with no import', () => {
    const source = readFileSync('src/lib/funnel-event-catalog.ts', 'utf8')

    expect(ts.preProcessFile(source, true, true).importedFiles).toEqual([])
  })
})
