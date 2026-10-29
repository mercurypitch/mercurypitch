// ============================================================
// Tests: use-home-controller — the spine drill's engine.
//
// A round plants the key with four cadence chords, sounds the probe,
// and opens the answer only once the probe has died away. Tap answers
// rate 'home' and refine the item; a miss replays the probe and lands
// on the tonic. Mic answers come from the sung frames, rate
// 'home-sing' and leave the items untouched; two unclear takes skip
// the round. Stop cancels the run mid-cadence. A pair practice asks
// only its two degrees and rates nothing.
// ============================================================

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PAIR_PRACTICE_ROUNDS } from '@/features/ear-lab/pair-practice'
import type { SingCapture } from '@/features/ear-lab/use-home-controller'
import { HOME_ROUNDS, useHomeController, } from '@/features/ear-lab/use-home-controller'
import type { SungFrame } from '@/lib/ear/degree-detect'
import type * as ItemBank from '@/lib/ear/item-bank'
import { HOME_DRILL_ID, HOME_SING_DRILL_ID, homeItemId, probeMidi, } from '@/lib/ear/item-bank'
import { HOME_TIMING, REVEAL_HOLD } from '@/lib/ear/timing'
import { resetFirstValueForTests } from '@/lib/first-value'
import { GUIDE_FUNNEL_STORAGE_KEY } from '@/lib/guide-funnel'
import { midiToFreq } from '@/lib/scale-data'
import { earItemStates, earPlayerRating, resetEarLabStore, } from '@/stores/ear-lab-store'

vi.mock('@/features/exercises/feedback', () => ({ playTierSfx: vi.fn() }))
// A fixed tonic, so the test can name the probe it hears.
vi.mock('@/lib/ear/item-bank', async (importOriginal) => ({
  ...(await importOriginal<typeof ItemBank>()),
  roveRootMidi: () => 60,
}))

const ROOT = 60
const CADENCE_MS = 4 * (HOME_TIMING.chordMs + HOME_TIMING.chordGapMs)

const audio = {
  playTone: vi.fn<(freq: number, ms?: number) => Promise<void>>(
    async () => undefined,
  ),
  playChord: vi.fn().mockResolvedValue(undefined),
}

/** The probe is the one tone sounded for probeMs. */
const probeCall = () =>
  audio.playTone.mock.calls.find((call) => call[1] === HOME_TIMING.probeMs)

const otherDegree = (degree: number) => (degree % 7) + 1

function frames(f0: number, count = 12): SungFrame[] {
  return Array.from({ length: count }, () => ({ f0, conf: 1 }) as SungFrame)
}

beforeEach(() => {
  resetEarLabStore()
  localStorage.clear()
  resetFirstValueForTests()
  vi.clearAllMocks()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('a tap round', () => {
  it('plants the key, sounds the probe, opens the answer after it dies away, and rates a hit', async () => {
    await createRoot(async (dispose) => {
      const home = useHomeController(audio)
      const before = earPlayerRating(HOME_DRILL_ID).rating

      home.start('tap')
      expect(home.phase()).toBe('cadence')
      expect(home.mode()).toBe('tap')
      await vi.advanceTimersByTimeAsync(0)
      expect(home.cadenceStep()).toBe(1)

      await vi.advanceTimersByTimeAsync(CADENCE_MS)
      expect(home.cadenceStep()).toBe(4)
      expect(home.phase()).toBe('probe')
      const degree = home.currentDegree()?.degree
      expect(degree).toBeGreaterThanOrEqual(1)
      expect(probeCall()?.[0]).toBeCloseTo(
        midiToFreq(probeMidi(ROOT, degree as number)),
      )

      // Not yet: the probe is still sounding.
      home.answer(degree as number)
      expect(home.phase()).toBe('probe')
      await vi.advanceTimersByTimeAsync(HOME_TIMING.probeMs)
      expect(home.phase()).toBe('answer')

      home.answer(degree as number)
      expect(home.phase()).toBe('reveal')
      expect(home.answeredDegree()).toBe(degree)
      expect(home.rating().rating).toBeGreaterThan(before)
      expect(earItemStates()[homeItemId(degree as number)]).toBeDefined()

      await vi.advanceTimersByTimeAsync(REVEAL_HOLD.defaultMs)
      expect(home.round()).toBe(1)
      expect(home.phase()).toBe('cadence')

      dispose()
    })
  })

  it('replays the probe and lands on the tonic after a miss', async () => {
    await createRoot(async (dispose) => {
      const home = useHomeController(audio)
      const before = earPlayerRating(HOME_DRILL_ID).rating
      home.start('tap')
      await vi.advanceTimersByTimeAsync(CADENCE_MS + HOME_TIMING.probeMs)
      const degree = home.currentDegree()?.degree as number
      const calls = audio.playTone.mock.calls.length

      home.answer(otherDegree(degree))
      expect(home.phase()).toBe('reveal')
      expect(home.rating().rating).toBeLessThan(before)
      await vi.advanceTimersByTimeAsync(0)
      const replay = audio.playTone.mock.calls[calls]
      expect(replay[1]).toBe(HOME_TIMING.resolutionProbeMs)
      expect(replay[0]).toBeCloseTo(midiToFreq(probeMidi(ROOT, degree)))

      await vi.advanceTimersByTimeAsync(HOME_TIMING.resolutionProbeMs)
      const tonic = audio.playTone.mock.calls[calls + 1]
      expect(tonic[1]).toBe(HOME_TIMING.resolutionTonicMs)
      expect(tonic[0]).toBeCloseTo(midiToFreq(ROOT))

      // The hold counts from the end of the resolution, not the miss.
      await vi.advanceTimersByTimeAsync(
        HOME_TIMING.resolutionTonicMs + REVEAL_HOLD.defaultMs - 5,
      )
      expect(home.round()).toBe(0)
      await vi.advanceTimersByTimeAsync(10)
      expect(home.round()).toBe(1)

      dispose()
    })
  })
})

describe('a sung round', () => {
  function capture(): SingCapture & {
    windows: number
    set: (f: SungFrame[]) => void
  } {
    let pending: SungFrame[] = []
    const cap = {
      windows: 0,
      startWindow: () => {
        cap.windows++
      },
      takeFrames: () => pending,
      set: (f: SungFrame[]) => {
        pending = f
      },
    }
    return cap
  }

  it('rates the voice under home-sing and leaves the tap yardsticks untouched', async () => {
    await createRoot(async (dispose) => {
      const mic = capture()
      const home = useHomeController(audio, mic)
      const tapBefore = earPlayerRating(HOME_DRILL_ID).rating
      const singBefore = earPlayerRating(HOME_SING_DRILL_ID).rating

      home.start('mic')
      await vi.advanceTimersByTimeAsync(CADENCE_MS + HOME_TIMING.probeMs)
      expect(home.phase()).toBe('answer')
      expect(mic.windows).toBe(1)
      const degree = home.currentDegree()?.degree as number

      // Sing the probe back, dead in tune.
      mic.set(frames(probeCall()?.[0] as number))
      await vi.advanceTimersByTimeAsync(HOME_TIMING.singWindowMs)
      expect(home.phase()).toBe('reveal')
      expect(home.answeredDegree()).toBe(degree)
      expect(Math.abs(home.lastCents() ?? 99)).toBeLessThan(5)
      expect(earPlayerRating(HOME_SING_DRILL_ID).rating).toBeGreaterThan(
        singBefore,
      )
      expect(earPlayerRating(HOME_DRILL_ID).rating).toBe(tapBefore)
      expect(earItemStates()[homeItemId(degree)]).toBeUndefined()

      dispose()
    })
  })

  it('gives an unclear take one more window, then skips the round without rating it', async () => {
    await createRoot(async (dispose) => {
      const mic = capture()
      const home = useHomeController(audio, mic)
      const singBefore = earPlayerRating(HOME_SING_DRILL_ID).rating

      home.start('mic')
      await vi.advanceTimersByTimeAsync(CADENCE_MS + HOME_TIMING.probeMs)
      expect(mic.windows).toBe(1)

      await vi.advanceTimersByTimeAsync(HOME_TIMING.singWindowMs)
      expect(home.unclear()).toBe(true)
      expect(home.phase()).toBe('answer')
      expect(mic.windows).toBe(2)

      await vi.advanceTimersByTimeAsync(HOME_TIMING.singWindowMs)
      expect(home.phase()).toBe('reveal')
      expect(home.answeredDegree()).toBeNull()
      expect(home.unclear()).toBe(false)
      expect(earPlayerRating(HOME_SING_DRILL_ID).rating).toBe(singBefore)

      home.stop()
      const result = home.result()
      expect(result?.mode).toBe('mic')
      expect(result?.skipped).toBe(1)
      expect(result?.total).toBe(1)
      expect(result?.outcomes[0]).toMatchObject({ answered: 0, correct: false })

      dispose()
    })
  })
})

describe('a pair practice', () => {
  it('asks only the two degrees, as often each, and rates nothing', async () => {
    await createRoot(async (dispose) => {
      const home = useHomeController(audio)
      const rating = earPlayerRating(HOME_DRILL_ID)
      const items = earItemStates()
      const asked: number[] = []

      home.practise('tap', [4, 5])
      expect(home.practice()).toEqual([4, 5])
      expect(home.totalRounds).toBe(PAIR_PRACTICE_ROUNDS)
      for (let round = 0; round < PAIR_PRACTICE_ROUNDS; round++) {
        await vi.advanceTimersByTimeAsync(CADENCE_MS + HOME_TIMING.probeMs)
        const degree = home.currentDegree()?.degree as number
        asked.push(degree)
        // Fa for Sol and Sol for Fa: rated, every one would move the
        // rating and the items.
        home.answer(degree === 4 ? 5 : 4)
        await vi.advanceTimersByTimeAsync(
          HOME_TIMING.resolutionProbeMs +
            HOME_TIMING.resolutionTonicMs +
            REVEAL_HOLD.defaultMs,
        )
      }

      expect(home.phase()).toBe('done')
      expect(asked.filter((degree) => degree === 4)).toHaveLength(4)
      expect(asked.filter((degree) => degree === 5)).toHaveLength(4)
      expect(home.result()).toMatchObject({
        total: PAIR_PRACTICE_ROUNDS,
        correct: 0,
        ratingDelta: 0,
      })
      expect(earPlayerRating(HOME_DRILL_ID)).toEqual(rating)
      expect(earItemStates()).toEqual(items)
      dispose()
    })
  })

  it('takes no degree outside the set', () => {
    createRoot((dispose) => {
      const home = useHomeController(audio)
      home.practise('tap', [4, 9])
      expect(home.phase()).toBe('idle')
      expect(home.practice()).toBeNull()
      dispose()
    })
  })
})

describe('stopping', () => {
  it('mid-cadence ends the run, silences the audio, and never re-arms', async () => {
    await createRoot(async (dispose) => {
      const cancelAudio = vi.fn()
      const home = useHomeController(audio, undefined, { cancelAudio })
      home.start('tap')
      await vi.advanceTimersByTimeAsync(HOME_TIMING.chordMs)
      expect(home.phase()).toBe('cadence')

      home.stop()
      expect(home.phase()).toBe('done')
      expect(cancelAudio).toHaveBeenCalledTimes(1)
      expect(home.result()?.total).toBe(0)

      await vi.advanceTimersByTimeAsync(CADENCE_MS + HOME_TIMING.probeMs * 2)
      expect(home.phase()).toBe('done')

      home.reset()
      expect(home.phase()).toBe('idle')
      expect(home.result()).toBeNull()

      dispose()
    })
  })
})

describe('the first value of a run', () => {
  const sentFunnelEvents = (): string[] =>
    (
      JSON.parse(localStorage.getItem(GUIDE_FUNNEL_STORAGE_KEY) ?? '[]') as {
        event: string
      }[]
    ).map((e) => e.event)

  const ROUND_MS = CADENCE_MS + HOME_TIMING.probeMs

  it('sends one first_value_ear when a run reaches its end with answers', async () => {
    await createRoot(async (dispose) => {
      const home = useHomeController(audio)
      home.start('tap')
      for (let i = 0; i < HOME_ROUNDS; i++) {
        await vi.advanceTimersByTimeAsync(ROUND_MS)
        home.answer(home.currentDegree()?.degree as number)
        await vi.advanceTimersByTimeAsync(REVEAL_HOLD.defaultMs)
      }
      expect(home.phase()).toBe('done')
      expect(sentFunnelEvents()).toEqual(['first_value_ear'])
      dispose()
    })
  })

  it('sends nothing when a run reaches its end with every round skipped', async () => {
    await createRoot(async (dispose) => {
      const mic: SingCapture = {
        startWindow: () => undefined,
        takeFrames: () => [],
      }
      const home = useHomeController(audio, mic)
      home.start('mic')
      for (let i = 0; i < HOME_ROUNDS; i++) {
        await vi.advanceTimersByTimeAsync(
          ROUND_MS + 2 * HOME_TIMING.singWindowMs + REVEAL_HOLD.defaultMs,
        )
      }
      expect(home.phase()).toBe('done')
      expect(home.result()?.skipped).toBe(HOME_ROUNDS)
      expect(sentFunnelEvents()).toEqual([])
      dispose()
    })
  })
})
