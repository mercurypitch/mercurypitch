// Score-room tests keep musical time on the audio clock, never on a frame loop.
// ============================================================

import { createRoot, createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import type { GuitarRoomBand, GuitarRoomBandStartOptions, } from '@/features/guitar/backing/guitar-room-band'
import { DEFAULT_GUITAR_TUNING } from '@/lib/guitar/instrument-tuning'
import type { GuitarNightReference } from './reference-port'
import { scoreDurationBeats, scoreToBandMelody, useGuitarNightScoreRoomController, } from './useGuitarNightScoreRoomController'

function reference(
  overrides: Partial<GuitarNightReference> = {},
): GuitarNightReference {
  return {
    kind: 'authored',
    songId: 'gsong-1',
    title: 'Velvet Riff',
    trackId: 'track-lead',
    trackName: 'Lead guitar',
    tempoBpm: 90,
    tuning: DEFAULT_GUITAR_TUNING,
    outOfRangeNotes: 0,
    tracks: [{ id: 'track-lead', name: 'Lead guitar', noteCount: 2 }],
    notes: [
      {
        id: 'n1',
        midi: 64,
        noteName: 'E4',
        stringIndex: 0,
        fret: 0,
        startBeat: 0,
        duration: 1,
        targetFreq: 329.63,
      },
      {
        id: 'n2',
        midi: 67,
        noteName: 'G4',
        stringIndex: 0,
        fret: 3,
        startBeat: 2,
        duration: 2,
        targetFreq: 392,
      },
    ],
    ...overrides,
  }
}

/** A band whose clock the test drives, so no real audio is ever opened. */
function bandHarness() {
  const clock = { currentTime: 10 }
  const graph = { context: clock } as unknown as ReturnType<
    GuitarRoomBand['getAudioGraph']
  >
  let options: GuitarRoomBandStartOptions | null = null
  const band: GuitarRoomBand = {
    start: vi.fn(async (startOptions) => {
      options = startOptions
      return { expectedHitTimesMs: [] }
    }),
    activate: vi.fn(async () => graph),
    stop: vi.fn(),
    getAudioGraph: () => graph,
    dispose: vi.fn(async () => undefined),
  }
  return { band, clock, getOptions: () => options }
}

/** Frames only refresh the signal; the test pumps them by hand. */
function frameHarness() {
  const callbacks = new Map<number, () => void>()
  let next = 1
  return {
    requestFrame: (callback: () => void) => {
      const handle = next
      next += 1
      callbacks.set(handle, callback)
      return handle
    },
    cancelFrame: (handle: number) => {
      callbacks.delete(handle)
    },
    pump: () => {
      const pending = [...callbacks.entries()]
      callbacks.clear()
      for (const [, callback] of pending) callback()
    },
  }
}

describe('scoreDurationBeats', () => {
  it('measures to the end of the last note, not its start', () => {
    expect(scoreDurationBeats(reference())).toBe(4)
  })

  it('is zero with no score', () => {
    expect(scoreDurationBeats(null)).toBe(0)
  })
})

describe('useGuitarNightScoreRoomController', () => {
  it('stays silent until asked, then counts in before the score', async () => {
    await createRoot(async (dispose) => {
      const { band, getOptions } = bandHarness()
      const frames = frameHarness()
      const room = useGuitarNightScoreRoomController({
        reference: () => reference(),
        createBand: () => band,
        requestFrame: frames.requestFrame,
        cancelFrame: frames.cancelFrame,
      })

      expect(room.status()).toBe('quiet')
      expect(room.playheadBeat()).toBeNull()
      expect(band.start).not.toHaveBeenCalled()

      await room.start()

      expect(getOptions()?.countInBeats).toBe(4)
      expect(getOptions()?.tempoBpm).toBe(90)
      // Four beats of score, so four beats are scheduled.
      expect(getOptions()?.exerciseBeats).toBe(4)
      dispose()
    })
  })

  it('takes the playhead from the audio clock, not from frame count', async () => {
    await createRoot(async (dispose) => {
      const { band, clock, getOptions } = bandHarness()
      const frames = frameHarness()
      const room = useGuitarNightScoreRoomController({
        reference: () => reference(),
        createBand: () => band,
        requestFrame: frames.requestFrame,
        cancelFrame: frames.cancelFrame,
      })
      await room.start()

      getOptions()?.onBeat?.(0, 'count-in')
      expect(room.status()).toBe('count-in')
      expect(room.countInRemaining()).toBe(4)

      // Beat one of the score anchors the timeline here.
      getOptions()?.onBeat?.(0, 'exercise')
      expect(room.status()).toBe('playing')

      // Two seconds of audio clock at 90 BPM is three beats — whatever the
      // frame loop did in between.
      clock.currentTime = 12
      frames.pump()
      expect(room.positionSeconds()).toBeCloseTo(2, 5)
      expect(room.playheadBeat()).toBeCloseTo(3, 5)
      dispose()
    })
  })

  it('a tempo override retimes the score without touching its notes', async () => {
    await createRoot(async (dispose) => {
      const { band } = bandHarness()
      const frames = frameHarness()
      const room = useGuitarNightScoreRoomController({
        reference: () => reference(),
        createBand: () => band,
        requestFrame: frames.requestFrame,
        cancelFrame: frames.cancelFrame,
      })

      expect(room.tempoBpm()).toBe(90)
      // Four beats at 90 BPM.
      expect(room.durationSeconds()).toBeCloseTo(8 / 3, 5)

      room.setTempoBpm(60)
      expect(room.tempoBpm()).toBe(60)
      expect(room.durationSeconds()).toBeCloseTo(4, 5)
      expect(room.scoreTempo()).toBe(90)

      room.resetTempo()
      expect(room.tempoBpm()).toBe(90)
      dispose()
    })
  })

  it('clamps tempo and count-in to what the room can play', async () => {
    await createRoot(async (dispose) => {
      const { band } = bandHarness()
      const frames = frameHarness()
      const room = useGuitarNightScoreRoomController({
        reference: () => reference(),
        createBand: () => band,
        requestFrame: frames.requestFrame,
        cancelFrame: frames.cancelFrame,
      })

      room.setTempoBpm(5)
      expect(room.tempoBpm()).toBe(40)
      room.setTempoBpm(900)
      expect(room.tempoBpm()).toBe(220)
      room.setCountInBeats(-3)
      expect(room.countInBeats()).toBe(0)
      room.setCountInBeats(99)
      expect(room.countInBeats()).toBe(8)
      dispose()
    })
  })

  it('schedules a loop into the click and folds the playhead the same way', async () => {
    await createRoot(async (dispose) => {
      const { band, clock, getOptions } = bandHarness()
      const frames = frameHarness()
      const room = useGuitarNightScoreRoomController({
        // 90 BPM: one beat is 2/3 of a second.
        reference: () => reference(),
        loop: () => ({ start: 1, end: 3 }),
        createBand: () => band,
        requestFrame: frames.requestFrame,
        cancelFrame: frames.cancelFrame,
      })

      await room.start()

      // Whole beats, so the pulse's downbeat cannot drift pass to pass.
      expect(getOptions()?.loop).toEqual({ start: 1, end: 3 })
      expect(room.runningLoop()).toEqual({ start: 1, end: 3 })

      getOptions()?.onBeat?.(0, 'exercise')
      // Three beats of elapsed clock is one beat past B, so the playhead reads
      // beat 1 again — the same fold the scheduler applied.
      clock.currentTime = 10 + 3 * (60 / 90)
      frames.pump()
      expect(room.playheadBeat()).toBeCloseTo(1, 5)

      clock.currentTime = 10 + 4 * (60 / 90)
      frames.pump()
      expect(room.playheadBeat()).toBeCloseTo(2, 5)
      dispose()
    })
  })

  it('pins the loop for the take, so moving a mark cannot desync the click', async () => {
    await createRoot(async (dispose) => {
      const { band, getOptions } = bandHarness()
      const frames = frameHarness()
      const [span, setSpan] = createSignal<{
        start: number
        end: number
      } | null>({ start: 0, end: 2 })
      const room = useGuitarNightScoreRoomController({
        reference: () => reference(),
        loop: span,
        createBand: () => band,
        requestFrame: frames.requestFrame,
        cancelFrame: frames.cancelFrame,
      })
      await room.start()
      expect(getOptions()?.loop).toEqual({ start: 0, end: 2 })

      setSpan({ start: 2, end: 4 })

      // The pulse already scheduled is the one being heard.
      expect(room.runningLoop()).toEqual({ start: 0, end: 2 })
      dispose()
    })
  })

  it('stopping forgets the loop the take was running', async () => {
    await createRoot(async (dispose) => {
      const { band } = bandHarness()
      const frames = frameHarness()
      const room = useGuitarNightScoreRoomController({
        reference: () => reference(),
        loop: () => ({ start: 1, end: 3 }),
        createBand: () => band,
        requestFrame: frames.requestFrame,
        cancelFrame: frames.cancelFrame,
      })
      await room.start()
      expect(room.runningLoop()).not.toBeNull()

      room.stop()

      expect(room.runningLoop()).toBeNull()
      dispose()
    })
  })

  it('refuses to start with nothing to rehearse', async () => {
    await createRoot(async (dispose) => {
      const { band } = bandHarness()
      const frames = frameHarness()
      const room = useGuitarNightScoreRoomController({
        reference: () => null,
        createBand: () => band,
        requestFrame: frames.requestFrame,
        cancelFrame: frames.cancelFrame,
      })

      expect(await room.start()).toBe(false)
      expect(band.start).not.toHaveBeenCalled()
      dispose()
    })
  })

  it('stopping leaves the room quiet and the clock released', async () => {
    await createRoot(async (dispose) => {
      const { band, clock, getOptions } = bandHarness()
      const frames = frameHarness()
      const room = useGuitarNightScoreRoomController({
        reference: () => reference(),
        createBand: () => band,
        requestFrame: frames.requestFrame,
        cancelFrame: frames.cancelFrame,
      })
      await room.start()
      getOptions()?.onBeat?.(0, 'exercise')
      clock.currentTime = 11
      frames.pump()
      expect(room.positionSeconds()).toBeCloseTo(1, 5)

      room.stop()

      expect(room.status()).toBe('quiet')
      expect(room.positionSeconds()).toBe(0)
      expect(room.playheadBeat()).toBeNull()
      expect(band.stop).toHaveBeenCalled()
      // A late frame after stopping must not move the timeline again.
      clock.currentTime = 20
      frames.pump()
      expect(room.positionSeconds()).toBe(0)
      dispose()
    })
  })

  it('reports a clock that will not open instead of pretending to play', async () => {
    await createRoot(async (dispose) => {
      const { band } = bandHarness()
      band.start = vi.fn(async () => {
        throw new Error('no audio')
      })
      const frames = frameHarness()
      const room = useGuitarNightScoreRoomController({
        reference: () => reference(),
        createBand: () => band,
        requestFrame: frames.requestFrame,
        cancelFrame: frames.cancelFrame,
      })

      expect(await room.start()).toBe(false)
      expect(room.status()).toBe('error')
      expect(room.error()).not.toBeNull()
      dispose()
    })
  })
})

describe('scoreToBandMelody', () => {
  it('hands the band pitch and position, dropping the fingering it cannot use', () => {
    expect(scoreToBandMelody(reference())).toEqual([
      { midi: 64, startBeat: 0, durationBeats: 1 },
      { midi: 67, startBeat: 2, durationBeats: 2 },
    ])
  })

  it('has nothing to sound without a score', () => {
    expect(scoreToBandMelody(null)).toEqual([])
  })
})

describe('the tab room sounds the tab', () => {
  it('ticks rather than grooves, and plays the score', async () => {
    await createRoot(async (dispose) => {
      const { band, getOptions } = bandHarness()
      const frames = frameHarness()
      const room = useGuitarNightScoreRoomController({
        reference: () => reference(),
        createBand: () => band,
        requestFrame: frames.requestFrame,
        cancelFrame: frames.cancelFrame,
      })
      await room.start()

      // A kit implies an arrangement a written tab is no evidence of.
      expect(getOptions()?.feel).toBe('click')
      expect(getOptions()?.melody).toHaveLength(2)
      expect(getOptions()?.melodyVariant).toBe('electric')
      dispose()
    })
  })

  it('sounds a bass part with a bass voice', async () => {
    await createRoot(async (dispose) => {
      const { band, getOptions } = bandHarness()
      const frames = frameHarness()
      const room = useGuitarNightScoreRoomController({
        reference: () => reference(),
        instrument: () => 'bass',
        createBand: () => band,
        requestFrame: frames.requestFrame,
        cancelFrame: frames.cancelFrame,
      })
      await room.start()
      expect(getOptions()?.melodyVariant).toBe('bass')
      dispose()
    })
  })

  it('stays silent about the notes when asked to', async () => {
    await createRoot(async (dispose) => {
      const { band, getOptions } = bandHarness()
      const frames = frameHarness()
      const room = useGuitarNightScoreRoomController({
        reference: () => reference(),
        createBand: () => band,
        requestFrame: frames.requestFrame,
        cancelFrame: frames.cancelFrame,
      })
      room.setHearScore(false)
      await room.start()

      // The click still keeps time; only the part goes quiet.
      expect(getOptions()?.melody).toEqual([])
      expect(getOptions()?.feel).toBe('click')
      dispose()
    })
  })
})
