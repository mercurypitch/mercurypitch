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
import { ACTIONS_MS, createPathMotion, DRAW_IN_MS, drawInSchedule, END_SONG_MS, END_STEP_MS, HOP_AT_MS, HOP_EASE, HOP_PACES, LAND_AT_MS, LIGHT_MS, MERC_FADE_MS, PACK_AFTER_HOP_MS, PACK_MS, TRAIL_MS, } from './path-motion'
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
  first: {
    endLit: boolean
    brightened: number
    trailIn: boolean
    pack: string
  }
  go: ReturnType<typeof vi.fn>
  lit: ReturnType<typeof vi.fn>
  end: ReturnType<typeof vi.fn>
  move: (day: WarmUpDay, last: LastMove | null) => void
  dispose: () => void
}

function rig(
  day: WarmUpDay,
  last: LastMove | null,
  options: {
    still?: boolean
    reduced?: boolean
    drawIn?: boolean
    land?: boolean
  } = {},
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
      drawIn: options.drawIn === true,
      land: options.land === true,
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
        pack: motion.pack(),
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
    expect(current!.motion.hopPace()).toBe('between')
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
      pack: 'unpacked',
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

  it('the stops stand where they were while they brighten, Merc beside Echo', () => {
    // Packed, Echo's place is closer to Long note's, and Merc beside it
    // stood on "Long note 12.6 s" until he hopped (13e's finding).
    current = rig(ended(), { index: 3, state: 'done' })
    vi.advanceTimersByTime(SONG_AT - 1)
    expect(current.motion.pack()).toBe('unpacked')
    expect(current.motion.merc()).toEqual({ at: 'beside', index: 3 })
  })

  it('they pack while Merc hops onto the song, and are packed as he lands', () => {
    current = rig(ended(), { index: 3, state: 'done' })
    vi.advanceTimersByTime(SONG_AT)
    expect(current.motion.hopping()).toBe(true)
    expect(current.motion.hopPace()).toBe('end')
    expect(current.motion.pack()).toBe('unpacked')
    vi.advanceTimersByTime(PACK_AFTER_HOP_MS)
    expect(current.motion.pack()).toBe('packing')
    vi.advanceTimersByTime(PACK_MS - 1)
    expect(current.motion.pack()).toBe('packing')
    vi.advanceTimersByTime(1)
    expect(current.motion.pack()).toBe('settled')
    expect(PACK_AFTER_HOP_MS + PACK_MS).toBeLessThanOrEqual(HOP_MS)
    expect(PACK_MS).toBeGreaterThanOrEqual(550)
  })

  it('reduced motion: the settled end, Merc on the song from the start, smiling as it lights', () => {
    current = rig(ended(), { index: 3, state: 'done' }, { reduced: true })
    expect(current.first.pack).toBe('settled')
    expect(current.motion.merc()).toEqual({ at: 'on', index: 4 })
    expect(current.motion.mercFaded()).toBe(false)
    vi.advanceTimersByTime(SONG_AT - 1)
    expect(current.motion.mercState()).toBe('idle')
    expect(current.end).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect([
      current.motion.pack(),
      current.motion.hopping(),
      current.motion.mercFaded(),
      current.motion.mercState(),
    ]).toEqual(['settled', false, false, 'lock'])
    expect(current.motion.merc()).toEqual({ at: 'on', index: 4 })
    expect(current.end).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(CHEER_MS)
    expect(current.motion.mercState()).toBe('idle')
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
      current.motion.pack(),
    ]).toEqual([true, false, false, 'settled'])
    expect(current.motion.merc()).toEqual({ at: 'on', index: 4 })
    vi.advanceTimersByTime(60_000)
    expect(current.end).not.toHaveBeenCalled()
  })
})

describe("the day's first open: the path draws in (§5.2, §10)", () => {
  it('draws in for 700 ms, then is the settled path', () => {
    current = rig(fresh(), null, { drawIn: true })
    expect(current.motion.drawingIn()).toBe(true)
    vi.advanceTimersByTime(DRAW_IN_MS - 1)
    expect(current.motion.drawingIn()).toBe(true)
    vi.advanceTimersByTime(1)
    expect(current.motion.drawingIn()).toBe(false)
  })

  it('a later open, a fixture or a return from a stop draws nothing in', () => {
    current = rig(fresh(), null)
    expect(current.motion.drawingIn()).toBe(false)
    current.dispose()
    current = rig(fresh(), null, { drawIn: true, still: true })
    expect(current.motion.drawingIn()).toBe(false)
    current.dispose()
    current = rig(
      sung(fresh(), 0),
      { index: 0, state: 'done' },
      { drawIn: true },
    )
    expect(current.motion.drawingIn()).toBe(false)
  })

  it('the stops fade in one after another, bottom up, as the path reaches each', () => {
    const plan = drawInSchedule(5)
    expect(plan.stops[0]).toBe(0)
    for (let i = 1; i < 5; i += 1) {
      expect(plan.stops[i]).toBeGreaterThan(plan.stops[i - 1]!)
      // The segment from the stop below reaches this one as it starts.
      expect(plan.stops[i - 1]! + plan.segment).toBeCloseTo(plan.stops[i]!, 6)
    }
    // The last stop is in by 700 ms.
    expect(plan.stops[4]! + plan.fade).toBeCloseTo(DRAW_IN_MS, 6)
  })

  it('a longer plan draws in within the same 700 ms', () => {
    const plan = drawInSchedule(9)
    expect(plan.stops).toHaveLength(9)
    expect(plan.stops[8]! + plan.fade).toBeCloseTo(DRAW_IN_MS, 6)
    expect(drawInSchedule(1).stops).toEqual([0])
  })
})

describe("the onboarding's landing (S7b beat 10)", () => {
  const BESIDE_FIRST = { at: 'beside', index: 0 }

  it('Merc hops from the floor beside the first stop once the path has drawn in', () => {
    current = rig(fresh(), null, { drawIn: true, land: true })
    expect(current.motion.merc()).toEqual({ at: 'floor' })

    vi.advanceTimersByTime(DRAW_IN_MS - 1)
    expect(current.motion.merc()).toEqual({ at: 'floor' })
    expect(current.motion.hopping()).toBe(false)
    vi.advanceTimersByTime(1)
    expect(current.motion.merc()).toEqual(BESIDE_FIRST)
    expect(current.motion.hopping()).toBe(true)
    expect(current.motion.hopPace()).toBe('land')
    expect(current.motion.mercState()).toBe('hop')
    vi.advanceTimersByTime(HOP_MS)
    expect(current.motion.hopping()).toBe(false)
    expect(current.motion.mercState()).toBe('idle')
  })

  it('hops a beat after the path opens when it does not draw in', () => {
    current = rig(fresh(), null, { land: true })
    vi.advanceTimersByTime(LAND_AT_MS - 1)
    expect(current.motion.merc()).toEqual({ at: 'floor' })
    vi.advanceTimersByTime(1)
    expect(current.motion.merc()).toEqual(BESIDE_FIRST)
    expect(current.motion.hopping()).toBe(true)
  })

  it('reduced motion: he fades out on the floor and in beside the first stop, no hop', () => {
    current = rig(fresh(), null, { land: true, reduced: true })
    vi.advanceTimersByTime(LAND_AT_MS)
    expect(current.motion.mercFaded()).toBe(true)
    expect(current.motion.merc()).toEqual({ at: 'floor' })
    vi.advanceTimersByTime(MERC_FADE_MS)
    expect(current.motion.mercFaded()).toBe(false)
    expect(current.motion.merc()).toEqual(BESIDE_FIRST)
    expect(current.motion.hopping()).toBe(false)
  })

  it('leaves Merc where the view has him on a run under way, and in a fixture', () => {
    current = rig(sung(fresh(), 0), null, { land: true })
    const spot = current.motion.merc()
    vi.advanceTimersByTime(5000)
    expect(current.motion.merc()).toEqual(spot)
    expect(current.motion.hopping()).toBe(false)
    current.dispose()

    current = rig(fresh(), null, { land: true, still: true })
    vi.advanceTimersByTime(5000)
    expect(current.motion.merc()).toEqual({ at: 'floor' })
  })

  it('stays on the floor, pointing, when Start is tapped before he has hopped', () => {
    current = rig(fresh(), null, { drawIn: true, land: true })
    vi.advanceTimersByTime(DRAW_IN_MS - 100)
    current.motion.lean()
    vi.advanceTimersByTime(5000)

    expect(current.motion.merc()).toEqual({ at: 'floor' })
    expect(current.motion.mercState()).toBe('point')
  })

  it('lands once: a Warm up again later starts him on the floor, as any open does', () => {
    current = rig(fresh(), null, { land: true })
    vi.advanceTimersByTime(LAND_AT_MS + HOP_MS)
    current.move(sung(fresh(), 0), { index: 0, state: 'done' })
    vi.advanceTimersByTime(ACTIONS_MS)
    current.move(fresh(), null)
    vi.advanceTimersByTime(5000)

    expect(current.motion.merc()).toEqual({ at: 'floor' })
  })
})

/** A CSS cubic-bezier's progress at a share `t` of its time. */
function eased(ease: string, t: number): number {
  const [x1, y1, x2, y2] = (/cubic-bezier\(([^)]+)\)/u.exec(ease)?.[1] ?? '')
    .split(',')
    .map(Number)
  const at = (s: number, a: number, b: number): number =>
    3 * (1 - s) ** 2 * s * a + 3 * (1 - s) * s * s * b + s ** 3
  let lo = 0
  let hi = 1
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2
    if (at(mid, x1, x2) < t) lo = mid
    else hi = mid
  }
  return at((lo + hi) / 2, y1, y2)
}

describe("the hops' paces", () => {
  it('between stops he rises first: most of the way up by mid-hop, then across', () => {
    const { across, up } = HOP_PACES.between
    for (const t of [0.3, 0.4, 0.5, 0.6]) {
      expect(eased(up, t) - eased(across, t)).toBeGreaterThan(0.15)
    }
    expect(eased(up, 0.5)).toBeGreaterThan(0.85)
    expect(eased(across, 0.5)).toBeLessThan(0.65)
    // Never straight up: the next stop's name is over him as he leaves.
    expect(eased(across, 0.1)).toBeGreaterThanOrEqual(eased(up, 0.1))
  })

  it('the end goes across first', () => {
    const { across, up } = HOP_PACES.end
    for (const t of [0.2, 0.3, 0.4, 0.5]) {
      expect(eased(across, t) - eased(up, t)).toBeGreaterThan(0.3)
    }
  })

  it('the landing drops first: at his new height by the top of his jump', () => {
    const { across, up } = HOP_PACES.land
    expect(across).toBe(HOP_EASE)
    // His jump peaks 0.44 to 0.5 of the way through the hop.
    expect(eased(up, 0.44)).toBeGreaterThan(0.9)
    for (const t of [0.2, 0.3, 0.44]) {
      expect(eased(up, t) - eased(HOP_EASE, t)).toBeGreaterThan(0.2)
    }
  })
})
