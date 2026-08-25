// Score-room tests keep musical time on the audio clock, never on a frame loop.
// ============================================================

import { createRoot, createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import type { GuitarRoomBand, GuitarRoomBandStartOptions, GuitarRoomBandStartResult, } from '@/features/guitar/backing/guitar-room-band'
import { DEFAULT_GUITAR_TUNING } from '@/lib/guitar/instrument-tuning'
import { onPersistedWrite } from '@/lib/storage'
import type { GuitarNightReference } from './reference-port'
import { useGuitarNightLoopController } from './useGuitarNightLoopController'
import { GUITAR_NIGHT_SCORE_CHANNEL, GUITAR_NIGHT_SCORE_MIX_VOLUME_KEY, scaleScoreTempoChanges, scoreDurationBeats, scoreToBandMelody, useGuitarNightScoreRoomController, } from './useGuitarNightScoreRoomController'

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
  const clock = { currentTime: 10, sampleRate: 48000 }
  const graph = { context: clock } as unknown as ReturnType<
    GuitarRoomBand['getAudioGraph']
  >
  let options: GuitarRoomBandStartOptions | null = null
  let result: GuitarRoomBandStartResult = {
    expectedHitTimesMs: [],
    exerciseStartedAtSeconds: null,
    completedAtSeconds: null,
  }
  const band: GuitarRoomBand = {
    start: vi.fn(async (startOptions) => {
      options = startOptions
      return result
    }),
    activate: vi.fn(async () => graph),
    setMasterLevel: vi.fn(),
    setMelodyChannelLevel: vi.fn(),
    stop: vi.fn(),
    getAudioGraph: () => graph,
    dispose: vi.fn(async () => undefined),
  }
  return {
    band,
    clock,
    getOptions: () => options,
    setResult: (next: GuitarRoomBandStartResult) => {
      result = next
    },
  }
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

/** The pulse is read on every beat now, so a test has to read it the same way. */
function pulseAudible(
  getOptions: () => { exercisePulse?: boolean | (() => boolean) } | null,
): boolean | undefined {
  const value = getOptions()?.exercisePulse
  return typeof value === 'function' ? value() : value
}

describe('useGuitarNightScoreRoomController', () => {
  it('pins and schedules one silent assessed range on exact audio boundaries', async () => {
    await createRoot(async (dispose) => {
      const { band, getOptions, setResult } = bandHarness()
      const frames = frameHarness()
      const [currentReference, setCurrentReference] = createSignal(
        reference({
          tempoBpm: 120,
          tempoChanges: [
            { beat: 0, usPerBeat: 500000 },
            { beat: 2, usPerBeat: 1000000 },
          ],
        }),
      )
      setResult({
        expectedHitTimesMs: [],
        exerciseStartedAtSeconds: 12.25,
        completedAtSeconds: 14.25,
      })
      const room = useGuitarNightScoreRoomController({
        reference: currentReference,
        createBand: () => band,
        requestFrame: frames.requestFrame,
        cancelFrame: frames.cancelFrame,
      })

      const boundary = await room.startAssessment({ start: 1.5, end: 3.25 })

      expect(getOptions()).toMatchObject({
        countInBeats: 4,
        startBeat: 1.5,
        durationBeats: 3.25,
        loop: null,
        melody: [],
      })
      expect(pulseAudible(getOptions)).toBe(false)
      expect(boundary).toMatchObject({
        range: { start: 1.5, end: 3.25 },
        tempoBpm: 120,
        scoreTempoBpm: 120,
        sampleRate: 48000,
        startedAtSeconds: 12.25,
        completedAtSeconds: 14.25,
      })
      expect(boundary?.beatToSeconds(3.25)).toBeCloseTo(2.25, 5)

      const replacementReference = reference({ title: 'A different score' })
      setCurrentReference(replacementReference)
      expect(boundary?.reference.title).toBe('Velvet Riff')
      expect(boundary?.reference).not.toBe(replacementReference)

      getOptions()?.onComplete?.(14.25)
      expect(room.status()).toBe('complete')
      expect(room.playheadBeat()).toBe(3.25)
      expect(room.displayPositionSeconds()).toBeCloseTo(2.25, 5)
      dispose()
    })
  })

  it('keeps live-score target and click sound under explicit mix controls', async () => {
    await createRoot(async (dispose) => {
      const { band, getOptions, setResult } = bandHarness()
      const frames = frameHarness()
      setResult({
        expectedHitTimesMs: [],
        exerciseStartedAtSeconds: 11,
        completedAtSeconds: 13,
      })
      const room = useGuitarNightScoreRoomController({
        reference: () => reference(),
        loop: () => ({ start: 0, end: 2 }),
        createBand: () => band,
        requestFrame: frames.requestFrame,
        cancelFrame: frames.cancelFrame,
      })

      room.setHearScore(false)
      room.setHearClick(false)
      await room.startLiveScore({ start: 0, end: 2 })
      expect(getOptions()).toMatchObject({
        startBeat: 0,
        durationBeats: 2,
        loop: null,
      })
      expect(getOptions()?.melody).toHaveLength(2)
      expect(band.setMelodyChannelLevel).toHaveBeenCalledWith(
        GUITAR_NIGHT_SCORE_CHANNEL,
        0,
      )
      expect(pulseAudible(getOptions)).toBe(false)

      room.setHearScore(true)
      expect(band.setMelodyChannelLevel).toHaveBeenLastCalledWith(
        GUITAR_NIGHT_SCORE_CHANNEL,
        1,
      )
      room.setHearClick(true)
      expect(pulseAudible(getOptions)).toBe(true)
      dispose()
    })
  })

  it('abandons an interrupted assessment instead of resuming it as a full take', async () => {
    await createRoot(async (dispose) => {
      const { band, getOptions, setResult } = bandHarness()
      const frames = frameHarness()
      setResult({
        expectedHitTimesMs: [],
        exerciseStartedAtSeconds: 11,
        completedAtSeconds: 13,
      })
      const room = useGuitarNightScoreRoomController({
        reference: () => reference(),
        createBand: () => band,
        requestFrame: frames.requestFrame,
        cancelFrame: frames.cancelFrame,
      })

      await room.startAssessment({ start: 1, end: 3 })
      getOptions()?.onExerciseStart?.(1, 11)
      room.pause()

      expect(room.status()).toBe('paused')
      expect(room.setupLocked()).toBe(false)
      await room.start()
      expect(pulseAudible(getOptions)).toBe(true)
      expect(getOptions()?.melody).toHaveLength(2)
      dispose()
    })
  })

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
      expect(getOptions()?.durationBeats).toBe(4)
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

      getOptions()?.onBeat?.(0, 'count-in', 9)
      expect(room.status()).toBe('count-in')
      expect(room.countInRemaining()).toBe(4)

      // Beat one was scheduled at 10. A delayed main-thread callback must not
      // redefine that audio-clock origin as the later delivery time.
      clock.currentTime = 10.4
      getOptions()?.onExerciseStart?.(0, 10)
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

  it('parks at the playhead before applying a clock change', async () => {
    await createRoot(async (dispose) => {
      const { band, clock, getOptions } = bandHarness()
      const frames = frameHarness()
      const [currentReference, setCurrentReference] = createSignal(reference())
      const [instrument, setInstrument] = createSignal<'guitar' | 'bass'>(
        'guitar',
      )
      const room = useGuitarNightScoreRoomController({
        reference: currentReference,
        instrument,
        createBand: () => band,
        requestFrame: frames.requestFrame,
        cancelFrame: frames.cancelFrame,
      })
      room.setTempoBpm(120)
      room.setCountInBeats(2)
      await room.start()

      room.setTempoBpm(60)
      room.setCountInBeats(8)
      room.setHearScore(false)
      setCurrentReference(
        reference({
          title: 'Next Riff',
          tempoBpm: 180,
          notes: [
            ...reference().notes,
            {
              ...reference().notes[0]!,
              id: 'n3',
              startBeat: 8,
              duration: 2,
            },
          ],
        }),
      )
      setInstrument('bass')

      expect(room.status()).toBe('paused')
      expect(room.setupLocked()).toBe(false)
      expect(room.tempoBpm()).toBe(60)
      expect(room.configuredCountInBeats()).toBe(4)
      expect(room.hearScore()).toBe(false)
      expect(room.durationBeats()).toBe(10)
      expect(room.displayReference()?.title).toBe('Next Riff')
      expect(band.stop).toHaveBeenCalled()

      // Delayed callbacks from the abandoned run cannot revive its clock.
      getOptions()?.onExerciseStart?.(0, 10)
      clock.currentTime = 14
      frames.pump()
      expect(room.status()).toBe('paused')
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

  it('follows and proportionally slows the complete authored tempo map', async () => {
    await createRoot(async (dispose) => {
      const { band, clock, getOptions } = bandHarness()
      const frames = frameHarness()
      const score = reference({
        tempoBpm: 120,
        tempoChanges: [
          { beat: 0, usPerBeat: 500000 },
          { beat: 2, usPerBeat: 1000000 },
        ],
      })
      const room = useGuitarNightScoreRoomController({
        reference: () => score,
        createBand: () => band,
        requestFrame: frames.requestFrame,
        cancelFrame: frames.cancelFrame,
      })

      expect(room.durationSeconds()).toBe(3)
      room.setTempoBpm(60)
      expect(room.durationSeconds()).toBe(6)
      await room.start()

      expect(getOptions()?.tempoChanges).toEqual([
        { beat: 0, usPerBeat: 1000000 },
        { beat: 2, usPerBeat: 2000000 },
      ])
      clock.currentTime = 10
      getOptions()?.onExerciseStart?.(0, 10)
      clock.currentTime = 12.5
      frames.pump()
      // Two one-second beats, then half of the next two-second beat.
      expect(room.playheadBeat()).toBeCloseTo(2.25, 5)
      dispose()
    })
  })

  it('parks a seek on the authored beat map and resumes from that beat', async () => {
    await createRoot(async (dispose) => {
      const { band, clock, getOptions } = bandHarness()
      const frames = frameHarness()
      const room = useGuitarNightScoreRoomController({
        reference: () =>
          reference({
            tempoBpm: 120,
            tempoChanges: [
              { beat: 0, usPerBeat: 500000 },
              { beat: 2, usPerBeat: 1000000 },
            ],
          }),
        createBand: () => band,
        requestFrame: frames.requestFrame,
        cancelFrame: frames.cancelFrame,
      })

      // 2.4 seconds is beat 3.4 in this map. A rehearsal seek must preserve
      // that exact position instead of replaying the start of beat 3.
      room.seekSeconds(2.4)
      expect(room.status()).toBe('paused')
      expect(room.playheadBeat()).toBeCloseTo(3.4, 5)
      expect(room.displayPositionSeconds()).toBeCloseTo(2.4, 5)
      expect(room.setupLocked()).toBe(false)

      await room.start()
      expect(getOptions()?.startBeat).toBeCloseTo(3.4, 5)
      expect(getOptions()?.countInBeats).toBe(4)

      getOptions()?.onExerciseStart?.(3.4, 10)
      clock.currentTime = 10.5
      frames.pump()
      expect(room.playheadBeat()).toBeCloseTo(3.9, 5)
      expect(room.displayPositionSeconds()).toBeCloseTo(2.9, 5)
      dispose()
    })
  })

  it('keeps a quiet seek configurable and reprojects its beat after a tempo change', async () => {
    await createRoot(async (dispose) => {
      const { band, getOptions } = bandHarness()
      const frames = frameHarness()
      const room = useGuitarNightScoreRoomController({
        reference: () =>
          reference({
            tempoBpm: 120,
            tempoChanges: [
              { beat: 0, usPerBeat: 500000 },
              { beat: 2, usPerBeat: 1000000 },
            ],
          }),
        createBand: () => band,
        requestFrame: frames.requestFrame,
        cancelFrame: frames.cancelFrame,
      })

      room.seekSeconds(2.4)
      expect(room.playheadBeat()).toBeCloseTo(3.4, 5)
      expect(room.setupLocked()).toBe(false)
      expect(band.start).not.toHaveBeenCalled()
      expect(band.activate).not.toHaveBeenCalled()

      room.setTempoBpm(60)
      room.setCountInBeats(0)
      expect(room.playheadBeat()).toBeCloseTo(3.4, 5)
      expect(room.displayPositionSeconds()).toBeCloseTo(4.8, 5)

      await room.start()
      expect(getOptions()?.startBeat).toBeCloseTo(3.4, 5)
      expect(getOptions()?.tempoBpm).toBe(60)
      expect(getOptions()?.countInBeats).toBe(0)
      expect(room.setupLocked()).toBe(true)
      dispose()
    })
  })

  it('pauses at the exact audio position and resumes without another count-in', async () => {
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
      getOptions()?.onExerciseStart?.(0, 10)
      clock.currentTime = 11
      frames.pump()

      room.pause()
      expect(room.status()).toBe('paused')
      expect(room.playheadBeat()).toBeCloseTo(1.5, 5)
      expect(room.displayPositionSeconds()).toBeCloseTo(1, 5)

      clock.currentTime = 20
      frames.pump()
      expect(room.playheadBeat()).toBeCloseTo(1.5, 5)

      await room.start()
      expect(getOptions()?.startBeat).toBeCloseTo(1.5, 5)
      expect(getOptions()?.countInBeats).toBe(0)
      dispose()
    })
  })

  it('keeps a late audio activation from reviving a scrubbed run', async () => {
    await createRoot(async (dispose) => {
      const { band } = bandHarness()
      const frames = frameHarness()
      let finishStart: (() => void) | undefined
      band.start = vi.fn(
        () =>
          new Promise<GuitarRoomBandStartResult>((resolve) => {
            finishStart = () =>
              resolve({
                expectedHitTimesMs: [],
                exerciseStartedAtSeconds: null,
                completedAtSeconds: null,
              })
          }),
      )
      const room = useGuitarNightScoreRoomController({
        reference: () => reference(),
        createBand: () => band,
        requestFrame: frames.requestFrame,
        cancelFrame: frames.cancelFrame,
      })

      const opening = room.start()
      expect(room.status()).toBe('starting')
      room.seekSeconds(1)
      expect(room.status()).toBe('paused')
      expect(room.playheadBeat()).toBeCloseTo(1.5, 5)

      finishStart?.()
      await expect(opening).resolves.toBe(false)
      expect(room.status()).toBe('paused')
      expect(room.playheadBeat()).toBeCloseTo(1.5, 5)
      dispose()
    })
  })

  it('can seek away from the end and Stop releases the parked take', async () => {
    await createRoot(async (dispose) => {
      const { band } = bandHarness()
      const frames = frameHarness()
      const room = useGuitarNightScoreRoomController({
        reference: () => reference(),
        createBand: () => band,
        requestFrame: frames.requestFrame,
        cancelFrame: frames.cancelFrame,
      })

      room.seekSeconds(999)
      expect(room.status()).toBe('complete')
      expect(room.playheadBeat()).toBe(4)
      expect(room.setupLocked()).toBe(false)

      room.seekSeconds(1)
      expect(room.status()).toBe('paused')
      expect(room.playheadBeat()).toBeCloseTo(1.5, 5)
      await room.start()
      expect(room.setupLocked()).toBe(true)

      room.stop()
      expect(room.status()).toBe('quiet')
      expect(room.playheadBeat()).toBeNull()
      expect(room.positionSeconds()).toBe(0)
      expect(room.setupLocked()).toBe(false)
      dispose()
    })
  })

  it('turns a completed-take seek into a configurable run', async () => {
    await createRoot(async (dispose) => {
      const [currentReference, setCurrentReference] = createSignal(reference())
      const { band, getOptions } = bandHarness()
      const frames = frameHarness()
      const room = useGuitarNightScoreRoomController({
        reference: currentReference,
        createBand: () => band,
        requestFrame: frames.requestFrame,
        cancelFrame: frames.cancelFrame,
      })

      await room.start()
      getOptions()?.onComplete?.(getOptions()?.durationBeats ?? 4)
      expect(room.status()).toBe('complete')

      setCurrentReference(reference({ title: 'Next score' }))
      room.setTempoBpm(72)
      room.setCountInBeats(2)
      room.seekSeconds(1)

      expect(room.status()).toBe('paused')
      expect(room.setupLocked()).toBe(false)
      expect(room.displayReference()?.title).toBe('Next score')

      await room.start()
      expect(getOptions()).toMatchObject({ tempoBpm: 72, countInBeats: 2 })
      dispose()
    })
  })

  it('releases a completed score before switching the loaded part', async () => {
    await createRoot(async (dispose) => {
      const [currentReference, setCurrentReference] = createSignal(reference())
      const { band, getOptions } = bandHarness()
      const frames = frameHarness()
      const room = useGuitarNightScoreRoomController({
        reference: currentReference,
        createBand: () => band,
        requestFrame: frames.requestFrame,
        cancelFrame: frames.cancelFrame,
      })

      await room.start()
      getOptions()?.onComplete?.(getOptions()?.durationBeats ?? 4)
      expect(room.status()).toBe('complete')
      expect(room.displayReference()?.title).toBe('Velvet Riff')

      room.parkForConfiguration()
      setCurrentReference(
        reference({
          title: 'Short part',
          trackId: 'track-rhythm',
          trackName: 'Rhythm guitar',
          notes: [
            {
              ...reference().notes[0]!,
              id: 'short-1',
              duration: 2,
            },
          ],
        }),
      )

      expect(room.status()).toBe('complete')
      expect(room.setupLocked()).toBe(false)
      expect(room.displayReference()?.title).toBe('Short part')
      expect(room.playheadBeat()).toBe(2)

      await room.start()
      expect(getOptions()?.startBeat).toBe(0)
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
      expect(room.countInBeats()).toBe(4)
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

      getOptions()?.onExerciseStart?.(0, 10)
      // Three beats of elapsed clock is one beat past B, so the playhead reads
      // beat 1 again — the same fold the scheduler applied.
      clock.currentTime = 10 + 3 * (60 / 90)
      frames.pump()
      expect(room.playheadBeat()).toBeCloseTo(1, 5)
      expect(room.displayPositionSeconds()).toBeCloseTo(60 / 90, 5)

      clock.currentTime = 10 + 4 * (60 / 90)
      frames.pump()
      expect(room.playheadBeat()).toBeCloseTo(2, 5)
      expect(room.displayPositionSeconds()).toBeCloseTo(2 * (60 / 90), 5)
      dispose()
    })
  })

  it('repeats the mapped seconds between A and B when the score changes tempo', async () => {
    await createRoot(async (dispose) => {
      const { band, clock, getOptions } = bandHarness()
      const frames = frameHarness()
      const room = useGuitarNightScoreRoomController({
        reference: () =>
          reference({
            tempoBpm: 120,
            tempoChanges: [
              { beat: 0, usPerBeat: 500000 },
              { beat: 2, usPerBeat: 1000000 },
            ],
          }),
        loop: () => ({ start: 1, end: 3 }),
        createBand: () => band,
        requestFrame: frames.requestFrame,
        cancelFrame: frames.cancelFrame,
      })

      await room.start()
      getOptions()?.onExerciseStart?.(0, 10)

      // A is at 0.5 s and B is at 2 s. At B the scheduler returns to A.
      clock.currentTime = 12
      frames.pump()
      expect(room.playheadBeat()).toBeCloseTo(1, 5)

      // Half a second into the repeated 1.5 s interval reaches beat 2.
      clock.currentTime = 12.5
      frames.pump()
      expect(room.playheadBeat()).toBeCloseTo(2, 5)

      // One complete repeated interval returns to A again.
      clock.currentTime = 13.5
      frames.pump()
      expect(room.playheadBeat()).toBeCloseTo(1, 5)
      dispose()
    })
  })

  it('resumes a fractional position inside a mapped loop without changing its clock', async () => {
    await createRoot(async (dispose) => {
      const { band, clock, getOptions } = bandHarness()
      const frames = frameHarness()
      const room = useGuitarNightScoreRoomController({
        reference: () =>
          reference({
            tempoBpm: 120,
            tempoChanges: [
              { beat: 0, usPerBeat: 500000 },
              { beat: 2, usPerBeat: 1000000 },
            ],
          }),
        loop: () => ({ start: 1, end: 3 }),
        createBand: () => band,
        requestFrame: frames.requestFrame,
        cancelFrame: frames.cancelFrame,
      })

      room.seekSeconds(1.4)
      expect(room.playheadBeat()).toBeCloseTo(2.4, 5)
      await room.start()
      expect(getOptions()?.startBeat).toBeCloseTo(2.4, 5)
      getOptions()?.onExerciseStart?.(2.4, 10)

      clock.currentTime = 10.6
      frames.pump()
      expect(room.playheadBeat()).toBeCloseTo(1, 5)

      clock.currentTime = 10.8
      room.pause()
      expect(room.playheadBeat()).toBeCloseTo(1.4, 5)
      await room.start()
      expect(getOptions()?.startBeat).toBeCloseTo(1.4, 5)
      expect(getOptions()?.countInBeats).toBe(0)
      dispose()
    })
  })

  it('activates a newly completed A/B loop from A while rehearsal is playing', async () => {
    await createRoot(async (dispose) => {
      const { band, clock, getOptions } = bandHarness()
      const frames = frameHarness()
      const loop = useGuitarNightLoopController({ limit: () => 4 })
      const room = useGuitarNightScoreRoomController({
        reference: () => reference(),
        loop: loop.span,
        createBand: () => band,
        requestFrame: frames.requestFrame,
        cancelFrame: frames.cancelFrame,
      })
      await room.start()
      getOptions()?.onExerciseStart?.(0, 10)
      clock.currentTime = 10 + 2 * (60 / 90)
      frames.pump()
      expect(room.playheadBeat()).toBeCloseTo(2, 5)

      // Completing B is the boundary the player has just reached. Activate the
      // loop there, return to A without another count-in, and hand the complete
      // span to the gapless band scheduler in one relaunch.
      loop.markStart(1)
      expect(band.start).toHaveBeenCalledOnce()
      loop.markEnd(2)
      await expect(room.applyLoopSpan(loop.span())).resolves.toBe(true)
      await vi.waitFor(() => expect(band.start).toHaveBeenCalledTimes(2))

      expect(getOptions()).toMatchObject({
        startBeat: 1,
        countInBeats: 0,
        loop: { start: 1, end: 2 },
      })
      expect(room.runningLoop()).toEqual({ start: 1, end: 2 })
      expect(room.playheadBeat()).toBeCloseTo(1, 5)
      dispose()
    })
  })

  it('applies a changed active loop explicitly for marker drag callbacks', async () => {
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
      getOptions()?.onExerciseStart?.(0, 10)

      const nextSpan = { start: 1, end: 3 }
      setSpan(nextSpan)
      await expect(room.applyLoopSpan(nextSpan)).resolves.toBe(true)

      expect(band.start).toHaveBeenCalledTimes(2)
      expect(getOptions()).toMatchObject({
        startBeat: 1,
        countInBeats: 0,
        loop: { start: 1, end: 3 },
      })
      expect(room.runningLoop()).toEqual({ start: 1, end: 3 })
      dispose()
    })
  })

  it('keeps the audible beat when B moves beyond an active loop playhead', async () => {
    await createRoot(async (dispose) => {
      const { band, clock, getOptions } = bandHarness()
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
      getOptions()?.onExerciseStart?.(0, 10)
      clock.currentTime = 10 + 1.5 * (60 / 90)
      frames.pump()
      expect(room.playheadBeat()).toBeCloseTo(1.5, 5)

      const expanded = { start: 0, end: 3 }
      setSpan(expanded)
      await expect(room.applyLoopSpan(expanded)).resolves.toBe(true)
      await vi.waitFor(() => expect(band.start).toHaveBeenCalledTimes(2))

      expect(getOptions()).toMatchObject({
        countInBeats: 0,
        loop: expanded,
      })
      expect(getOptions()?.startBeat).toBeCloseTo(1.5, 5)
      expect(room.playheadBeat()).toBeCloseTo(1.5, 5)
      dispose()
    })
  })

  it('clears an active loop immediately from its visible playhead', async () => {
    await createRoot(async (dispose) => {
      const { band, clock, getOptions } = bandHarness()
      const frames = frameHarness()
      const [span, setSpan] = createSignal<{
        start: number
        end: number
      } | null>({ start: 1, end: 3 })
      const room = useGuitarNightScoreRoomController({
        reference: () => reference(),
        loop: span,
        createBand: () => band,
        requestFrame: frames.requestFrame,
        cancelFrame: frames.cancelFrame,
      })
      await room.start()
      getOptions()?.onExerciseStart?.(0, 10)
      clock.currentTime = 10 + 2.5 * (60 / 90)
      frames.pump()
      expect(room.playheadBeat()).toBeCloseTo(2.5, 5)

      setSpan(null)
      await expect(room.applyLoopSpan(null)).resolves.toBe(true)
      await vi.waitFor(() => expect(band.start).toHaveBeenCalledTimes(2))

      expect(getOptions()).toMatchObject({
        countInBeats: 0,
        loop: null,
      })
      expect(getOptions()?.startBeat).toBeCloseTo(2.5, 5)
      expect(room.runningLoop()).toBeNull()
      expect(room.playheadBeat()).toBeCloseTo(2.5, 5)
      dispose()
    })
  })

  it('stages a paused loop edit at A without resetting through Stop', async () => {
    await createRoot(async (dispose) => {
      const { band, clock, getOptions } = bandHarness()
      const frames = frameHarness()
      const [span, setSpan] = createSignal<{
        start: number
        end: number
      } | null>(null)
      const room = useGuitarNightScoreRoomController({
        reference: () => reference(),
        loop: span,
        createBand: () => band,
        requestFrame: frames.requestFrame,
        cancelFrame: frames.cancelFrame,
      })
      await room.start()
      getOptions()?.onExerciseStart?.(0, 10)
      clock.currentTime = 10 + 2.5 * (60 / 90)
      frames.pump()
      room.pause()

      const nextSpan = { start: 1, end: 3 }
      setSpan(nextSpan)
      await expect(room.applyLoopSpan(nextSpan)).resolves.toBe(true)
      expect(room.status()).toBe('paused')
      expect(room.runningLoop()).toEqual({ start: 1, end: 3 })
      expect(room.playheadBeat()).toBeCloseTo(1, 5)

      await room.start()
      expect(band.start).toHaveBeenCalledTimes(2)
      expect(getOptions()).toMatchObject({
        startBeat: 1,
        countInBeats: 0,
        loop: { start: 1, end: 3 },
      })
      dispose()
    })
  })

  it('clears a paused loop without losing its folded visible beat', async () => {
    await createRoot(async (dispose) => {
      const { band, clock, getOptions } = bandHarness()
      const frames = frameHarness()
      const [span, setSpan] = createSignal<{
        start: number
        end: number
      } | null>({ start: 1, end: 3 })
      const room = useGuitarNightScoreRoomController({
        reference: () => reference(),
        loop: span,
        createBand: () => band,
        requestFrame: frames.requestFrame,
        cancelFrame: frames.cancelFrame,
      })
      await room.start()
      getOptions()?.onExerciseStart?.(0, 10)
      clock.currentTime = 10 + 2.5 * (60 / 90)
      frames.pump()
      room.pause()

      setSpan(null)
      await expect(room.applyLoopSpan(null)).resolves.toBe(true)
      expect(room.status()).toBe('paused')
      expect(room.runningLoop()).toBeNull()
      expect(room.playheadBeat()).toBeCloseTo(2.5, 5)

      await room.start()
      expect(band.start).toHaveBeenCalledTimes(2)
      expect(getOptions()).toMatchObject({
        countInBeats: 0,
        loop: null,
      })
      expect(getOptions()?.startBeat).toBeCloseTo(2.5, 5)
      dispose()
    })
  })

  it('does not relaunch scored evidence when its loop marks change', async () => {
    await createRoot(async (dispose) => {
      const { band, setResult } = bandHarness()
      const frames = frameHarness()
      setResult({
        expectedHitTimesMs: [],
        exerciseStartedAtSeconds: 11,
        completedAtSeconds: 13,
      })
      const room = useGuitarNightScoreRoomController({
        reference: () => reference(),
        createBand: () => band,
        requestFrame: frames.requestFrame,
        cancelFrame: frames.cancelFrame,
      })
      await room.startLiveScore({ start: 0, end: 2 })

      await expect(room.applyLoopSpan({ start: 1, end: 3 })).resolves.toBe(
        false,
      )
      await expect(room.applyLoopSpan(null)).resolves.toBe(false)
      expect(band.start).toHaveBeenCalledOnce()
      expect(room.runningLoop()).toBeNull()
      dispose()
    })
  })

  it('does not admit the transient inverse of an invalid B mark', async () => {
    await createRoot(async (dispose) => {
      const { band, getOptions } = bandHarness()
      const frames = frameHarness()
      const loop = useGuitarNightLoopController({ limit: () => 4 })
      const room = useGuitarNightScoreRoomController({
        reference: () => reference(),
        loop: loop.span,
        createBand: () => band,
        requestFrame: frames.requestFrame,
        cancelFrame: frames.cancelFrame,
      })
      await room.start()
      getOptions()?.onExerciseStart?.(0, 10)

      loop.markStart(2)
      loop.markEnd(1)
      await Promise.resolve()

      expect(loop.span()).toBeNull()
      expect(band.start).toHaveBeenCalledOnce()
      expect(room.runningLoop()).toBeNull()
      dispose()
    })
  })

  it('seeks in authored beats through the active tempo map', async () => {
    await createRoot(async (dispose) => {
      const { band } = bandHarness()
      const frames = frameHarness()
      const room = useGuitarNightScoreRoomController({
        reference: () =>
          reference({
            tempoBpm: 120,
            tempoChanges: [
              { beat: 0, usPerBeat: 500000 },
              { beat: 2, usPerBeat: 1000000 },
            ],
          }),
        createBand: () => band,
        requestFrame: frames.requestFrame,
        cancelFrame: frames.cancelFrame,
      })

      expect(room.secondsForBeat(2.5)).toBeCloseTo(1.5, 5)
      expect(room.beatForSeconds(1.5)).toBeCloseTo(2.5, 5)
      room.seekBeat(2.5)

      expect(room.status()).toBe('paused')
      expect(room.playheadBeat()).toBeCloseTo(2.5, 5)
      expect(room.positionSeconds()).toBeCloseTo(1.5, 5)
      dispose()
    })
  })

  it('keeps rail conversions pinned to the sounding run tempo map', async () => {
    await createRoot(async (dispose) => {
      const { band } = bandHarness()
      const frames = frameHarness()
      const [currentReference, setCurrentReference] = createSignal(
        reference({
          tempoBpm: 120,
          tempoChanges: [
            { beat: 0, usPerBeat: 500000 },
            { beat: 2, usPerBeat: 1000000 },
          ],
        }),
      )
      const room = useGuitarNightScoreRoomController({
        reference: currentReference,
        createBand: () => band,
        requestFrame: frames.requestFrame,
        cancelFrame: frames.cancelFrame,
      })
      await room.start()

      setCurrentReference(reference({ tempoBpm: 60, tempoChanges: [] }))

      expect(room.secondsForBeat(2.5)).toBeCloseTo(1.5, 5)
      expect(room.beatForSeconds(1.5)).toBeCloseTo(2.5, 5)
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
      getOptions()?.onExerciseStart?.(0, 10)
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
      expect(band.stop).toHaveBeenCalledTimes(2)
      dispose()
    })
  })
})

describe('scaleScoreTempoChanges', () => {
  it('preserves every relative tempo change at a new opening tempo', () => {
    expect(
      scaleScoreTempoChanges(
        [
          { beat: 0, usPerBeat: 500000 },
          { beat: 8, usPerBeat: 750000 },
        ],
        120,
        60,
      ),
    ).toEqual([
      { beat: 0, usPerBeat: 1000000 },
      { beat: 8, usPerBeat: 1500000 },
    ])
  })
})

describe('scoreToBandMelody', () => {
  it('hands the band pitch and position, dropping the fingering it cannot use', () => {
    expect(scoreToBandMelody(reference())).toEqual([
      {
        midi: 64,
        startBeat: 0,
        durationBeats: 1,
        channelId: 'guitar-night-score',
      },
      {
        midi: 67,
        startBeat: 2,
        durationBeats: 2,
        channelId: 'guitar-night-score',
      },
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

      // The lane remains scheduled so it can be restored without a restart.
      expect(getOptions()?.melody).toHaveLength(2)
      expect(band.setMelodyChannelLevel).toHaveBeenCalledWith(
        'guitar-night-score',
        0,
      )
      expect(getOptions()?.feel).toBe('click')
      dispose()
    })
  })

  it('changes the scored-part gain live without replacing the take', async () => {
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
      getOptions()?.onExerciseStart?.(0, 11)
      expect(room.status()).toBe('playing')

      room.setHearScore(false)
      expect(room.status()).toBe('playing')
      expect(band.setMelodyChannelLevel).toHaveBeenLastCalledWith(
        'guitar-night-score',
        0,
      )

      room.setHearScore(true)
      expect(band.setMelodyChannelLevel).toHaveBeenLastCalledWith(
        'guitar-night-score',
        1,
      )
      dispose()
    })
  })

  it('ramps every rehearsal volume input but coalesces persistence', () => {
    localStorage.removeItem(GUITAR_NIGHT_SCORE_MIX_VOLUME_KEY)
    vi.useFakeTimers()
    const writes: Array<[string, string]> = []
    onPersistedWrite((key, value) => writes.push([key, value]))
    try {
      createRoot((dispose) => {
        const { band } = bandHarness()
        const frames = frameHarness()
        const room = useGuitarNightScoreRoomController({
          reference: () => reference(),
          createBand: () => band,
          requestFrame: frames.requestFrame,
          cancelFrame: frames.cancelFrame,
        })

        room.setMasterVolume(0.31)
        room.setMasterVolume(0.34)
        room.setMasterVolume(0.37)
        expect(room.masterVolume()).toBe(0.37)
        expect(band.setMasterLevel).toHaveBeenLastCalledWith(0.37)
        expect(
          localStorage.getItem(GUITAR_NIGHT_SCORE_MIX_VOLUME_KEY),
        ).toBeNull()

        vi.advanceTimersByTime(179)
        expect(
          localStorage.getItem(GUITAR_NIGHT_SCORE_MIX_VOLUME_KEY),
        ).toBeNull()
        vi.advanceTimersByTime(1)
        expect(localStorage.getItem(GUITAR_NIGHT_SCORE_MIX_VOLUME_KEY)).toBe(
          '0.37',
        )
        expect(
          writes.filter(([key]) => key === GUITAR_NIGHT_SCORE_MIX_VOLUME_KEY),
        ).toHaveLength(1)

        room.setMasterVolume(0.41)
        dispose()
        expect(localStorage.getItem(GUITAR_NIGHT_SCORE_MIX_VOLUME_KEY)).toBe(
          '0.41',
        )
      })

      createRoot((dispose) => {
        const { band } = bandHarness()
        const frames = frameHarness()
        const room = useGuitarNightScoreRoomController({
          reference: () => reference(),
          createBand: () => band,
          requestFrame: frames.requestFrame,
          cancelFrame: frames.cancelFrame,
        })

        expect(room.masterVolume()).toBe(0.41)
        expect(band.setMasterLevel).toHaveBeenLastCalledWith(0.41)
        dispose()
      })
    } finally {
      onPersistedWrite(null)
      vi.useRealTimers()
      localStorage.removeItem(GUITAR_NIGHT_SCORE_MIX_VOLUME_KEY)
    }
  })

  describe('the rest of the band', () => {
    it('sounds every other part under the scored one', async () => {
      await createRoot(async (dispose) => {
        const { band, getOptions } = bandHarness()
        const frames = frameHarness()
        const room = useGuitarNightScoreRoomController({
          reference: () => reference(),
          createBand: () => band,
          requestFrame: frames.requestFrame,
          cancelFrame: frames.cancelFrame,
          backingMelody: () => [
            { midi: 40, startBeat: 0, durationBeats: 1, variant: 'bass' },
          ],
        })

        await room.start()
        const melody = getOptions()?.melody ?? []
        // The written part, and the band underneath it.
        expect(melody.map((note) => note.midi)).toEqual([64, 67, 40])
        expect(melody.at(-1)?.variant).toBe('bass')
        dispose()
      })
    })

    it('keeps the band when the player mutes their own part', async () => {
      await createRoot(async (dispose) => {
        const { band, getOptions } = bandHarness()
        const frames = frameHarness()
        const room = useGuitarNightScoreRoomController({
          reference: () => reference(),
          createBand: () => band,
          requestFrame: frames.requestFrame,
          cancelFrame: frames.cancelFrame,
          backingMelody: () => [
            { midi: 40, startBeat: 0, durationBeats: 1, variant: 'bass' },
          ],
          defaultHearScore: () => false,
        })

        expect(room.hearScore()).toBe(false)
        await room.start()
        expect((getOptions()?.melody ?? []).map((note) => note.midi)).toEqual([
          64, 67, 40,
        ])
        expect(band.setMelodyChannelLevel).toHaveBeenCalledWith(
          'guitar-night-score',
          0,
        )
        dispose()
      })
    })

    it('opens and closes backing lanes live from the host mix', async () => {
      await createRoot(async (dispose) => {
        const { band, getOptions } = bandHarness()
        const frames = frameHarness()
        const [audible, setAudible] = createSignal<readonly string[]>([
          'track-bass',
        ])
        const room = useGuitarNightScoreRoomController({
          reference: () => reference(),
          createBand: () => band,
          requestFrame: frames.requestFrame,
          cancelFrame: frames.cancelFrame,
          backingMelody: () => [
            {
              midi: 40,
              startBeat: 0,
              durationBeats: 1,
              variant: 'bass',
              channelId: 'track-bass',
            },
          ],
          audibleBackingTrackIds: audible,
        })

        await room.start()
        getOptions()?.onExerciseStart?.(0, 11)
        setAudible([])
        expect(room.status()).toBe('playing')
        expect(band.setMelodyChannelLevel).toHaveBeenLastCalledWith(
          'track-bass',
          0,
        )
        setAudible(['track-bass'])
        expect(band.setMelodyChannelLevel).toHaveBeenLastCalledWith(
          'track-bass',
          1,
        )
        dispose()
      })
    })

    it('keeps live backing lanes scheduled under their master and track gates', async () => {
      await createRoot(async (dispose) => {
        const { band, getOptions, setResult } = bandHarness()
        const frames = frameHarness()
        const [audible, setAudible] = createSignal<readonly string[]>([
          'track-bass',
        ])
        setResult({
          expectedHitTimesMs: [],
          exerciseStartedAtSeconds: 11,
          completedAtSeconds: 13,
        })
        const room = useGuitarNightScoreRoomController({
          reference: () => reference(),
          createBand: () => band,
          requestFrame: frames.requestFrame,
          cancelFrame: frames.cancelFrame,
          backingMelody: () => [
            {
              midi: 40,
              startBeat: 0,
              durationBeats: 1,
              variant: 'bass',
              channelId: 'track-bass',
            },
          ],
          audibleBackingTrackIds: audible,
        })

        room.setHearBacking(false)
        await room.startLiveScore({ start: 0, end: 2 })

        expect((getOptions()?.melody ?? []).map((note) => note.midi)).toEqual([
          64, 67, 40,
        ])
        expect(
          (getOptions()?.melody ?? []).some(
            (note) => note.channelId === GUITAR_NIGHT_SCORE_CHANNEL,
          ),
        ).toBe(true)
        expect(band.setMelodyChannelLevel).toHaveBeenCalledWith('track-bass', 0)

        room.setHearBacking(true)
        expect(band.setMelodyChannelLevel).toHaveBeenLastCalledWith(
          'track-bass',
          1,
        )
        setAudible([])
        expect(band.setMelodyChannelLevel).toHaveBeenLastCalledWith(
          'track-bass',
          0,
        )
        dispose()
      })
    })

    it('lets the player overrule the default, per part', async () => {
      await createRoot(async (dispose) => {
        const { band } = bandHarness()
        const frames = frameHarness()
        const [scored, setScored] = createSignal('track-lead')
        const room = useGuitarNightScoreRoomController({
          reference: () =>
            reference({ trackId: scored(), trackName: scored() }),
          createBand: () => band,
          requestFrame: frames.requestFrame,
          cancelFrame: frames.cancelFrame,
          defaultHearScore: () => false,
        })

        expect(room.hearScore()).toBe(false)
        room.setHearScore(true)
        expect(room.hearScore()).toBe(true)

        // Reading a different part starts from that part's own default.
        setScored('track-rhythm')
        expect(room.hearScore()).toBe(false)
        dispose()
      })
    })

    it('never sounds the band into an open microphone', async () => {
      await createRoot(async (dispose) => {
        const { band, getOptions } = bandHarness()
        const frames = frameHarness()
        const room = useGuitarNightScoreRoomController({
          reference: () => reference(),
          createBand: () => band,
          requestFrame: frames.requestFrame,
          cancelFrame: frames.cancelFrame,
          backingMelody: () => [
            { midi: 40, startBeat: 0, durationBeats: 1, variant: 'bass' },
          ],
        })

        await room.startAssessment({ start: 0, end: 4 })
        expect(getOptions()?.melody ?? []).toEqual([])
        dispose()
      })
    })
  })

  describe('the click', () => {
    it('runs under the take by default', async () => {
      await createRoot(async (dispose) => {
        const { band, getOptions } = bandHarness()
        const frames = frameHarness()
        const room = useGuitarNightScoreRoomController({
          reference: () => reference(),
          createBand: () => band,
          requestFrame: frames.requestFrame,
          cancelFrame: frames.cancelFrame,
        })

        expect(room.hearClick()).toBe(true)
        await room.start()
        expect(pulseAudible(getOptions)).toBe(true)
        dispose()
      })
    })

    it('can be quieted while it is ticking, which is when anyone asks', async () => {
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
        getOptions()?.onExerciseStart?.(0, 11)
        expect(pulseAudible(getOptions)).toBe(true)

        // The band reads this on every beat, so the take does not have to end
        // and start again for the room to go quiet.
        room.setHearClick(false)
        expect(pulseAudible(getOptions)).toBe(false)

        room.setHearClick(true)
        expect(pulseAudible(getOptions)).toBe(true)
        dispose()
      })
    })

    it('keeps the click live-controlled during a scored take', async () => {
      await createRoot(async (dispose) => {
        const { band, getOptions } = bandHarness()
        const frames = frameHarness()
        const room = useGuitarNightScoreRoomController({
          reference: () => reference(),
          loop: () => ({ start: 0, end: 2 }),
          createBand: () => band,
          requestFrame: frames.requestFrame,
          cancelFrame: frames.cancelFrame,
        })

        await room.startLiveScore({ start: 0, end: 2 })
        expect(pulseAudible(getOptions)).toBe(true)
        room.setHearClick(false)
        expect(pulseAudible(getOptions)).toBe(false)
        dispose()
      })
    })

    it('can be quieted, and the count-in still counts', async () => {
      await createRoot(async (dispose) => {
        const { band, getOptions } = bandHarness()
        const frames = frameHarness()
        const room = useGuitarNightScoreRoomController({
          reference: () => reference(),
          createBand: () => band,
          requestFrame: frames.requestFrame,
          cancelFrame: frames.cancelFrame,
        })

        room.setHearClick(false)
        expect(room.hearClick()).toBe(false)
        await room.start()
        expect(pulseAudible(getOptions)).toBe(false)
        expect(getOptions()?.countInBeats).toBeGreaterThan(0)
        dispose()
      })
    })

    it('can launch immediately while the playback click stays on', async () => {
      await createRoot(async (dispose) => {
        const { band, getOptions } = bandHarness()
        const frames = frameHarness()
        const room = useGuitarNightScoreRoomController({
          reference: () => reference(),
          createBand: () => band,
          requestFrame: frames.requestFrame,
          cancelFrame: frames.cancelFrame,
        })

        room.setCountInBeats(0)
        expect(room.configuredCountInBeats()).toBe(0)
        expect(room.hearClick()).toBe(true)

        await room.start()
        expect(getOptions()?.countInBeats).toBe(0)
        expect(pulseAudible(getOptions)).toBe(true)
        dispose()
      })
    })

    it('pins an in-flight count-in even when the next launch is set to Off', async () => {
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
        getOptions()?.onBeat?.(0, 'count-in', 10)
        expect(room.status()).toBe('count-in')
        expect(room.countInBeats()).toBe(4)

        room.setCountInBeats(0)
        expect(room.configuredCountInBeats()).toBe(0)
        expect(room.countInBeats()).toBe(4)
        expect(getOptions()?.countInBeats).toBe(4)
        dispose()
      })
    })
  })

  describe('ending a take', () => {
    it('unpins the setup a take had locked', async () => {
      await createRoot(async (dispose) => {
        const { band } = bandHarness()
        const frames = frameHarness()
        const room = useGuitarNightScoreRoomController({
          reference: () => reference(),
          createBand: () => band,
          requestFrame: frames.requestFrame,
          cancelFrame: frames.cancelFrame,
        })

        await room.start()
        expect(room.setupLocked()).toBe(true)
        room.pause()
        // A paused rehearsal take is resumable, so it keeps its grip.
        expect(room.setupLocked()).toBe(true)

        room.stop()
        expect(room.setupLocked()).toBe(false)
        expect(room.status()).toBe('quiet')
        dispose()
      })
    })

    it('returns the room to the part that is loaded now', async () => {
      await createRoot(async (dispose) => {
        const { band } = bandHarness()
        const frames = frameHarness()
        const [title, setTitle] = createSignal('Velvet Riff')
        const room = useGuitarNightScoreRoomController({
          reference: () => reference({ title: title() }),
          createBand: () => band,
          requestFrame: frames.requestFrame,
          cancelFrame: frames.cancelFrame,
        })

        await room.start()
        setTitle('Next Riff')
        // The sounding take keeps the score it is actually playing.
        expect(room.displayReference()?.title).toBe('Velvet Riff')

        room.stop()
        expect(room.displayReference()?.title).toBe('Next Riff')
        dispose()
      })
    })
  })
})
