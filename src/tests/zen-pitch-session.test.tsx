import { createRoot } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PracticeFrame } from '@/features/practice/usePracticeController'
import type { ZenPitchSession } from '@/features/zen/useZenPitchSession'
import { useZenPitchSession } from '@/features/zen/useZenPitchSession'
import type { PitchResult } from '@/types'

const pitch = (midi: number): PitchResult => ({
  freq: 440 * 2 ** ((midi - 69) / 12),
  midi,
  note: 'C',
  noteName: 'C',
  targetMidi: midi,
  targetNote: 'C',
  cents: 0,
  frequency: 440 * 2 ** ((midi - 69) / 12),
  clarity: 0.95,
  octave: 4,
})

describe('Zen pitch session', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('wraps at the right seam, retains the completed take and starts left', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(1_000)
    let listener: (frame: PracticeFrame) => void = () => undefined
    let session: ZenPitchSession | null = null
    const onRunFinalized = vi.fn()
    const stopMic = vi.fn()

    const dispose = createRoot((disposeRoot) => {
      session = useZenPitchSession({
        subscribeFrames: (next) => {
          listener = next
          return () => {
            listener = () => undefined
          }
        },
        micActive: () => false,
        startMic: async () => true,
        stopMic,
        onRunFinalized,
      })
      return disposeRoot
    })
    await Promise.resolve()
    expect(await session!.start()).toBe(true)

    for (const [atMs, midi] of [
      [1_100, 60],
      [1_200, 60.1],
      [1_300, 59.95],
    ] as const) {
      listener({
        atMs,
        beat: 0,
        pitch: pitch(midi),
        micActive: true,
      })
    }
    listener({
      atMs: 9_100,
      beat: 0,
      pitch: pitch(62),
      micActive: true,
    })

    expect(session!.runs()).toHaveLength(1)
    expect(session!.runs()[0]!.takeNumber).toBe(1)
    expect(session!.activePoints()).toHaveLength(1)
    expect(session!.activePoints()[0]!.timeSec).toBeCloseTo(0.1, 3)
    expect(session!.activePoints()[0]!.midi).toBeCloseTo(62, 3)
    expect(session!.takeNumber()).toBe(2)
    expect(onRunFinalized).toHaveBeenCalledTimes(1)

    dispose()
    expect(stopMic).toHaveBeenCalledTimes(1)
  })

  it('stores only one gap marker for a continuous silent interval', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(2_000)
    let listener: (frame: PracticeFrame) => void = () => undefined
    let session: ZenPitchSession | null = null

    const dispose = createRoot((disposeRoot) => {
      session = useZenPitchSession({
        subscribeFrames: (next) => {
          listener = next
          return () => undefined
        },
        micActive: () => true,
        startMic: async () => true,
        stopMic: () => undefined,
      })
      return disposeRoot
    })
    await Promise.resolve()
    expect(await session!.start()).toBe(true)
    listener({
      atMs: 2_100,
      beat: 0,
      pitch: pitch(60),
      micActive: true,
    })
    listener({
      atMs: 2_200,
      beat: 0,
      pitch: null,
      micActive: true,
    })
    listener({
      atMs: 2_300,
      beat: 0,
      pitch: null,
      micActive: true,
    })

    expect(session!.activePoints()).toHaveLength(2)
    expect(session!.activePoints()[1]!.midi).toBeNull()
    dispose()
  })

  it('releases a mic whose permission prompt resolves after unmount', async () => {
    let resolveStart: ((started: boolean) => void) | undefined
    const startMic = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveStart = resolve
        }),
    )
    const stopMic = vi.fn()
    let session: ZenPitchSession | null = null

    const dispose = createRoot((disposeRoot) => {
      session = useZenPitchSession({
        subscribeFrames: () => () => undefined,
        micActive: () => false,
        startMic,
        stopMic,
      })
      return disposeRoot
    })

    const pendingStart = session!.start()
    dispose()
    resolveStart?.(true)

    await expect(pendingStart).resolves.toBe(false)
    expect(stopMic).toHaveBeenCalledTimes(1)
  })
})
