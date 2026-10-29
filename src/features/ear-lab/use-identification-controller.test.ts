// A miss's slow replay finishes before the next round starts — the two
// would otherwise sound over each other — and Stop still cuts it short.
// A pair practice asks only its two items and rates nothing. A prompt
// the sound was taken away from takes no answer while held, and plays
// again on Resume: heard through already, that hearing is a replay.

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LEAP_BANK } from '@/lib/ear/banks'
import { findIdentificationDrill } from '@/lib/ear/drills'
import { REVEAL_HOLD } from '@/lib/ear/timing'
import { armSprintSegment, earConfusions, earItemStates, earPlayerRating, resetEarLabStore, setEarAutoAdvance, sprintProgress, takeSprintRunLength, } from '@/stores/ear-lab-store'
import { PAIR_PRACTICE_ROUNDS } from './pair-practice'
import type { IdentificationTrial } from './use-identification-controller'
import { useIdentificationController } from './use-identification-controller'

vi.mock('@/features/exercises/feedback', () => ({ playTierSfx: vi.fn() }))

const REPLAY_MS = 2000

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function wrongAnswer(
  controller: ReturnType<typeof useIdentificationController>,
): string {
  const expected = controller.expectedId()
  const other = LEAP_BANK.find((item) => item.itemId !== expected)
  if (!other) throw new Error('bank needs two items')
  return other.itemId
}

function setUp() {
  const drill = findIdentificationDrill('leap')
  if (!drill) throw new Error('leap missing')
  const plays: string[] = []
  let dispose: () => void = () => undefined
  const controller = createRoot((d) => {
    dispose = d
    return useIdentificationController(
      drill,
      LEAP_BANK,
      (item): IdentificationTrial => ({
        expectedId: item.itemId,
        play: async () => {
          plays.push(item.itemId)
        },
        replayOnWrong: () => wait(REPLAY_MS),
      }),
    )
  })
  return { controller, plays, dispose }
}

describe('useIdentificationController on a miss', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    resetEarLabStore()
  })
  afterEach(() => vi.useRealTimers())

  it('holds the next round until the replay has finished', async () => {
    const { controller, plays, dispose } = setUp()
    controller.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(controller.phase()).toBe('answer')
    expect(plays).toHaveLength(1)

    controller.answer('not-the-answer')
    expect(controller.phase()).toBe('reveal')
    expect(controller.replaying()).toBe(true)

    // The old hold alone is not enough: the replay is still sounding.
    await vi.advanceTimersByTimeAsync(REVEAL_HOLD.defaultMs + 5)
    expect(controller.round()).toBe(0)
    expect(plays).toHaveLength(1)

    // Up to the moment the replay ends: still on the reveal, not replaying.
    await vi.advanceTimersByTimeAsync(REPLAY_MS - REVEAL_HOLD.defaultMs - 5)
    expect(controller.replaying()).toBe(false)
    expect(controller.round()).toBe(0)
    // The hold counts from the end of the replay.
    await vi.advanceTimersByTimeAsync(REVEAL_HOLD.defaultMs - 5)
    expect(controller.round()).toBe(0)
    await vi.advanceTimersByTimeAsync(10)
    expect(controller.round()).toBe(1)
    expect(plays).toHaveLength(2)
    dispose()
  })

  it('a right answer moves on after the short hold, with no replay', async () => {
    const { controller, plays, dispose } = setUp()
    controller.start()
    await vi.advanceTimersByTimeAsync(0)
    controller.answer(controller.expectedId() ?? '')
    expect(controller.replaying()).toBe(false)
    await vi.advanceTimersByTimeAsync(REVEAL_HOLD.defaultMs + 5)
    expect(controller.round()).toBe(1)
    expect(plays).toHaveLength(2)
    dispose()
  })

  it('parks on the verdict with auto-advance off, and next() moves on', async () => {
    setEarAutoAdvance(false)
    const { controller, plays, dispose } = setUp()
    controller.start()
    await vi.advanceTimersByTimeAsync(5)
    expect(plays).toHaveLength(1)
    controller.answer(wrongAnswer(controller))
    await vi.advanceTimersByTimeAsync(REPLAY_MS + 5)
    expect(controller.replaying()).toBe(false)
    expect(controller.parked()).toBe(true)
    await vi.advanceTimersByTimeAsync(60000)
    expect(controller.round()).toBe(0)
    expect(controller.phase()).toBe('reveal')

    controller.next()
    await vi.advanceTimersByTimeAsync(5)
    expect(controller.round()).toBe(1)
    expect(plays).toHaveLength(2)
    expect(controller.parked()).toBe(false)
    dispose()
  })

  it('a parked run resumes after one hold when the switch flips on', async () => {
    setEarAutoAdvance(false)
    const { controller, dispose } = setUp()
    controller.start()
    await vi.advanceTimersByTimeAsync(5)
    controller.answer(wrongAnswer(controller))
    await vi.advanceTimersByTimeAsync(REPLAY_MS + 5)
    expect(controller.parked()).toBe(true)
    setEarAutoAdvance(true)
    expect(controller.parked()).toBe(false)
    await vi.advanceTimersByTimeAsync(REVEAL_HOLD.defaultMs - 5)
    expect(controller.round()).toBe(0)
    await vi.advanceTimersByTimeAsync(10)
    expect(controller.round()).toBe(1)
    dispose()
  })

  it('Stop during the replay ends the run and never starts another round', async () => {
    const { controller, plays, dispose } = setUp()
    controller.start()
    await vi.advanceTimersByTimeAsync(0)
    controller.answer('not-the-answer')
    await vi.advanceTimersByTimeAsync(500)
    controller.stop()
    expect(controller.phase()).toBe('done')
    await vi.advanceTimersByTimeAsync(REPLAY_MS + REVEAL_HOLD.defaultMs + 100)
    expect(plays).toHaveLength(1)
    expect(controller.phase()).toBe('done')
    dispose()
  })
})

describe('the sound taken away while an answer is due', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    resetEarLabStore()
  })
  afterEach(() => vi.useRealTimers())

  it('heard through, shuts its answer and plays it again as a replay', async () => {
    const { controller, plays, dispose } = setUp()
    controller.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(controller.phase()).toBe('answer')
    const asked = controller.expectedId()

    // Back from the background, Resume played nothing and the ear no
    // longer held the prompt (owner, 29 Oct).
    controller.holdQuestion()
    expect(controller.held()).toBe(true)
    // No answer lands behind the sheet: not a pad, not a sung window.
    expect(controller.phase()).toBe('playing')
    controller.answer(asked ?? '')
    expect(controller.phase()).toBe('playing')
    // A second stop before Resume (the app put away, then a call) is
    // the same hold.
    controller.holdQuestion()

    void controller.resumeQuestion()
    await vi.advanceTimersByTimeAsync(0)
    expect(controller.held()).toBe(false)
    expect(controller.phase()).toBe('answer')
    expect(controller.round()).toBe(0)
    // The same prompt again, never a fresh one in its place: and heard
    // twice before its answer, it is a replay, once.
    expect(plays).toEqual([asked, asked])
    expect(controller.replays()).toBe(1)
    dispose()
  })

  it('still playing, plays again from its start with no replay counted', async () => {
    const drill = findIdentificationDrill('leap')
    if (!drill) throw new Error('leap missing')
    const plays: string[] = []
    let dispose: () => void = () => undefined
    const controller = createRoot((d) => {
      dispose = d
      return useIdentificationController(drill, LEAP_BANK, (item) => ({
        expectedId: item.itemId,
        play: () => {
          plays.push(item.itemId)
          return wait(REPLAY_MS)
        },
      }))
    })
    controller.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(controller.phase()).toBe('playing')

    controller.holdQuestion()
    await vi.advanceTimersByTimeAsync(REPLAY_MS)
    // The cut prompt ending opens no answer while it is held.
    expect(controller.phase()).toBe('playing')
    void controller.resumeQuestion()
    await vi.advanceTimersByTimeAsync(REPLAY_MS)
    expect(controller.phase()).toBe('answer')
    expect(plays).toEqual([plays[0], plays[0]])
    expect(controller.replays()).toBe(0)
    dispose()
  })
})

describe('a pair practice', () => {
  const M6 = 'leap:m6'
  const P5 = 'leap:P5'

  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    resetEarLabStore()
  })
  afterEach(() => vi.useRealTimers())

  it('asks only the two, as often each, and rates nothing', async () => {
    // Today armed a short run of the drill: the practice leaves it be.
    armSprintSegment({
      kind: 'identification',
      drillId: 'leap',
      reason: 'unmeasured',
      rounds: 8,
    })
    const { controller, plays, dispose } = setUp()
    const rating = earPlayerRating('leap')
    const items = earItemStates()

    controller.practise([M6, P5])
    expect(controller.practice()).toEqual([M6, P5])
    expect(controller.totalRounds).toBe(PAIR_PRACTICE_ROUNDS)
    for (let round = 0; round < PAIR_PRACTICE_ROUNDS; round++) {
      await vi.advanceTimersByTimeAsync(0)
      expect(controller.phase()).toBe('answer')
      // Every one missed: a rated miss moves the rating and books the
      // confusion.
      controller.answer(controller.expectedId() === M6 ? P5 : M6)
      await vi.advanceTimersByTimeAsync(REPLAY_MS + REVEAL_HOLD.defaultMs + 10)
    }

    expect(controller.phase()).toBe('done')
    expect(plays.filter((id) => id === M6)).toHaveLength(4)
    expect(plays.filter((id) => id === P5)).toHaveLength(4)
    expect(controller.result()).toMatchObject({
      total: PAIR_PRACTICE_ROUNDS,
      correct: 0,
      ratingDelta: 0,
    })
    expect(earPlayerRating('leap')).toEqual(rating)
    expect(earItemStates()).toEqual(items)
    expect(earConfusions('leap')).toEqual({})
    expect(sprintProgress().done).toEqual([])
    expect(takeSprintRunLength('leap')?.rounds).toBe(8)
    dispose()
  })

  it('is offered only between two items of the bank', () => {
    const { controller, dispose } = setUp()
    expect(controller.practicePair(M6, P5)).toEqual([M6, P5])
    // The same item twice, and an answer that is no item, have none.
    expect(controller.practicePair(M6, M6)).toBeNull()
    expect(controller.practicePair(M6, 'miss')).toBeNull()
    controller.practise([M6, 'miss'])
    expect(controller.phase()).toBe('idle')
    dispose()
  })

  it('leaves the next run rated', async () => {
    const { controller, dispose } = setUp()
    controller.practise([M6, P5])
    await vi.advanceTimersByTimeAsync(0)
    controller.stop()

    controller.start()
    expect(controller.practice()).toBeNull()
    expect(controller.totalRounds).toBe(12)
    await vi.advanceTimersByTimeAsync(0)
    controller.answer(controller.expectedId() ?? '')
    expect(earPlayerRating('leap').attempts).toBe(1)
    dispose()
  })
})
