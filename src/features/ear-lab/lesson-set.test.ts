// A lesson's set (lib/ear/subsets.ts) under both engines: a run over it
// asks each of its items as often as the others, rates on the set's own
// track with the floor of the pads it shows, leaves the drill's rating and
// the items' difficulties as they were, and books nothing for Today. A
// sung answer outside Gravity's set is a miss, not an unclear take.

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LEAP_BANK } from '@/lib/ear/banks'
import type { SungFrame } from '@/lib/ear/degree-detect'
import { findIdentificationDrill } from '@/lib/ear/drills'
import { newRating, updateRating } from '@/lib/ear/elo'
import type * as ItemBank from '@/lib/ear/item-bank'
import { GRAVITY_SET } from '@/lib/ear/item-bank'
import type { EarSubset } from '@/lib/ear/subsets'
import { narrowBank, narrowDegreeSet, resolveEarSubset, } from '@/lib/ear/subsets'
import { HOME_TIMING, REVEAL_HOLD } from '@/lib/ear/timing'
import { midiToFreq } from '@/lib/scale-data'
import { armSprintSegment, earItemStates, earPlayerRating, resetEarLabStore, sprintProgress, takeSprintRunLength, } from '@/stores/ear-lab-store'
import { useHomeController } from './use-home-controller'
import type { IdentificationTrial } from './use-identification-controller'
import { IDENTIFICATION_ROUNDS, useIdentificationController, } from './use-identification-controller'

vi.mock('@/features/exercises/feedback', () => ({ playTierSfx: vi.fn() }))
// Every key on C4, so a sung note's degree is known.
vi.mock('@/lib/ear/item-bank', async (importOriginal) => ({
  ...(await importOriginal<typeof ItemBank>()),
  roveRootMidi: () => 60,
}))

function setOf(drillId: string, items: readonly string[]): EarSubset {
  const subset = resolveEarSubset(drillId, items)
  if (subset === null) throw new Error(`${items.join(', ')} is no set`)
  return subset
}

const count = (ids: readonly string[], id: string): number =>
  ids.filter((entry) => entry === id).length

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  resetEarLabStore()
  // Today armed a short run of each drill: a set leaves it be.
  armSprintSegment({
    kind: 'identification',
    drillId: 'leap',
    reason: 'unmeasured',
    rounds: 8,
  })
})
afterEach(() => vi.useRealTimers())

describe("Leap's perfect intervals and tritone, a set of four", () => {
  const subset = setOf('leap', ['leap:P4', 'leap:TT', 'leap:P5', 'leap:P8'])

  function setUp() {
    const drill = findIdentificationDrill('leap')
    if (!drill) throw new Error('leap missing')
    const plays: string[] = []
    let dispose: () => void = () => undefined
    const controller = createRoot((d) => {
      dispose = d
      return useIdentificationController(
        drill,
        narrowBank(LEAP_BANK, subset),
        (item): IdentificationTrial => ({
          expectedId: item.itemId,
          play: async () => {
            plays.push(item.itemId)
          },
        }),
        { subset },
      )
    })
    return { controller, plays, dispose }
  }

  async function runThrough(
    controller: ReturnType<typeof setUp>['controller'],
  ): Promise<void> {
    controller.start()
    for (let round = 0; round < IDENTIFICATION_ROUNDS; round++) {
      await vi.advanceTimersByTimeAsync(0)
      controller.answer(controller.expectedId() ?? '')
      await vi.advanceTimersByTimeAsync(REVEAL_HOLD.defaultMs + 10)
    }
  }

  it('asks each of the four three times in its twelve', async () => {
    const { controller, plays, dispose } = setUp()

    await runThrough(controller)

    expect(controller.phase()).toBe('done')
    expect(subset.itemIds.map((id) => count(plays, id))).toEqual([3, 3, 3, 3])
    dispose()
  })

  it('rates on its own track with a floor of a quarter', async () => {
    const { controller, dispose } = setUp()
    controller.start()
    await vi.advanceTimersByTimeAsync(0)
    const asked = LEAP_BANK.find(
      (item) => item.itemId === controller.expectedId(),
    )
    if (!asked) throw new Error('nothing asked')

    controller.answer(asked.itemId)

    expect(earPlayerRating(subset.trackId)).toEqual(
      updateRating(newRating(), asked.seed, true, 1 / 4),
    )
    dispose()
  })

  it("leaves Leap's rating, the items and Today as they were", async () => {
    const { controller, dispose } = setUp()

    await runThrough(controller)

    expect(earPlayerRating(subset.trackId).attempts).toBe(IDENTIFICATION_ROUNDS)
    expect(earPlayerRating('leap')).toEqual(newRating())
    expect(earItemStates()).toEqual({})
    expect(sprintProgress().done).toEqual([])
    expect(takeSprintRunLength('leap')?.rounds).toBe(8)
    dispose()
  })
})

describe("Gravity's Te and Ti, a set of two degrees", () => {
  const subset = setOf('gravity', ['gravity:deg-11', 'gravity:deg-12'])
  const set = narrowDegreeSet(GRAVITY_SET, subset)
  /** A question: four cadence chords, then the probe. */
  const QUESTION =
    4 * (HOME_TIMING.chordMs + HOME_TIMING.chordGapMs) + HOME_TIMING.probeMs

  function setUp(frames: SungFrame[] = []) {
    const probes: number[] = []
    let dispose: () => void = () => undefined
    const controller = createRoot((d) => {
      dispose = d
      return useHomeController(
        {
          playChord: async () => undefined,
          playTone: async (freq: number) => {
            probes.push(freq)
          },
        },
        { startWindow: () => undefined, takeFrames: () => frames },
        { set },
      )
    })
    return { controller, probes, dispose }
  }

  it('asks Te and Ti six times each, rated apart from Gravity', async () => {
    armSprintSegment({
      kind: 'identification',
      drillId: 'gravity',
      reason: 'unmeasured',
      rounds: 8,
    })
    const { controller, dispose } = setUp()
    const asked: number[] = []

    controller.start('tap')
    for (let round = 0; round < 12; round++) {
      await vi.advanceTimersByTimeAsync(QUESTION + 10)
      const degree = controller.currentDegree()?.degree ?? 0
      asked.push(degree)
      controller.answer(degree)
      await vi.advanceTimersByTimeAsync(REVEAL_HOLD.defaultMs + 10)
    }

    expect(controller.phase()).toBe('done')
    expect([11, 12].map((d) => asked.filter((a) => a === d).length)).toEqual([
      6, 6,
    ])
    expect(earPlayerRating(subset.trackId).attempts).toBe(12)
    expect(earPlayerRating('gravity')).toEqual(newRating())
    expect(earItemStates()).toEqual({})
    expect(sprintProgress().done).toEqual([])
    expect(takeSprintRunLength('gravity')?.rounds).toBe(8)
    dispose()
  })

  it('hears a sung La as a wrong answer, not an unclear one', async () => {
    // La over C4 is A4: a degree of the twelve, but not of the set.
    const la: SungFrame[] = Array.from({ length: 12 }, () => ({
      f0: midiToFreq(69),
      conf: 1,
    }))
    const { controller, dispose } = setUp(la)

    controller.start('mic')
    await vi.advanceTimersByTimeAsync(QUESTION + HOME_TIMING.singWindowMs + 20)

    expect(controller.phase()).toBe('reveal')
    expect(controller.answeredDegree()).toBe(10)
    expect(controller.unclear()).toBe(false)
    expect(earPlayerRating(set.micDrillId).attempts).toBe(1)
    dispose()
  })
})
