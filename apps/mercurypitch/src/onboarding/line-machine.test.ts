// ============================================================
// The sung line's machine
// ============================================================

import { describe, expect, it } from 'vitest'
import type { LineEvent, LineState } from './line-machine'
import { LINE_START, lineReducer, lineSays } from './line-machine'
import type { LineScore } from './line-score'

const SCORE: LineScore = { hit: 8, total: 10, notes: [], lag: 0.1 }

const run = (...events: LineEvent[]): LineState =>
  events.reduce(lineReducer, LINE_START)

describe('lineReducer', () => {
  it('goes from the tap to the call, the turn and a score', () => {
    const states = [
      run({ type: 'start' }),
      run({ type: 'start' }, { type: 'mic-ready', run: 1 }),
      run({ type: 'start' }, { type: 'mic-ready', run: 1 }, { type: 'turn' }),
      run(
        { type: 'start' },
        { type: 'mic-ready', run: 1 },
        { type: 'turn' },
        { type: 'scored', score: SCORE },
      ),
    ]
    expect(states.map((state) => state.phase)).toEqual([
      'starting',
      'call',
      'turn',
      'done',
    ])
    expect(states[3].score).toBe(SCORE)
  })

  it('drops the answer to an old start', () => {
    const state = run(
      { type: 'start' },
      { type: 'stop' },
      { type: 'start' },
      { type: 'mic-ready', run: 1 },
    )
    expect(state).toMatchObject({ phase: 'starting', run: 2 })
  })

  it('names a refused mic, and starts again from it', () => {
    const blocked = run(
      { type: 'start' },
      { type: 'mic-failed', run: 1, block: 'denied' },
    )
    expect(blocked).toMatchObject({ phase: 'blocked', block: 'denied' })
    expect(lineReducer(blocked, { type: 'start' })).toMatchObject({
      phase: 'starting',
      block: null,
    })
  })

  it('stops back to ready from the call and the turn, never from a score', () => {
    const call = run({ type: 'start' }, { type: 'mic-ready', run: 1 })
    expect(lineReducer(call, { type: 'stop' }).phase).toBe('ready')
    const turn = lineReducer(call, { type: 'turn' })
    expect(lineReducer(turn, { type: 'stop' }).phase).toBe('ready')
    const done = lineReducer(turn, { type: 'scored', score: SCORE })
    expect(lineReducer(done, { type: 'stop' })).toBe(done)
  })

  it('misses a turn with no voice in it, and Once more starts afresh', () => {
    const missed = run(
      { type: 'start' },
      { type: 'mic-ready', run: 1 },
      { type: 'turn' },
      { type: 'unheard' },
    )
    expect(missed.phase).toBe('missed')
    const done = run(
      { type: 'start' },
      { type: 'mic-ready', run: 1 },
      { type: 'turn' },
      { type: 'scored', score: SCORE },
    )
    expect(lineReducer(done, { type: 'start' })).toMatchObject({
      phase: 'starting',
      run: 2,
      score: null,
    })
  })

  it('scores only a turn', () => {
    const call = run({ type: 'start' }, { type: 'mic-ready', run: 1 })
    expect(lineReducer(call, { type: 'scored', score: SCORE })).toBe(call)
    expect(lineReducer(LINE_START, { type: 'turn' })).toBe(LINE_START)
  })
})

describe('lineSays', () => {
  it("asks through Merc's call, then hands the turn over", () => {
    expect(lineSays(LINE_START)).toBe('ask')
    const call = run({ type: 'start' }, { type: 'mic-ready', run: 1 })
    expect(lineSays(call)).toBe('ask')
    expect(lineSays(lineReducer(call, { type: 'turn' }))).toBe('turn')
  })

  it('says why the mic did not open, and that it still has not after a retry', () => {
    const blocked = run(
      { type: 'start' },
      { type: 'mic-failed', run: 1, block: 'unavailable' },
    )
    expect(lineSays(blocked)).toBe('blocked')
    const again = lineReducer(lineReducer(blocked, { type: 'start' }), {
      type: 'mic-failed',
      run: 2,
      block: 'unavailable',
    })
    expect(lineSays(again)).toBe('still-blocked')
  })
})
