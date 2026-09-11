// Free-form Practice tests exercise real scoring across shared input and scheduler boundaries.
import { createRoot, createSignal, untrack } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GuitarRoomBand, GuitarRoomBandStartOptions, GuitarRoomBandStartResult, } from '@/features/guitar/backing/guitar-room-band'
import { DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS } from '@/lib/guitar/guitar-electric-amp'
import type { GuitarInputProfileKind } from '@/lib/guitar/guitar-input-profile'
import type { GuitarTakeRecorder, GuitarTakeSnapshot, } from '@/lib/guitar/guitar-take-recorder'
import { createGuitarTakeRecorder } from '@/lib/guitar/guitar-take-recorder'
import { DEFAULT_GUITAR_TUNING } from '@/lib/guitar/instrument-tuning'
import { createBeatClock } from '@/lib/midi-song'
import type { GuitarLiveInputRoute } from './guitar-live-input-observations'
import { createGuitarNightVoiceCommands } from './guitar-night-voice-commands'
import type { GuitarNightReference } from './reference-port'
import { useGuitarFreeFormPractice } from './useGuitarFreeFormPractice'
import type { GuitarListeningStatus } from './useGuitarListeningController'

const REFERENCE: GuitarNightReference = {
  kind: 'authored',
  songId: 'practice-song',
  title: 'Four notes',
  trackId: 'lead',
  trackName: 'Lead',
  tempoBpm: 60,
  tuning: DEFAULT_GUITAR_TUNING,
  outOfRangeNotes: 0,
  tracks: [{ id: 'lead', name: 'Lead', noteCount: 4 }],
  notes: [0, 1, 2, 3].map((startBeat) => ({
    id: `note-${startBeat}`,
    midi: 60 + startBeat,
    noteName: `note ${startBeat}`,
    stringIndex: 0,
    fret: startBeat,
    startBeat,
    duration: 1,
    targetFreq: 261.63,
  })),
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((accept) => {
    resolve = accept
  })
  return { promise, resolve }
}

async function flush() {
  for (let index = 0; index < 12; index++) await Promise.resolve()
}

const disposers: Array<() => void> = []

function harness() {
  return createRoot((dispose) => {
    disposers.push(dispose)
    const clock = { currentTime: 10, sampleRate: 1000 }
    const graph = { context: clock } as unknown as ReturnType<
      GuitarRoomBand['getAudioGraph']
    >
    const [reference, setReference] = createSignal<GuitarNightReference | null>(
      REFERENCE,
    )
    const [enabled, setEnabled] = createSignal(true)
    const [blocked, setBlocked] = createSignal(false)
    const [status, setStatus] = createSignal<GuitarListeningStatus>('listening')
    const [inputProfile, setInputProfile] =
      createSignal<GuitarInputProfileKind>('interface')
    const [take, setTake] = createSignal<GuitarTakeSnapshot | null>(null)
    const [liveInputRoute, setLiveInputRoute] =
      createSignal<GuitarLiveInputRoute | null>({
        generation: 1,
        source: 'interface',
        sampleRate: clock.sampleRate,
        startedAtSeconds: 0,
        currentTimeSeconds: () => clock.currentTime,
      })
    let recorder: GuitarTakeRecorder | null = null
    let takeSequence = 0
    let end = clock.currentTime
    let drainGate: ReturnType<
      typeof deferred<GuitarTakeSnapshot | null>
    > | null = null
    const listening: Parameters<
      typeof useGuitarFreeFormPractice
    >[0]['listening'] = {
      status,
      inputProfile,
      take,
      liveInputRoute,
      health: () => ({ state: 'good', hint: 'Good' }),
      recordableStream: () => null,
      recordableAudioContext: () => null,
      stop: vi.fn(),
      armTakeAt: vi.fn((startedAtSeconds) => {
        recorder = createGuitarTakeRecorder({
          takeId: `practice-take-${++takeSequence}`,
          startedAtSeconds,
          sampleRate: clock.sampleRate,
          input: {
            kind: untrack(inputProfile),
            requestedDeviceId: null,
            activeDeviceId: 'input',
            activeDeviceLabel: 'Input',
          },
          attackTimingSource: 'audio-clock',
          latency: { seconds: 0, provenance: 'none', uncertaintySeconds: null },
        })
        recorder.observeHealth('good')
        setTake(recorder.snapshot())
        return true
      }),
      completeTakeAt: vi.fn((at) => {
        if (recorder === null) return false
        end = at
        setTake(recorder.pinEnd(at))
        return true
      }),
      completeTakeNow: vi.fn(() => listening.completeTakeAt(clock.currentTime)),
      settleTake: vi.fn(() => {
        const current = untrack(take)
        if (recorder === null || current?.lifecycle !== 'recording')
          return Promise.resolve(current)
        listening.completeTakeNow()
        if (drainGate !== null) return drainGate.promise
        const completed = recorder.complete(end)
        setTake(completed)
        return Promise.resolve(completed)
      }),
    }
    let startOptions: GuitarRoomBandStartOptions | null = null
    let lateStart: ReturnType<
      typeof deferred<GuitarRoomBandStartResult>
    > | null = null
    let startResult: GuitarRoomBandStartResult | null = null
    const band: GuitarRoomBand = {
      start: vi.fn((next) => {
        startOptions = next
        const beatToSeconds = createBeatClock({
          bpm: next.tempoBpm,
          tempoChanges: next.tempoChanges,
        })
        startResult = {
          expectedHitTimesMs: [],
          exerciseStartedAtSeconds: clock.currentTime,
          completedAtSeconds:
            clock.currentTime +
            beatToSeconds(next.durationBeats ?? 4) -
            beatToSeconds(next.startBeat ?? 0),
        }
        return lateStart?.promise ?? Promise.resolve(startResult)
      }),
      activate: vi.fn(async () => graph),
      setMasterLevel: vi.fn(),
      setElectricAmpParameters: vi.fn(),
      setMelodyChannelLevel: vi.fn(),
      setPercussionTrackAudible: vi.fn(),
      stop: vi.fn(),
      getAudioGraph: () => graph,
      dispose: vi.fn(async () => undefined),
    }
    const activateGraph = vi.fn(async () => null)
    const onListeningRequired = vi.fn()
    const practice = useGuitarFreeFormPractice({
      reference,
      enabled,
      blocked,
      listening,
      amp: () => DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS,
      activateGraph,
      onListeningRequired,
      createBand: () => band,
    })
    const attack = (beat: number, midi = 60 + beat) => {
      const boundary = practice.liveScore.boundary()
      if (recorder === null || boundary === null)
        throw new Error('Practice not armed')
      const at =
        boundary.startedAtSeconds +
        boundary.beatToSeconds(beat) -
        boundary.beatToSeconds(boundary.range.start)
      recorder.append({
        kind: 'attack',
        source: inputProfile(),
        voiceId: null,
        level: 0.4,
        pitch: { midi, noteName: `note ${beat}`, cents: 0, clarity: 0.99 },
        clock: {
          kind: 'audio-worklet',
          atFrame: Math.round(at * clock.sampleRate),
          sampleRate: clock.sampleRate,
        },
      })
      setTake(recorder.snapshot())
    }
    return {
      practice,
      onListeningRequired,
      band,
      listening,
      clock,
      reference,
      setReference,
      setEnabled,
      setBlocked,
      setStatus,
      setInputProfile,
      setLiveInputRoute,
      take,
      activateGraph,
      attack,
      dispose,
      startPlaying: () =>
        startOptions?.onExerciseStart?.(
          startOptions.startBeat ?? 0,
          startResult?.exerciseStartedAtSeconds ?? 10,
        ),
      getStartOptions: () => startOptions,
      delayStart: () => {
        lateStart = deferred<GuitarRoomBandStartResult>()
      },
      releaseStart: () => {
        if (startResult !== null) lateStart?.resolve(startResult)
        lateStart = null
      },
      delayDrain: () => {
        drainGate = deferred<GuitarTakeSnapshot | null>()
      },
      releaseDrain: () => {
        const completed = recorder?.complete(end) ?? null
        setTake(completed)
        drainGate?.resolve(completed)
        drainGate = null
      },
    }
  })
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('useGuitarFreeFormPractice', () => {
  it('selects and configures a source without opening audio or taking ownership of input', async () => {
    const h = harness()
    h.setEnabled(false)
    h.setReference({ ...REFERENCE, title: 'Selected revision' })
    await flush()
    h.setEnabled(true)
    await h.practice.setTempo(80)
    h.practice.seekBeat(1.25)
    await flush()
    expect(h.practice.room.playheadBeat()).toBe(1.25)
    expect(h.band.start).not.toHaveBeenCalled()
    expect(h.band.activate).not.toHaveBeenCalled()
    expect(h.activateGraph).not.toHaveBeenCalled()
    expect(h.listening.armTakeAt).not.toHaveBeenCalled()
    expect(h.listening.stop).not.toHaveBeenCalled()
  })

  it('requires Listening and rejects blocked or disabled admission', async () => {
    const h = harness()
    h.setStatus('off')
    await h.practice.play()
    expect(h.practice.notice()).toMatch(/Turn on Listening/)
    expect(h.onListeningRequired).toHaveBeenCalledOnce()
    expect(h.listening.armTakeAt).not.toHaveBeenCalled()
    expect(h.band.activate).not.toHaveBeenCalled()
    h.setStatus('listening')
    h.setBlocked(true)
    await h.practice.play()
    h.setBlocked(false)
    h.setEnabled(false)
    await h.practice.play()
    expect(h.band.start).not.toHaveBeenCalled()
    expect(h.listening.stop).not.toHaveBeenCalled()
    expect(h.onListeningRequired).toHaveBeenCalledOnce()
  })

  it('does not start later just because Listening becomes available after a blocked Play', async () => {
    const h = harness()
    h.setStatus('off')
    await h.practice.toggle()
    expect(h.onListeningRequired).toHaveBeenCalledOnce()
    h.setStatus('listening')
    await flush()
    expect(h.band.start).not.toHaveBeenCalled()
    await h.practice.play()
    expect(h.band.start).toHaveBeenCalledOnce()
    expect(h.practice.notice()).toBeNull()
  })

  it('waits for cancelled asynchronous admission before admitting Record', async () => {
    const h = harness()
    h.delayStart()
    const play = h.practice.play()
    let recordAdmitted = false
    const transition = h.practice.settle().then(() => {
      recordAdmitted = true
    })
    await flush()
    expect(h.practice.busy()).toBe(true)
    expect(recordAdmitted).toBe(false)
    await h.practice.play()
    expect(h.band.start).toHaveBeenCalledOnce()
    h.releaseStart()
    await Promise.all([play, transition])
    expect(recordAdmitted).toBe(true)
    expect(h.listening.armTakeAt).not.toHaveBeenCalled()
    expect(h.listening.settleTake).not.toHaveBeenCalled()
    expect(h.practice.pending()).toBe(false)
    expect(h.practice.running()).toBe(false)
  })

  it.each(['source', 'mode', 'route', 'unmount'] as const)(
    'rejects a late start after %s invalidation',
    async (change) => {
      const h = harness()
      h.delayStart()
      const play = h.practice.play()
      if (change === 'source') h.setReference({ ...REFERENCE, songId: 'other' })
      if (change === 'mode') h.setEnabled(false)
      if (change === 'route')
        h.setLiveInputRoute({
          generation: 2,
          source: 'interface',
          sampleRate: 1000,
          startedAtSeconds: 10,
          currentTimeSeconds: () => 10,
        })
      if (change === 'unmount') h.dispose()
      await flush()
      h.releaseStart()
      await play
      await flush()
      expect(h.listening.armTakeAt).not.toHaveBeenCalled()
      expect(h.listening.stop).not.toHaveBeenCalled()
    },
  )

  it('preserves the previous result while a replacement start is cancelled', async () => {
    const h = harness()
    await h.practice.play()
    h.startPlaying()
    h.attack(0)
    h.clock.currentTime = 10.8
    await h.practice.settle()
    const display = h.practice.liveScore.display()
    expect(display?.phase).toBe('completed')
    h.delayStart()
    const play = h.practice.play()
    h.practice.cancelStart()
    h.releaseStart()
    await play
    expect(h.practice.liveScore.display()).toBe(display)
    expect(h.listening.armTakeAt).toHaveBeenCalledOnce()
  })

  it('drains final evidence once before Record and keeps the retained DI route alive', async () => {
    const h = harness()
    await h.practice.play()
    h.startPlaying()
    h.clock.currentTime = 10.8
    h.delayDrain()
    const first = h.practice.settle()
    const second = h.practice.settle()
    expect(first).toBe(second)
    expect(h.practice.liveScore.finishing()).toBe(true)
    expect(h.practice.running()).toBe(false)
    h.attack(0)
    h.releaseDrain()
    await first
    expect(h.practice.liveScore.display()?.totals.hitTargets).toBe(1)
    expect(h.practice.liveScore.display()?.phase).toBe('completed')
    expect(h.listening.settleTake).toHaveBeenCalledOnce()
    expect(h.listening.status()).toBe('listening')
    expect(h.listening.stop).not.toHaveBeenCalled()
  })

  it('distinguishes Pause from Finish and upgrades an in-flight pause without repinning its end', async () => {
    const h = harness()
    await h.practice.play()
    h.startPlaying()
    h.attack(0)
    h.clock.currentTime = 10.8
    h.delayDrain()
    const pause = h.practice.pause()
    expect(h.practice.liveScore.state()).toBe('paused')
    h.clock.currentTime = 12
    const finish = h.practice.settle()
    expect(finish).toBe(pause)
    expect(h.listening.completeTakeNow).toHaveBeenCalledOnce()
    h.releaseDrain()
    await finish
    expect(h.take()?.durationFrames).toBe(800)
    expect(h.practice.liveScore.display()?.phase).toBe('completed')
    expect(h.practice.liveScore.display()?.totals.judgedTargets).toBe(1)
  })

  it('commits the latest rapid seeks and both markers through one evidence drain', async () => {
    const h = harness()
    await h.practice.play()
    h.startPlaying()
    h.clock.currentTime = 10.5
    h.delayDrain()
    h.practice.seekBeat(0.5)
    h.practice.seekBeat(1)
    h.practice.changeMark('A', 0.5)
    h.practice.changeMark('B', 3.5)
    h.practice.changeMark('A', 0.75)
    h.practice.seekBeat(2.25)
    expect(h.listening.settleTake).toHaveBeenCalledOnce()
    h.releaseDrain()
    await flush()
    expect(h.practice.room.playheadBeat()).toBe(2.25)
    expect(h.practice.loop.span()).toEqual({ start: 0.75, end: 3.5 })
    expect(h.practice.liveScore.state()).toBe('paused')
    expect(h.band.start).toHaveBeenCalledOnce()
    expect(h.practice.busy()).toBe(false)
  })

  it('drops pending configuration on a source or mode change', async () => {
    const h = harness()
    await h.practice.play()
    h.startPlaying()
    h.clock.currentTime = 10.5
    h.delayDrain()
    h.practice.seekBeat(3)
    h.practice.changeMark('A', 2)
    h.setReference({ ...REFERENCE, songId: 'replacement' })
    h.releaseDrain()
    await flush()
    expect(h.practice.room.playheadBeat()).toBeNull()
    expect(h.practice.loop.span()).toBeNull()
    expect(h.practice.liveScore.boundary()).toBeNull()
    expect(h.practice.busy()).toBe(false)
    expect(h.band.start).toHaveBeenCalledOnce()
  })

  it('asks before audible Room mic Practice and supports mute, continue, and cancellation', async () => {
    const h = harness()
    h.setInputProfile('microphone')
    h.practice.room.setMasterVolume(1)
    h.practice.room.setHearScore(true)
    h.practice.room.setHearClick(true)
    await h.practice.play()
    expect(h.practice.consentOpen()).toBe(true)
    expect(h.band.start).not.toHaveBeenCalled()
    h.practice.cancelStart()
    await h.practice.confirmMic(false)
    expect(h.band.start).not.toHaveBeenCalled()
    await h.practice.play()
    await h.practice.confirmMic(true)
    expect(h.practice.room.hearScore()).toBe(false)
    expect(h.practice.room.hearClick()).toBe(false)
    expect(h.band.start).toHaveBeenCalledOnce()
    h.clock.currentTime = 10.5
    await h.practice.settle()
    h.practice.room.setHearScore(true)
    await h.practice.play()
    await h.practice.confirmMic(false)
    expect(h.practice.room.hearScore()).toBe(true)
    expect(h.band.start).toHaveBeenCalledTimes(2)
  })

  it('invalidates Room mic consent on source, route, or mode changes', async () => {
    const h = harness()
    h.setInputProfile('microphone')
    h.practice.room.setMasterVolume(1)
    h.practice.room.setHearScore(true)
    await h.practice.play()
    h.setReference({ ...REFERENCE, songId: 'replacement' })
    await flush()
    await h.practice.confirmMic(true)
    expect(h.practice.room.hearScore()).toBe(true)
    await h.practice.play()
    h.setLiveInputRoute(null)
    await h.practice.confirmMic(false)
    h.setEnabled(false)
    await h.practice.confirmMic(false)
    expect(h.band.start).not.toHaveBeenCalled()
  })

  it('locks play and configuration while an immutable take is being saved', async () => {
    const h = harness()
    vi.spyOn(h.practice.capture, 'state').mockReturnValue('saving')
    const initialTempo = h.practice.room.tempoBpm()
    expect(h.practice.busy()).toBe(true)
    await h.practice.play()
    await h.practice.setTempo(100)
    h.practice.seekBeat(2)
    h.practice.changeMark('A', 1)
    await flush()
    expect(h.band.start).not.toHaveBeenCalled()
    expect(h.practice.room.tempoBpm()).toBe(initialTempo)
    expect(h.practice.loop.markA()).toBeNull()
    expect(h.listening.settleTake).not.toHaveBeenCalled()
  })

  it('retimes the guide and real score clock together without editing accepted note targets', async () => {
    const h = harness()
    const reference = {
      ...REFERENCE,
      tempoBpm: 120,
      tempoChanges: [
        { beat: 0, usPerBeat: 500000 },
        { beat: 2, usPerBeat: 1000000 },
      ],
    }
    h.setReference(reference)
    await flush()
    await h.practice.setTempo(60)
    await h.practice.setCountIn(0)
    await h.practice.play()
    const boundary = h.practice.liveScore.boundary()
    expect(boundary?.tempoBpm).toBe(60)
    expect(boundary?.scoreTempoBpm).toBe(120)
    expect(boundary?.beatToSeconds(3)).toBe(4)
    expect(h.getStartOptions()?.tempoChanges).toEqual([
      { beat: 0, usPerBeat: 1000000 },
      { beat: 2, usPerBeat: 2000000 },
    ])
    expect(boundary?.reference.notes).toEqual(REFERENCE.notes)
    expect(h.reference()).toBe(reference)
    expect(reference.tempoBpm).toBe(120)
    h.startPlaying()
    for (const beat of [0, 1, 2, 3]) h.attack(beat)
    h.clock.currentTime = 16
    await h.practice.settle()
    expect(h.practice.liveScore.display()?.totals.hitTargets).toBe(4)
    expect(h.practice.liveScore.score()).toBe(100)
  })

  it('replays an explicit result range through the same Room mic consent path', async () => {
    const h = harness()
    await h.practice.play({ start: 1, end: 3 })
    h.startPlaying()
    h.clock.currentTime = 10.5
    await h.practice.settle()
    h.setInputProfile('microphone')
    h.practice.room.setMasterVolume(1)
    h.practice.room.setHearScore(true)
    await h.practice.play({ start: 1, end: 3 })
    expect(h.practice.consentOpen()).toBe(true)
    expect(h.band.start).toHaveBeenCalledOnce()
    await h.practice.confirmMic(false)
    expect(h.practice.liveScore.boundary()?.range).toEqual({ start: 1, end: 3 })
    expect(h.getStartOptions()?.startBeat).toBe(1)
    expect(h.getStartOptions()?.durationBeats).toBe(3)
    expect(h.band.start).toHaveBeenCalledTimes(2)
  })

  it('leaves the previous score usable after failed audio admission', async () => {
    const h = harness()
    await h.practice.play()
    h.startPlaying()
    h.attack(0)
    h.clock.currentTime = 10.8
    await h.practice.settle()
    const display = h.practice.liveScore.display()
    vi.mocked(h.band.start).mockRejectedValueOnce(
      new Error('Audio unavailable'),
    )
    await h.practice.play()
    expect(h.practice.liveScore.display()).toBe(display)
    expect(h.practice.notice()).toMatch(/audio/)
    expect(h.practice.busy()).toBe(false)
    expect(h.listening.armTakeAt).toHaveBeenCalledOnce()
  })

  it('runs the actual voice restart command after the Practice seek evidence barrier', async () => {
    const h = harness()
    await h.practice.play()
    h.startPlaying()
    h.clock.currentTime = 10.8
    h.delayDrain()
    const restart = vi.fn(async () => {
      await h.practice.seekBeat(0)
      await h.practice.play()
    })
    const commands = createGuitarNightVoiceCommands({
      playing: h.practice.running,
      pending: h.practice.pending,
      positionSeconds: h.practice.room.displayPositionSeconds,
      durationSeconds: h.practice.room.durationSeconds,
      play: () => {
        void h.practice.play()
      },
      pause: () => {
        void h.practice.pause()
      },
      stop: () => {
        void h.practice.settle()
      },
      seek: (seconds) => {
        void h.practice.seekSeconds(seconds)
      },
      restart,
      playbackRate: () => 1,
      setPlaybackRate: () => undefined,
      tracks: () => [],
      setTrackMuted: () => undefined,
    })
    const command = commands.find((item) => item.id === 'guitarNight.restart')
    expect(command?.run({})).toBe('From the top')
    expect(h.band.start).toHaveBeenCalledOnce()
    expect(h.practice.busy()).toBe(true)
    h.releaseDrain()
    await restart.mock.results[0]?.value
    expect(h.band.start).toHaveBeenCalledTimes(2)
    expect(h.listening.armTakeAt).toHaveBeenCalledTimes(2)
    expect(h.practice.liveScore.boundary()?.range.start).toBe(0)
    expect(h.listening.stop).not.toHaveBeenCalled()
  })
})
