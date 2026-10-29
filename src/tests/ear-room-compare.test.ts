// ============================================================
// Tests: Compare and Home's replays, the run engines' side.
//
//   - Compare, on a miss: the answer, then the pick, listen-only, never
//     over a sound, and silenced as a replay is: by the next question,
//     Stop, the room closing and the sound taken away.
//   - Home's tapped misses have it too, and Home's replays stop with the
//     run: Hear it again ends at the next round, at Stop and when the
//     sound is taken away.
// ============================================================

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setRevealRule } from '@/features/ear-lab/reveal-pacing'
import { useHomeController } from '@/features/ear-lab/use-home-controller'
import type { IdentificationTrial } from '@/features/ear-lab/use-identification-controller'
import { useIdentificationController } from '@/features/ear-lab/use-identification-controller'
import type { EarBankItem } from '@/lib/ear/banks'
import { LEAP_BANK } from '@/lib/ear/banks'
import { findIdentificationDrill } from '@/lib/ear/drills'
import type * as ItemBank from '@/lib/ear/item-bank'
import { probeMidi } from '@/lib/ear/item-bank'
import { COMPARE_TIMING, HOME_TIMING } from '@/lib/ear/timing'
import { midiToFreq } from '@/lib/scale-data'
import { resetEarLabStore } from '@/stores/ear-lab-store'

vi.mock('@/features/exercises/feedback', () => ({ playTierSfx: vi.fn() }))
// Home's tonic, fixed, so a test can name the notes it hears.
vi.mock('@/lib/ear/item-bank', async (importOriginal) => ({
  ...(await importOriginal<typeof ItemBank>()),
  roveRootMidi: () => 60,
}))

const leap = findIdentificationDrill('leap')
if (!leap) throw new Error('leap missing from catalogue')

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  localStorage.clear()
  resetEarLabStore()
})

describe('Compare, on a rated miss', () => {
  // The room's pacing: a miss waits for Next.
  beforeEach(() => setRevealRule('merc'))
  afterEach(() => setRevealRule('switch'))

  /** Trials whose sounds end when the test says: the miss's slow
   *  replay, Hear it again and Compare, each remembered as asked. */
  function sounds() {
    const misses: Array<() => void> = []
    const listens: Array<() => void> = []
    const compared: string[] = []
    const comparisons: Array<() => void> = []
    const makeTrial = (picked: EarBankItem): IdentificationTrial => ({
      expectedId: picked.itemId,
      play: async () => undefined,
      replayOnWrong: () => new Promise<void>((done) => misses.push(done)),
      replay: () => new Promise<void>((done) => listens.push(done)),
      compare: (pickedId) => {
        compared.push(pickedId)
        return new Promise<void>((done) => comparisons.push(done))
      },
    })
    return { misses, listens, compared, comparisons, makeTrial }
  }

  it('sounds the answer and the pick after a miss, listen-only and as often as wanted', async () => {
    await createRoot(async (dispose) => {
      const s = sounds()
      const controller = useIdentificationController(
        leap,
        LEAP_BANK,
        s.makeTrial,
      )
      controller.start()
      await settle()
      expect(controller.comparable()).toBe(false)

      controller.answer('not-it')
      // A miss is on the stage, but its slow replay is still sounding.
      expect(controller.comparable()).toBe(true)
      expect(controller.compareAllowed()).toBe(false)
      s.misses[0]?.()
      await settle()
      expect(controller.compareAllowed()).toBe(true)

      const first = controller.compare()
      expect(s.compared).toEqual(['not-it'])
      expect(controller.replaying()).toBe(true)
      // Never over a sound: neither Compare nor Hear it again.
      expect(controller.compareAllowed()).toBe(false)
      expect(controller.replayAllowed()).toBe(false)
      // Listen-only: the verdict and the pick stay.
      expect(controller.phase()).toBe('reveal')
      expect(controller.answeredId()).toBe('not-it')

      s.comparisons[0]?.()
      await first
      expect(controller.replaying()).toBe(false)
      expect(controller.compareAllowed()).toBe(true)
      void controller.compare()
      expect(s.compared).toEqual(['not-it', 'not-it'])
      dispose()
    })
  })

  it('offers nothing on a right answer, or for a drill that cannot sound a pick', async () => {
    await createRoot(async (dispose) => {
      const s = sounds()
      const right = useIdentificationController(leap, LEAP_BANK, s.makeTrial)
      right.start()
      await settle()
      right.answer(right.expectedId() ?? '')
      await settle()
      expect(right.comparable()).toBe(false)
      await right.compare()
      expect(s.compared).toEqual([])

      const plain = useIdentificationController(leap, LEAP_BANK, (picked) => ({
        expectedId: picked.itemId,
        play: async () => undefined,
      }))
      plain.start()
      await settle()
      plain.answer('not-it')
      await settle()
      expect(plain.comparable()).toBe(false)
      dispose()
    })
  })

  /** A run on a miss, its slow replay over: Compare is open. */
  const onAMiss = async (
    options: Parameters<typeof useIdentificationController>[3],
  ) => {
    const s = sounds()
    const controller = useIdentificationController(
      leap,
      LEAP_BANK,
      s.makeTrial,
      options,
    )
    controller.start()
    await settle()
    controller.answer('not-it')
    s.misses[0]?.()
    await settle()
    expect(controller.compareAllowed()).toBe(true)
    void controller.compare()
    expect(controller.replaying()).toBe(true)
    return { s, controller }
  }

  it('stops when the next question starts, and its late end changes nothing', async () => {
    await createRoot(async (dispose) => {
      const cancel = vi.fn()
      const { s, controller } = await onAMiss({ cancelAudio: cancel })
      expect(controller.parked()).toBe(true)

      controller.next()
      await settle()
      expect(cancel).toHaveBeenCalledTimes(1)
      expect(controller.replaying()).toBe(false)
      expect(controller.phase()).toBe('answer')
      s.comparisons[0]?.()
      await settle()
      expect(controller.replaying()).toBe(false)
      expect(controller.phase()).toBe('answer')
      dispose()
    })
  })

  it('ends with Stop though its sound never does', async () => {
    await createRoot(async (dispose) => {
      const cancel = vi.fn()
      const { controller } = await onAMiss({ cancelAudio: cancel })

      controller.stop()
      expect(cancel).toHaveBeenCalledTimes(1)
      expect(controller.phase()).toBe('done')
      expect(controller.replaying()).toBe(false)
      dispose()
    })
  })

  it('stops when the room closes', async () => {
    await createRoot(async (dispose) => {
      const cancel = vi.fn()
      const { controller } = await onAMiss({ cancelAudio: cancel })

      controller.abandon()
      expect(cancel).toHaveBeenCalledTimes(1)
      expect(controller.replaying()).toBe(false)
      dispose()
    })
  })

  it('stops when the sound is taken away, the verdict stays, and it can sound again', async () => {
    await createRoot(async (dispose) => {
      const cancel = vi.fn()
      const silence = vi.fn()
      const { s, controller } = await onAMiss({
        cancelAudio: cancel,
        silenceReplay: silence,
      })

      controller.holdQuestion()
      expect(silence).toHaveBeenCalledTimes(1)
      expect(cancel).not.toHaveBeenCalled()
      expect(controller.replaying()).toBe(false)
      expect(controller.phase()).toBe('reveal')
      expect(controller.answeredId()).toBe('not-it')
      expect(controller.held()).toBe(false)
      expect(controller.compareAllowed()).toBe(true)
      void controller.compare()
      expect(s.compared).toHaveLength(2)
      dispose()
    })
  })
})

describe("Home's replays, and Compare on a tapped miss", () => {
  const ROOT = 60
  const CADENCE_MS = 4 * (HOME_TIMING.chordMs + HOME_TIMING.chordGapMs)
  const RESOLUTION_MS =
    HOME_TIMING.resolutionProbeMs + HOME_TIMING.resolutionTonicMs
  const audio = {
    playTone: vi.fn<(freq: number, ms?: number) => Promise<void>>(
      async () => undefined,
    ),
    playChord: vi.fn().mockResolvedValue(undefined),
  }
  const probeOf = (degree: number) => midiToFreq(probeMidi(ROOT, degree))
  /** The notes sounded since `from`, as [frequency, length]. */
  const tonesSince = (from: number) =>
    audio.playTone.mock.calls.slice(from).map(([freq, ms]) => [freq, ms])

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    setRevealRule('merc')
  })
  afterEach(() => {
    vi.useRealTimers()
    setRevealRule('switch')
  })

  /** A tapped round answered: wrong, its resolution heard out. */
  async function answered(
    home: ReturnType<typeof useHomeController>,
    right: boolean,
  ): Promise<{ degree: number; picked: number }> {
    home.start('tap')
    await vi.advanceTimersByTimeAsync(CADENCE_MS + HOME_TIMING.probeMs)
    expect(home.phase()).toBe('answer')
    const degree = home.currentDegree()?.degree as number
    const picked = right ? degree : (degree % 7) + 1
    home.answer(picked)
    await vi.advanceTimersByTimeAsync(right ? 0 : RESOLUTION_MS)
    return { degree, picked }
  }

  it('compares a tapped miss: the answer, then the pick, in the round key', async () => {
    await createRoot(async (dispose) => {
      const home = useHomeController(audio)
      home.start('tap')
      await vi.advanceTimersByTimeAsync(CADENCE_MS + HOME_TIMING.probeMs)
      const degree = home.currentDegree()?.degree as number
      const picked = (degree % 7) + 1
      home.answer(picked)
      // The probe falling home is sounding: nothing else yet.
      expect(home.replaying()).toBe(true)
      expect(home.comparable()).toBe(true)
      expect(home.compareAllowed()).toBe(false)
      await vi.advanceTimersByTimeAsync(RESOLUTION_MS)
      expect(home.compareAllowed()).toBe(true)

      const from = audio.playTone.mock.calls.length
      void home.compare()
      await vi.advanceTimersByTimeAsync(
        2 * HOME_TIMING.probeMs + COMPARE_TIMING.gapMs,
      )
      expect(tonesSince(from)).toEqual([
        [probeOf(degree), HOME_TIMING.probeMs],
        [probeOf(picked), HOME_TIMING.probeMs],
      ])
      expect(home.replaying()).toBe(false)
      expect(home.phase()).toBe('reveal')
      expect(home.compareAllowed()).toBe(true)
      dispose()
    })
  })

  it('offers no Compare on a right answer', async () => {
    await createRoot(async (dispose) => {
      const home = useHomeController(audio)
      await answered(home, true)
      expect(home.phase()).toBe('reveal')
      expect(home.comparable()).toBe(false)
      dispose()
    })
  })

  it('stops Compare when the next round starts: its pick never sounds', async () => {
    await createRoot(async (dispose) => {
      const cancelAudio = vi.fn()
      const home = useHomeController(audio, undefined, { cancelAudio })
      await answered(home, false)
      expect(home.parked()).toBe(true)
      void home.compare()
      await vi.advanceTimersByTimeAsync(HOME_TIMING.probeMs / 2)

      home.next()
      expect(cancelAudio).toHaveBeenCalledTimes(1)
      expect(home.replaying()).toBe(false)
      const from = audio.playTone.mock.calls.length
      // The new cadence is chords alone: no note of the old Compare
      // sounds over it, the pick's least of all.
      await vi.advanceTimersByTimeAsync(CADENCE_MS - 1)
      expect(home.phase()).toBe('cadence')
      expect(tonesSince(from)).toEqual([])
      dispose()
    })
  })

  it('stops Hear it again when the next round starts: no tonic over the new cadence', async () => {
    await createRoot(async (dispose) => {
      const cancelAudio = vi.fn()
      const home = useHomeController(audio, undefined, { cancelAudio })
      await answered(home, true)
      void home.replay()
      expect(home.replaying()).toBe(true)
      // The replay parked the hold; its probe is sounding.
      expect(home.parked()).toBe(true)
      await vi.advanceTimersByTimeAsync(HOME_TIMING.resolutionProbeMs / 2)

      home.next()
      expect(cancelAudio).toHaveBeenCalledTimes(1)
      expect(home.replaying()).toBe(false)
      expect(home.phase()).toBe('cadence')
      const from = audio.playTone.mock.calls.length
      await vi.advanceTimersByTimeAsync(RESOLUTION_MS)
      expect(tonesSince(from)).not.toContainEqual([
        midiToFreq(ROOT),
        HOME_TIMING.resolutionTonicMs,
      ])
      dispose()
    })
  })

  it('ends Hear it again with Stop, though its notes never finish', async () => {
    await createRoot(async (dispose) => {
      const cancelAudio = vi.fn()
      const home = useHomeController(audio, undefined, { cancelAudio })
      await answered(home, true)
      void home.replay()
      await vi.advanceTimersByTimeAsync(HOME_TIMING.resolutionProbeMs / 2)

      home.stop()
      expect(cancelAudio).toHaveBeenCalledTimes(1)
      expect(home.phase()).toBe('done')
      expect(home.replaying()).toBe(false)
      const from = audio.playTone.mock.calls.length
      await vi.advanceTimersByTimeAsync(RESOLUTION_MS)
      expect(tonesSince(from)).toEqual([])
      dispose()
    })
  })

  it('stops Hear it again when the sound is taken away, and the verdict stays', async () => {
    await createRoot(async (dispose) => {
      const cancelAudio = vi.fn()
      const home = useHomeController(audio, undefined, { cancelAudio })
      await answered(home, true)
      void home.replay()
      await vi.advanceTimersByTimeAsync(HOME_TIMING.resolutionProbeMs / 2)

      home.holdQuestion()
      expect(cancelAudio).toHaveBeenCalledTimes(1)
      expect(home.replaying()).toBe(false)
      expect(home.phase()).toBe('reveal')
      expect(home.held()).toBe(false)
      const from = audio.playTone.mock.calls.length
      await vi.advanceTimersByTimeAsync(RESOLUTION_MS)
      expect(tonesSince(from)).toEqual([])
      expect(home.replayAllowed()).toBe(true)
      dispose()
    })
  })
})
