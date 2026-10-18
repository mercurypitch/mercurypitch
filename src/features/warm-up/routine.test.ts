// ============================================================
// The Warm-up's day: every way through four stops, and the day's rules
// ============================================================

import { describe, expect, it } from 'vitest'
import { EXERCISE_ECHO_STARS, EXERCISE_LIP_ROLL_BAY, EXERCISE_NG_SLIDES_BRIDGE, } from '@/lib/domain/exercise-contracts'
import type { WarmUpDay } from './routine'
import { atEnd, canEnter, dayFor, finishStop, freshDay, isWarmUpDay, nextStop, restartDay, roomIndex, skipStop, tally, } from './routine'
import type { WarmUpPlan } from './warm-up-plan'
import { OWNER_ROUTINE } from './warm-up-plan'

const TODAY = '2026-10-18'
const SONG = 4
const LINES = ['86% lit', '92% lit', '12.6 s', '8 of 9 on pitch']

const finished = (line: string, settledNote: number | null = null) => ({
  line,
  settledNote,
})

function fresh(plan: WarmUpPlan = OWNER_ROUTINE): WarmUpDay {
  return freshDay(plan, TODAY, 1000)
}

function states(day: WarmUpDay): string[] {
  return day.marks.map((mark) =>
    mark.state === 'done' ? mark.line : mark.state,
  )
}

describe('a fresh run', () => {
  it('waits at every stop, the first one next, nothing counted', () => {
    const day = fresh()
    expect(states(day)).toEqual(Array(5).fill('waiting'))
    expect(nextStop(day)).toBe(0)
    expect(tally(day)).toEqual({ done: 0, skipped: 0, rooms: 4 })
    expect(atEnd(day)).toBe(false)
    expect(day.warmedUp).toBe(false)
    expect(day.settledNote).toBeNull()
    expect(day.date).toBe(TODAY)
  })
})

describe('the run, stop by stop', () => {
  it('lights each stop with its line, then reaches the end warmed up', () => {
    let day = fresh()
    const nexts: (number | null)[] = []
    LINES.forEach((line, i) => {
      day = finishStop(day, i, finished(line), 2000 + i)
      nexts.push(nextStop(day))
    })
    expect(nexts).toEqual([1, 2, 3, null])
    expect(states(day)).toEqual([...LINES, 'waiting'])
    expect(atEnd(day)).toBe(true)
    expect(day.warmedUp).toBe(true)
    expect(tally(day)).toEqual({ done: 4, skipped: 0, rooms: 4 })
    expect(day.lastActiveAt).toBe(2003)
  })

  it('every way through four stops: each one finished or skipped, in order', () => {
    for (let way = 0; way < 16; way += 1) {
      let day = fresh()
      const sung: boolean[] = []
      for (let i = 0; i < 4; i += 1) {
        const sing = (way & (1 << i)) !== 0
        sung.push(sing)
        expect(nextStop(day), `way ${way}, stop ${i}`).toBe(i)
        day = sing ? finishStop(day, i, finished(LINES[i]!)) : skipStop(day, i)
      }
      const done = sung.filter(Boolean).length
      if (done === 0) {
        // Every stop skipped: back to the start, nothing counted.
        expect(states(day), `way ${way}`).toEqual(Array(5).fill('waiting'))
        expect(day.warmedUp, `way ${way}`).toBe(false)
        expect(nextStop(day), `way ${way}`).toBe(0)
        continue
      }
      expect(states(day), `way ${way}`).toEqual([
        ...sung.map((sing, i) => (sing ? LINES[i] : 'skipped')),
        'waiting',
      ])
      expect(atEnd(day), `way ${way}`).toBe(true)
      expect(day.warmedUp, `way ${way}`).toBe(true)
      expect(tally(day), `way ${way}`).toEqual({
        done,
        skipped: 4 - done,
        rooms: 4,
      })
    }
  })

  it("Again: the newer line replaces the stop's, and the run stays where it was", () => {
    let day = finishStop(fresh(), 0, finished('86% lit'))
    day = finishStop(day, 0, finished('91% lit'))
    expect(states(day)[0]).toBe('91% lit')
    expect(nextStop(day)).toBe(1)
    expect(tally(day).done).toBe(1)
  })

  it('Again at the end keeps the day warmed up', () => {
    let day = fresh()
    LINES.forEach((line, i) => {
      day = finishStop(day, i, finished(line))
    })
    day = finishStop(day, 1, finished('95% lit'))
    expect(states(day)).toEqual([
      '86% lit',
      '95% lit',
      '12.6 s',
      '8 of 9 on pitch',
      'waiting',
    ])
    expect(day.warmedUp).toBe(true)
  })

  it('skipping every stop goes back to the start and counts nothing', () => {
    let day = fresh()
    for (let i = 0; i < 4; i += 1) day = skipStop(day, i)
    expect(states(day)).toEqual(Array(5).fill('waiting'))
    expect(day.warmedUp).toBe(false)
  })

  it('carries the note a stop started from on to the later stops', () => {
    let day = finishStop(fresh(), 0, finished('86% lit', 57))
    expect(day.settledNote).toBe(57)
    day = finishStop(day, 1, finished('92% lit', null))
    expect(day.settledNote).toBe(57)
    day = finishStop(day, 2, finished('12.6 s', 60))
    expect(day.settledNote).toBe(60)
  })
})

describe('moves that do not apply', () => {
  it('leave the day as it was', () => {
    const one = finishStop(fresh(), 0, finished('86% lit'))
    const skipped = skipStop(one, 1)
    expect(skipStop(one, 0)).toBe(one) // a finished stop
    expect(skipStop(skipped, 1)).toBe(skipped) // skipped already
    expect(finishStop(skipped, 1, finished('92% lit'))).toBe(skipped)
    expect(skipStop(one, SONG)).toBe(one)
    expect(finishStop(one, SONG, finished('a song'))).toBe(one)
    expect(skipStop(one, 9)).toBe(one)
    expect(finishStop(one, -1, finished('x'))).toBe(one)
  })

  it('a skipped stop and the song never open; a finished one opens for Again', () => {
    const day = skipStop(finishStop(fresh(), 0, finished('86% lit')), 1)
    expect([0, 1, 2, 3, SONG, 7].map((i) => canEnter(day, i))).toEqual([
      true,
      false,
      true,
      true,
      false,
      false,
    ])
  })
})

describe('Warm up again', () => {
  it('starts a fresh run the same day, still warmed up, from the same note', () => {
    let day = fresh()
    LINES.forEach((line, i) => {
      day = finishStop(day, i, finished(line, 55))
    })
    const again = restartDay(day, 9000)
    expect(states(again)).toEqual(Array(5).fill('waiting'))
    expect(again.warmedUp).toBe(true)
    expect(again.settledNote).toBe(55)
    expect(nextStop(again)).toBe(0)
    expect(again.date).toBe(TODAY)
    expect(again.lastActiveAt).toBe(9000)
  })
})

describe('the day the path opens', () => {
  const leftHalfway = skipStop(finishStop(fresh(), 0, finished('86% lit')), 1)
  const OTHER: WarmUpPlan = {
    id: 'other',
    stops: [
      { kind: 'room', id: EXERCISE_ECHO_STARS },
      { kind: 'room', id: EXERCISE_LIP_ROLL_BAY },
    ],
  }

  it('the same day: the run as it was left, "1 of 4 today", next Long note', () => {
    const day = dayFor(leftHalfway, TODAY, () => OTHER)
    expect(day).toBe(leftHalfway)
    expect(tally(day)).toEqual({ done: 1, skipped: 1, rooms: 4 })
    expect(nextStop(day)).toBe(2)
  })

  it("a new day: a fresh run of that day's plan", () => {
    const day = dayFor(leftHalfway, '2026-10-19', () => OTHER)
    expect(day.date).toBe('2026-10-19')
    expect(day.plan).toBe(OTHER)
    expect(states(day)).toEqual(['waiting', 'waiting'])
    expect(day.warmedUp).toBe(false)
    expect(day.settledNote).toBeNull()
  })

  it('no run kept yet: a fresh one', () => {
    expect(dayFor(null, TODAY, () => OWNER_ROUTINE).marks).toHaveLength(5)
  })
})

describe('a routine of any length', () => {
  it('runs a two-room plan with no song to its end', () => {
    const plan: WarmUpPlan = {
      id: 'short',
      stops: [
        { kind: 'room', id: EXERCISE_NG_SLIDES_BRIDGE },
        { kind: 'room', id: EXERCISE_ECHO_STARS },
      ],
    }
    let day = finishStop(fresh(plan), 0, finished('92% lit'))
    expect(roomIndex(day, 1)).toBe(1)
    day = skipStop(day, 1)
    expect(atEnd(day)).toBe(true)
    expect(day.warmedUp).toBe(true)
    expect(tally(day)).toEqual({ done: 1, skipped: 1, rooms: 2 })
  })

  it('numbers the rooms from 0 for the chip, and the song not at all', () => {
    const day = fresh()
    expect([0, 1, 2, 3, SONG].map((i) => roomIndex(day, i))).toEqual([
      0, 1, 2, 3, -1,
    ])
  })
})

describe('a stored day', () => {
  const midRun = skipStop(finishStop(fresh(), 0, finished('86% lit', 57)), 1)
  const parsed = (day: unknown): unknown => JSON.parse(JSON.stringify(day))

  it('reads back as it was written', () => {
    expect(isWarmUpDay(parsed(fresh()))).toBe(true)
    expect(isWarmUpDay(parsed(midRun))).toBe(true)
    expect(parsed(midRun)).toEqual(midRun)
  })

  it('reads as none when this build cannot run it', () => {
    const broken: Record<string, unknown> = {
      'a date that is not a day': { ...midRun, date: '18 Oct' },
      'a mark short': { ...midRun, marks: midRun.marks.slice(1) },
      'a finished stop with no line': {
        ...midRun,
        marks: [{ state: 'done' }, ...midRun.marks.slice(1)],
      },
      'the song finished': {
        ...midRun,
        marks: [...midRun.marks.slice(0, 4), { state: 'done', line: 'x' }],
      },
      'an unknown room': {
        ...midRun,
        plan: { id: 'x', stops: [{ kind: 'room', id: 'vocal-fry' }] },
        marks: [{ state: 'waiting' }],
      },
      'a note that is not one': { ...midRun, settledNote: 'A3' },
      'no day mark': { ...midRun, warmedUp: undefined },
      'no time': { ...midRun, lastActiveAt: null },
      'not a day': [],
    }
    for (const [what, day] of Object.entries(broken)) {
      expect(isWarmUpDay(parsed(day)), what).toBe(false)
    }
  })
})
