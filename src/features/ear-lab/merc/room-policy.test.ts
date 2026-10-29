// The drill room's rules: Close asks first only mid-run; the plate's
// main button follows today's three; Merc listens, waits, nods and
// celebrates only where it is earned; his bubble shows the task once.

import { describe, expect, it } from 'vitest'
import type { RoomOrigin, TodaySegment } from './room-policy'
import { bubbleShows, closeAsksFirst, doneLabel, mercPose, plateAction, verdictHaptic, } from './room-policy'

const PLAN: TodaySegment[] = [
  { drillId: 'hairline', name: 'Hairline' },
  { drillId: 'home', name: 'Home' },
  { drillId: 'subdivide', name: 'Subdivide' },
]

describe('closeAsksFirst', () => {
  it('asks while a run is on, and lets an idle or finished room go', () => {
    expect(closeAsksFirst('listen')).toBe(true)
    expect(closeAsksFirst('answer')).toBe(true)
    expect(closeAsksFirst('reveal')).toBe(true)
    expect(closeAsksFirst('idle')).toBe(false)
    expect(closeAsksFirst('done')).toBe(false)
  })
})

describe('plateAction', () => {
  const today: RoomOrigin = { kind: 'today' }
  const bench: RoomOrigin = { kind: 'bench' }
  const station: RoomOrigin = { kind: 'station', faculty: 'shape' }

  it("leads from one of today's three to the next not yet done", () => {
    expect(
      plateAction({
        origin: today,
        drillId: 'hairline',
        plan: PLAN,
        done: new Set(['hairline']),
      }),
    ).toEqual({ kind: 'today', drillId: 'home', label: 'Next for today: Home' })
  })

  it("does so for one of the three opened anywhere, skipping what's done", () => {
    expect(
      plateAction({
        origin: station,
        drillId: 'home',
        plan: PLAN,
        done: new Set(['hairline', 'home']),
      }),
    ).toEqual({
      kind: 'today',
      drillId: 'subdivide',
      label: 'Next for today: Subdivide',
    })
  })

  it('closes the day once all three are done', () => {
    expect(
      plateAction({
        origin: today,
        drillId: 'subdivide',
        plan: PLAN,
        done: new Set(['hairline', 'home', 'subdivide']),
      }).kind,
    ).toBe('today-done')
  })

  it('offers the drill again outside today', () => {
    expect(
      plateAction({
        origin: bench,
        drillId: 'leap',
        plan: PLAN,
        done: new Set(),
      }),
    ).toEqual({ kind: 'again', label: 'Run again' })
  })

  it('never leads back into the drill just run', () => {
    // A short run that stopped short of booking its segment.
    const next = plateAction({
      origin: today,
      drillId: 'hairline',
      plan: PLAN,
      done: new Set(),
    })
    expect(next).toEqual({
      kind: 'today',
      drillId: 'home',
      label: 'Next for today: Home',
    })
  })

  it('says where Done goes', () => {
    expect(doneLabel(today)).toBe('Done, back to Today')
    expect(doneLabel(station)).toBe('Done, back to the station')
    expect(doneLabel(bench)).toBe('Done, back to the bench')
  })
})

describe('mercPose', () => {
  const pose = (over: Partial<Parameters<typeof mercPose>[0]>) =>
    mercPose({
      beat: 'answer',
      sounding: false,
      verdict: null,
      plateWorthIt: false,
      ...over,
    })

  it('listens while the sound plays, whatever the beat', () => {
    expect(pose({ beat: 'listen' })).toBe('listen')
    expect(pose({ beat: 'reveal', verdict: 'wrong', sounding: true })).toBe(
      'listen',
    )
  })

  it('waits while the singer answers', () => {
    expect(pose({ beat: 'answer' })).toBe('idle')
  })

  it('nods at a right answer and gives a wrong one nothing', () => {
    expect(pose({ beat: 'reveal', verdict: 'right' })).toBe('lock')
    expect(pose({ beat: 'reveal', verdict: 'wrong' })).toBe('idle')
  })

  it('celebrates only on a plate worth it, never mid-run', () => {
    expect(pose({ beat: 'done', plateWorthIt: true })).toBe('celebrate')
    expect(pose({ beat: 'done', plateWorthIt: false })).toBe('point')
    for (const beat of ['listen', 'answer', 'reveal', 'idle'] as const) {
      expect(pose({ beat, verdict: 'right', plateWorthIt: true })).not.toBe(
        'celebrate',
      )
    }
  })
})

describe('the verdict, felt', () => {
  it('is a light tick when right and a warning when wrong', () => {
    expect(verdictHaptic(true)).toBe('tap')
    expect(verdictHaptic(false)).toBe('warning')
  })
})

describe('bubbleShows', () => {
  it('shows the task in full on the first question', () => {
    expect(bubbleShows({ beat: 'listen', answered: 0 })).toBe('prompt')
    expect(bubbleShows({ beat: 'answer', answered: 0 })).toBe('prompt')
  })

  it('asks the question again whenever an answer is due, and says nothing over the sound', () => {
    expect(bubbleShows({ beat: 'answer', answered: 1 })).toBe('ask')
    expect(bubbleShows({ beat: 'answer', answered: 40 })).toBe('ask')
    expect(bubbleShows({ beat: 'listen', answered: 4 })).toBe('none')
  })

  it('shows the verdict after each answer', () => {
    expect(bubbleShows({ beat: 'reveal', answered: 1 })).toBe('verdict')
  })
})
