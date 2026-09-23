import { describe, expect, it } from 'vitest'
import type { AlleyEvent, AlleyState } from './alley-machine'
import { ALLEY_REST, alleyReducer, isLifted } from './alley-machine'
import { isEnterable } from './alley-plate'

const run = (
  events: AlleyEvent[],
  from: AlleyState = ALLEY_REST,
): AlleyState[] => {
  const seen: AlleyState[] = []
  let state = from
  for (const event of events) {
    state = alleyReducer(state, event, isEnterable)
    seen.push(state)
  }
  return seen
}
const tap = (key: 'sing' | 'ear' | 'karaoke' | 'piano'): AlleyEvent => ({
  type: 'tap-door',
  key,
  enterable: isEnterable(key),
})

describe('the alley reducer', () => {
  it('walks rest, selected, alive, opening, open, back, settled', () => {
    const phases = run([
      tap('sing'),
      { type: 'wake' },
      { type: 'enter' },
      { type: 'covered' },
      { type: 'returned' },
      { type: 'settled' },
    ]).map((s) => `${s.phase}:${s.door ?? '-'}`)
    expect(phases).toEqual([
      'selected:sing',
      'alive:sing',
      'opening:sing',
      'open:sing',
      'settling:sing',
      'rest:-',
    ])
  })

  it('opens on a second tap of the selected door, the same as Enter', () => {
    const [, , third] = run([tap('ear'), { type: 'wake' }, tap('ear')])
    expect(third).toEqual({ phase: 'opening', door: 'ear' })
  })

  it('lifts a locked door and goes no further: no wake, no enter', () => {
    const states = run([
      tap('karaoke'),
      { type: 'wake' },
      { type: 'enter' },
      tap('karaoke'),
    ])
    for (const s of states)
      expect(s).toEqual({ phase: 'selected', door: 'karaoke' })
    expect(isLifted(states[3], 'karaoke')).toBe(true)
  })

  it('moves the selection to another door', () => {
    const states = run([
      tap('sing'),
      { type: 'wake' },
      tap('piano'),
      tap('ear'),
    ])
    expect(states.map((s) => s.door)).toEqual(['sing', 'sing', 'piano', 'ear'])
    expect(states[2].phase).toBe('selected')
  })

  it('clears on a tap on the plate', () => {
    const states = run([tap('sing'), { type: 'wake' }, { type: 'tap-plate' }])
    expect(states[2]).toEqual(ALLEY_REST)
    expect(run([{ type: 'tap-plate' }])[0]).toEqual(ALLEY_REST)
  })

  it('takes nothing while the door is opening or open', () => {
    const opening: AlleyState = { phase: 'opening', door: 'sing' }
    for (const event of [
      tap('ear'),
      { type: 'tap-plate' },
      { type: 'leave' },
    ] as AlleyEvent[]) {
      expect(alleyReducer(opening, event, isEnterable)).toBe(opening)
    }
    const open: AlleyState = { phase: 'open', door: 'sing' }
    expect(alleyReducer(open, tap('ear'), isEnterable)).toBe(open)
  })

  it('settles an open that never finished when the alley comes back', () => {
    expect(
      alleyReducer(
        { phase: 'opening', door: 'ear' },
        { type: 'returned' },
        isEnterable,
      ),
    ).toEqual({ phase: 'settling', door: 'ear' })
    expect(alleyReducer(ALLEY_REST, { type: 'returned' }, isEnterable)).toBe(
      ALLEY_REST,
    )
  })

  it('drops a selection when the alley is left', () => {
    expect(run([tap('sing'), { type: 'wake' }, { type: 'leave' }])[2]).toEqual(
      ALLEY_REST,
    )
  })

  it('lets a settling door be tapped straight away', () => {
    expect(
      alleyReducer(
        { phase: 'settling', door: 'sing' },
        tap('ear'),
        isEnterable,
      ),
    ).toEqual({ phase: 'selected', door: 'ear' })
  })
})
