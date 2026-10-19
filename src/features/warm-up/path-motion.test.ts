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
import { ACTIONS_MS, createPathMotion, END_SONG_MS, END_STEP_MS, HOP_AT_MS, LIGHT_MS, MERC_FADE_MS, TRAIL_MS, } from './path-motion'
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
  /** What the motion held when it was made, before its effects ran. */
  first: { endLit: boolean; brightened: number; trailIn: boolean }
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
      first: {
        endLit: motion.endLit(),
        brightened: motion.brightened(),
        trailIn: motion.trailIn(),
      },
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
  const ended = (): WarmUpDay => {
    let day = fresh()
    for (const i of [0, 1, 2, 3]) day = sung(day, i)
    return day
  }
  /** Four rooms brighten, then the song lights. */
  const SONG_AT = 4 * END_STEP_MS + END_SONG_MS

  it('is unlit from its first frame: nothing lit to fade down first', () => {
    current = rig(ended(), { index: 3, state: 'done' })
    expect(current.first).toEqual({
      endLit: false,
      brightened: 0,
      trailIn: false,
    })
    // A settled end (a fixture, or opened again) is lit from the start.
    current.dispose()
    current = rig(ended(), { index: 3, state: 'done' }, { still: true })
    expect(current.first.endLit).toBe(true)
  })

  it('brightens the four stops bottom up while the path draws on to the song', () => {
    current = rig(ended(), { index: 3, state: 'done' })
    const lit = (): readonly unknown[] => [
      current!.motion.brightened(),
      current!.motion.trailIn(),
      current!.motion.endLit(),
      current!.motion.burst(),
    ]
    expect(lit()).toEqual([0, false, false, false])
    vi.advanceTimersByTime(END_STEP_MS)
    expect(lit()).toEqual([1, false, false, false])
    vi.advanceTimersByTime(3 * END_STEP_MS)
    expect(lit()).toEqual([4, true, false, false])
    expect(current.motion.merc()).toEqual({ at: 'beside', index: 3 })
  })

  it('then the song lights with its burst, and Merc hops onto it', () => {
    current = rig(ended(), { index: 3, state: 'done' })
    vi.advanceTimersByTime(SONG_AT - 1)
    expect(current.motion.brightened()).toBe(4)
    vi.advanceTimersByTime(1)
    expect([
      current.motion.brightened(),
      current.motion.endLit(),
      current.motion.burst(),
    ]).toEqual([5, true, true])
    expect(current.motion.merc()).toEqual({ at: 'on', index: 4 })
    expect(current.motion.mercState()).toBe('hop')
    // The success is felt as he lands, not as he leaves.
    expect(current.end).not.toHaveBeenCalled()
  })

  it('he lands, the phone gives its success, he cheers, then rests', () => {
    current = rig(ended(), { index: 3, state: 'done' })
    vi.advanceTimersByTime(SONG_AT + HOP_MS)
    expect(current.end).toHaveBeenCalledTimes(1)
    expect([current.motion.hopping(), current.motion.mercState()]).toEqual([
      false,
      'celebrate',
    ])
    vi.advanceTimersByTime(CHEER_MS)
    expect(current.motion.mercState()).toBe('idle')
    expect(current.motion.counting()).toBeNull()
    expect(current.end).toHaveBeenCalledTimes(1)
  })

  it('reduced motion: he fades out and in on the song, and smiles', () => {
    current = rig(ended(), { index: 3, state: 'done' }, { reduced: true })
    vi.advanceTimersByTime(SONG_AT)
    expect(current.motion.mercFaded()).toBe(true)
    expect(current.motion.merc()).toEqual({ at: 'beside', index: 3 })
    vi.advanceTimersByTime(MERC_FADE_MS)
    expect([
      current.motion.mercFaded(),
      current.motion.hopping(),
      current.motion.mercState(),
    ]).toEqual([false, false, 'lock'])
    expect(current.motion.merc()).toEqual({ at: 'on', index: 4 })
    expect(current.end).toHaveBeenCalledTimes(1)
  })
})

describe('reduced motion and fixtures', () => {
  it('reduced motion: Merc fades out and in where he goes, no hop; the buttons keep time', () => {
    current = rig(
      sung(fresh(), 0),
      { index: 0, state: 'done' },
      {
        reduced: true,
      },
    )
    vi.advanceTimersByTime(HOP_AT_MS)
    expect(current.motion.mercFaded()).toBe(true)
    expect(current.motion.merc()).toEqual({ at: 'beside', index: 0 })
    vi.advanceTimersByTime(MERC_FADE_MS)
    expect(current.motion.merc()).toEqual({ at: 'beside', index: 1 })
    expect(current.motion.mercFaded()).toBe(false)
    expect(current.motion.hopping()).toBe(false)
    expect(current.motion.mercState()).toBe('idle')
    vi.advanceTimersByTime(ACTIONS_MS - HOP_AT_MS - MERC_FADE_MS)
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

  it('a fixture of the end is lit, Merc on the song, with no burst', () => {
    let day = fresh()
    for (const i of [0, 1, 2, 3]) day = sung(day, i)
    current = rig(day, { index: 3, state: 'done' }, { still: true })
    expect([
      current.motion.endLit(),
      current.motion.burst(),
      current.motion.mercFaded(),
    ]).toEqual([true, false, false])
    expect(current.motion.merc()).toEqual({ at: 'on', index: 4 })
    vi.advanceTimersByTime(60_000)
    expect(current.end).not.toHaveBeenCalled()
  })
})
