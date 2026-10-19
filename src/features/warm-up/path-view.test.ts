// ============================================================
// What the Warm-up path shows, state by state
// ============================================================
//
// The view is pure: a day, the last move and the free run in, the path's
// state, stops, card, chip and Merc's place out (DESIGN-warm-up.md §5 and
// Codex's frames F1 to F4).

import { describe, expect, it } from 'vitest'
import { EXERCISE_ECHO_STARS, EXERCISE_LIP_ROLL_BAY, EXERCISE_LONG_NOTE_LANTERN, EXERCISE_NG_SLIDES_BRIDGE, } from '@/lib/domain/exercise-contracts'
import type { PathInput } from './path-view'
import { countdownSaid, nextLabel, pathView } from './path-view'
import type { StopMark, WarmUpDay } from './routine'
import { finishStop, freshDay, skipStop } from './routine'
import type { WarmUpPlan } from './warm-up-plan'
import { OWNER_ROUTINE } from './warm-up-plan'

const DATE = '2026-10-19'
const fresh = (): WarmUpDay => freshDay(OWNER_ROUTINE, DATE, 0)
const sung = (day: WarmUpDay, index: number, line: string): WarmUpDay =>
  finishStop(day, index, { line, settledNote: null }, 0)

const input = (day: WarmUpDay, more: Partial<PathInput> = {}): PathInput => ({
  day,
  last: null,
  canStart: true,
  minutes: 3,
  ...more,
})

/** Every room sung, the frames' results. */
function allSung(): WarmUpDay {
  let day = fresh()
  for (const [i, line] of [
    '86% lit',
    '92% lit',
    '12.6 s',
    '8 of 9 on pitch',
  ].entries()) {
    day = sung(day, i, line)
  }
  return day
}

describe('the first visit (F1 screen 2)', () => {
  const view = pathView(input(fresh()))

  it('says the minutes, Lip roll next, and Merc on the floor', () => {
    expect(view.state).toBe('start')
    expect(view.chip).toBe('3 min')
    expect(view.next).toBe(0)
    expect(view.card).toBeNull()
    expect(view.merc).toEqual({ at: 'floor' })
  })

  it('names the four rooms and the song, bottom up, with their glyphs', () => {
    expect(view.stops.map((s) => s.name)).toEqual([
      'Lip roll',
      'Ng slides',
      'Long note',
      'Echo',
      'Your song',
    ])
    expect(view.stops.map((s) => s.glyph)).toEqual([
      'wave',
      'arch',
      'lantern',
      'stars',
      'notes',
    ])
    expect(view.stops.map((s) => s.orb)).toEqual([
      'next',
      'waiting',
      'waiting',
      'waiting',
      'waiting',
    ])
    expect(view.stops.map((s) => s.said)).toEqual([
      'Lip roll, next',
      'Ng slides, waiting',
      'Long note, waiting',
      'Echo, waiting',
      'Your song, waiting',
    ])
  })
})

describe('back from a stop (F3)', () => {
  it("shows the stop's card with Again, the next stop lit, Merc beside it", () => {
    const view = pathView(
      input(sung(fresh(), 0, '86% lit'), { last: { index: 0, state: 'done' } }),
    )
    expect(view.state).toBe('between')
    expect(view.card).toEqual({ line: 'Lip roll: 86% lit', again: 0 })
    expect(view.chip).toBeNull()
    expect(view.next).toBe(1)
    expect(view.stops.map((s) => s.orb).slice(0, 2)).toEqual(['done', 'next'])
    expect(view.stops[0]?.said).toBe('Lip roll, done, 86% lit')
    expect(view.merc).toEqual({ at: 'beside', index: 1 })
  })

  it('a skipped stop: its card has no Again, and "Skipped" sits under it', () => {
    const day = skipStop(sung(fresh(), 0, '86% lit'), 1, 0)
    const view = pathView(input(day, { last: { index: 1, state: 'skipped' } }))
    expect(view.card).toEqual({ line: 'Ng slides skipped', again: null })
    expect(view.stops[1]?.line).toBe('Skipped')
    expect(view.stops[1]?.said).toBe('Ng slides, skipped')
    expect(view.next).toBe(2)
  })

  it('a last move the run no longer has (a new day) shows no card', () => {
    const view = pathView(input(fresh(), { last: { index: 0, state: 'done' } }))
    expect(view.state).toBe('start')
    expect(view.card).toBeNull()
  })
})

describe('coming back the same day (F1 screen 3, N4)', () => {
  it('"1 of 4 today", the results under the names, Merc beside the next', () => {
    const day = skipStop(sung(fresh(), 0, '86% lit'), 1, 0)
    const view = pathView(input(day))
    expect(view.state).toBe('resume')
    expect(view.chip).toBe('1 of 4 today')
    expect(nextLabel(view.stops[view.next!]!.name)).toBe('Next: Long note')
    expect(view.stops.map((s) => s.line)).toEqual([
      '86% lit',
      'Skipped',
      null,
      null,
      null,
    ])
    expect(view.merc).toEqual({ at: 'beside', index: 2 })
  })
})

describe('the end (F4 screen 1)', () => {
  it('every stop lit with its result, the song too; Merc on the song', () => {
    const view = pathView(
      input(allSung(), { last: { index: 3, state: 'done' } }),
    )
    expect(view.state).toBe('end')
    expect(view.today).toBe('4 of 4 today')
    expect(view.next).toBeNull()
    expect(view.card).toBeNull()
    expect(view.stops.map((s) => s.orb)).toEqual(Array(5).fill('lit'))
    expect(view.stops.map((s) => s.line)).toEqual([
      '86% lit',
      '92% lit',
      '12.6 s',
      '8 of 9 on pitch',
      null,
    ])
    expect(view.merc).toEqual({ at: 'on', index: 4 })
  })

  it('"3 of 4 today" with a stop skipped', () => {
    let day = sung(fresh(), 0, '86% lit')
    day = skipStop(day, 1, 0)
    day = sung(day, 2, '12.6 s')
    day = sung(day, 3, '8 of 9 on pitch')
    const view = pathView(input(day, { last: { index: 3, state: 'done' } }))
    expect(view.state).toBe('end')
    expect(view.today).toBe('3 of 4 today')
    expect(view.stops[1]?.orb).toBe('waiting')
  })

  it('every stop skipped: back to the first visit', () => {
    let day = fresh()
    for (const i of [0, 1, 2, 3]) day = skipStop(day, i, 0)
    const view = pathView(input(day, { last: { index: 3, state: 'skipped' } }))
    expect(view.state).toBe('start')
    expect(view.chip).toBe('3 min')
  })
})

describe('opened again that day (F4 screen 2, N5)', () => {
  it('"Warmed up today", the path lit, Merc on the song, no card', () => {
    const view = pathView(input(allSung()))
    expect(view.state).toBe('done')
    expect(view.chip).toBe('Warmed up today')
    expect(view.card).toBeNull()
    expect(view.merc).toEqual({ at: 'on', index: 4 })
  })

  it("draws this week's dots under it, today filled before its date is synced", () => {
    // Monday 19 Oct; another device warmed up last Sunday, outside the week.
    const view = pathView(input(allSung(), { days: ['2026-10-18'] }))
    expect(
      view.week?.map(
        (dot) => `${dot.warmed ? 'x' : '.'}${dot.today ? 'o' : ''}`,
      ),
    ).toEqual(['xo', '.', '.', '.', '.', '.', '.'])
  })

  it('has no dots in any other state, the end included', () => {
    const days = ['2026-10-19']
    expect(pathView(input(fresh(), { days })).week).toBeNull()
    expect(
      pathView(input(sung(fresh(), 0, '86% lit'), { days })).week,
    ).toBeNull()
    const end = pathView(
      input(allSung(), { days, last: { index: 3, state: 'done' } }),
    )
    expect(end.state).toBe('end')
    expect(end.week).toBeNull()
  })
})

describe('the free run used (F4 screen 3, N3)', () => {
  it('the first visit, nothing next, the minutes still said', () => {
    const view = pathView(input(fresh(), { canStart: false }))
    expect(view.state).toBe('locked')
    expect(view.chip).toBe('3 min')
    expect(view.stops[0]?.orb).toBe('waiting')
  })
})

describe('any plan (pw-stops)', () => {
  it('draws as many stops as the plan has, in its order', () => {
    const plan: WarmUpPlan = {
      id: 'long',
      stops: [
        { kind: 'room', id: EXERCISE_ECHO_STARS },
        { kind: 'room', id: EXERCISE_LIP_ROLL_BAY },
        { kind: 'room', id: EXERCISE_NG_SLIDES_BRIDGE },
        { kind: 'room', id: EXERCISE_LONG_NOTE_LANTERN },
        { kind: 'room', id: EXERCISE_LIP_ROLL_BAY },
        { kind: 'room', id: EXERCISE_ECHO_STARS },
        { kind: 'song', opens: 'song-list' },
      ],
    }
    const marks: StopMark[] = plan.stops.map(() => ({ state: 'waiting' }))
    const view = pathView(input({ ...freshDay(plan, DATE, 0), marks }))
    expect(view.stops.map((s) => s.name)).toEqual([
      'Echo',
      'Lip roll',
      'Ng slides',
      'Long note',
      'Lip roll',
      'Echo',
      'Your song',
    ])
  })
})

describe('the countdown, said once', () => {
  it('names the stop, the seconds and the way to wait', () => {
    expect(countdownSaid('Ng slides', 5)).toBe(
      'Next: Ng slides in 5 seconds. Choose Stay here to wait.',
    )
  })
})
