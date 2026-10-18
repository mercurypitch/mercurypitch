// ============================================================
// The Warm-up path's motion: the arrival, the countdown, the end
// ============================================================
//
// DESIGN-warm-up.md §5.5 and §5.8, with the owner's pw-next "auto": back
// from a stop, the stop lights, the path draws, Merc hops and the card
// rises; 2.5 s later Again, Skip and Next show and Next counts down five
// seconds, cancellable.

import { createRoot, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CHEER_MS, HOP_MS } from '@/components/room-kit/merc-moves'
import { AUTO_CONTINUE_SECONDS } from '@/lib/auto-continue'
import type { PathMotion } from './path-motion'
import { ACTIONS_MS, createPathMotion, END_STEP_MS, HOP_AT_MS, LIGHT_MS, TRAIL_MS, } from './path-motion'
import type { PathView } from './path-view'
import { pathView } from './path-view'
import type { WarmUpDay } from './routine'
import { finishStop, freshDay, skipStop } from './routine'
import { OWNER_ROUTINE } from './warm-up-plan'
import type { LastMove } from './warm-up-store'

const fresh = (): WarmUpDay => freshDay(OWNER_ROUTINE, '2026-10-19', 0)
const sung = (day: WarmUpDay, index: number): WarmUpDay =>
  finishStop(day, index, { line: '86% lit', settledNote: null }, 0)

interface Rig {
  motion: PathMotion
  go: ReturnType<typeof vi.fn>
  lit: ReturnType<typeof vi.fn>
  end: ReturnType<typeof vi.fn>
  move: (day: WarmUpDay, last: LastMove | null) => void
  dispose: () => void
}

function rig(
  day: WarmUpDay,
  last: LastMove | null,
  options: { still?: boolean; reduced?: boolean } = {},
): Rig {
  const go = vi.fn()
  const lit = vi.fn()
  const end = vi.fn()
  return createRoot((dispose) => {
    const [view, setView] = createSignal<PathView>(
      pathView({ day, last, canStart: true, minutes: 3 }),
    )
    const [move, setMove] = createSignal<LastMove | null>(last)
    const motion = createPathMotion({
      view,
      last: move,
      still: options.still === true,
      reduced: () => options.reduced === true,
      go,
      onLit: lit,
      onEnd: end,
    })
    return {
      motion,
      go,
      lit,
      end,
      move: (next, to) => {
        setView(pathView({ day: next, last: to, canStart: true, minutes: 3 }))
        setMove(to)
      },
      dispose,
    }
  })
}

let current: Rig | undefined

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  current?.dispose()
  current = undefined
  vi.useRealTimers()
})

describe('back from a stop', () => {
  beforeEach(() => {
    current = rig(sung(fresh(), 0), { index: 0, state: 'done' })
  })

  it('holds the stop as it was, then lights it, with a tick', () => {
    expect(current!.motion.unlit()).toBe(0)
    vi.advanceTimersByTime(LIGHT_MS)
    expect(current!.motion.unlit()).toBeNull()
    expect(current!.lit).toHaveBeenCalledTimes(1)
  })

  it('draws the path in at 0.2 s, and Merc hops with the card at 0.3 s', () => {
    expect(current!.motion.trailIn()).toBe(false)
    expect(current!.motion.card()).toBe(false)
    expect(current!.motion.merc()).toEqual({ at: 'beside', index: 0 })
    vi.advanceTimersByTime(TRAIL_MS)
    expect(current!.motion.trailIn()).toBe(true)
    vi.advanceTimersByTime(HOP_AT_MS - TRAIL_MS)
    expect(current!.motion.card()).toBe(true)
    expect(current!.motion.merc()).toEqual({ at: 'beside', index: 1 })
    expect([current!.motion.hopping(), current!.motion.mercState()]).toEqual([
      true,
      'hop',
    ])
    vi.advanceTimersByTime(HOP_MS)
    expect([current!.motion.hopping(), current!.motion.mercState()]).toEqual([
      false,
      'idle',
    ])
  })

  it('shows Again, Skip and Next at 2.5 s, and Next counts down, then goes', () => {
    vi.advanceTimersByTime(ACTIONS_MS - 1)
    expect(current!.motion.actions()).toBe(false)
    vi.advanceTimersByTime(1)
    expect(current!.motion.actions()).toBe(true)
    expect(current!.motion.counting()).toBe(AUTO_CONTINUE_SECONDS)
    vi.advanceTimersByTime(AUTO_CONTINUE_SECONDS * 1000 - 1)
    expect(current!.go).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(current!.go).toHaveBeenCalledTimes(1)
    expect(current!.motion.counting()).toBeNull()
  })

  it('Stay here stops the countdown, and nothing opens', () => {
    vi.advanceTimersByTime(ACTIONS_MS + 1000)
    current!.motion.stay()
    expect(current!.motion.counting()).toBeNull()
    vi.advanceTimersByTime(AUTO_CONTINUE_SECONDS * 1000)
    expect(current!.go).not.toHaveBeenCalled()
  })

  it('leaning toward a stop as it opens stops the countdown too', () => {
    vi.advanceTimersByTime(ACTIONS_MS)
    current!.motion.lean()
    expect(current!.motion.counting()).toBeNull()
    expect(current!.motion.mercState()).toBe('point')
    vi.advanceTimersByTime(AUTO_CONTINUE_SECONDS * 1000)
    expect(current!.go).not.toHaveBeenCalled()
  })

  it('Skip beside Next arrives again: a new card, a new countdown', () => {
    vi.advanceTimersByTime(ACTIONS_MS + 1000)
    const day = skipStop(sung(fresh(), 0), 1, 0)
    current!.move(day, { index: 1, state: 'skipped' })
    expect(current!.motion.counting()).toBeNull()
    expect(current!.motion.card()).toBe(false)
    vi.advanceTimersByTime(ACTIONS_MS)
    expect(current!.motion.counting()).toBe(AUTO_CONTINUE_SECONDS)
    // A skipped stop does not light: the one tick was Lip roll's.
    expect(current!.lit).toHaveBeenCalledTimes(1)
  })
})

describe('the end', () => {
  it('brightens the stops bottom up, then Merc lands on the song and cheers', () => {
    let day = fresh()
    for (const i of [0, 1, 2, 3]) day = sung(day, i)
    current = rig(day, { index: 3, state: 'done' })
    expect(current.motion.brightened()).toBe(0)
    vi.advanceTimersByTime(END_STEP_MS)
    expect(current.motion.brightened()).toBe(1)
    // Four rooms and the song: five steps.
    vi.advanceTimersByTime(4 * END_STEP_MS)
    expect(current.motion.brightened()).toBe(5)
    expect(current.end).toHaveBeenCalledTimes(1)
    expect(current.motion.merc()).toEqual({ at: 'on', index: 4 })
    vi.advanceTimersByTime(HOP_MS)
    expect(current.motion.mercState()).toBe('celebrate')
    vi.advanceTimersByTime(CHEER_MS)
    expect(current.motion.mercState()).toBe('idle')
    expect(current.motion.counting()).toBeNull()
  })
})

describe('reduced motion and fixtures', () => {
  it('reduced motion: Merc is where he goes, no hop; the buttons keep time', () => {
    current = rig(
      sung(fresh(), 0),
      { index: 0, state: 'done' },
      {
        reduced: true,
      },
    )
    vi.advanceTimersByTime(HOP_AT_MS)
    expect(current.motion.merc()).toEqual({ at: 'beside', index: 1 })
    expect(current.motion.hopping()).toBe(false)
    expect(current.motion.mercState()).toBe('idle')
    vi.advanceTimersByTime(ACTIONS_MS - HOP_AT_MS)
    expect(current.motion.actions()).toBe(true)
  })

  it('a fixture is settled at once and never counts down', () => {
    current = rig(
      sung(fresh(), 0),
      { index: 0, state: 'done' },
      {
        still: true,
      },
    )
    expect([
      current.motion.unlit(),
      current.motion.card(),
      current.motion.actions(),
      current.motion.counting(),
    ]).toEqual([null, true, true, null])
    vi.advanceTimersByTime(60_000)
    expect(current.go).not.toHaveBeenCalled()
  })
})
