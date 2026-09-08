// Live stage lifecycle tests use the real collector and fake only the input/animation browser boundary.
import { createRoot, createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_GUITAR_TUNING } from '@/lib/guitar/instrument-tuning'
import type { GuitarLiveInputObservation, GuitarLiveInputRoute, } from './guitar-live-input-observations'
import { createGuitarLiveInputObservations } from './guitar-live-input-observations'
import { useGuitarLiveHistoryStage } from './useGuitarLiveHistoryStage'

afterEach(() => vi.restoreAllMocks())

function harness() {
  let clock = 100
  let route: GuitarLiveInputRoute | null = null
  const observers = new Set<(observation: GuitarLiveInputObservation) => void>()
  const callbacks = new Map<number, FrameRequestCallback>()
  let sequence = 0
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    callbacks.set(++sequence, callback)
    return sequence
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    callbacks.delete(id)
  })
  const emit = (observation: GuitarLiveInputObservation) => {
    for (const observer of observers) observer(observation)
  }
  return {
    callbacks,
    observers,
    port: {
      liveInputRoute: () => route,
      subscribeLiveObservations(
        observer: (observation: GuitarLiveInputObservation) => void,
      ) {
        observers.add(observer)
        if (route !== null) observer({ type: 'route-start', route })
        return () => {
          observers.delete(observer)
        }
      },
    },
    start() {
      route = {
        generation: 1,
        startedAtSeconds: 100,
        sampleRate: 48000,
        source: 'interface',
        currentTimeSeconds: () => clock,
      }
      emit({ type: 'route-start', route })
    },
    stop() {
      route = null
      emit({ type: 'route-end', generation: 1, atSeconds: clock })
    },
    pitch(at: number, midi: number | null) {
      clock = at + 100.04
      emit({
        type: 'pitch',
        generation: 1,
        sampleRate: 48000,
        windowStartAtSeconds: at + 100,
        observedAtSeconds: clock,
        pitch:
          midi === null
            ? null
            : { midi, noteName: 'test', clarity: 0.9, cents: 0 },
      })
    },
    frame(at: number) {
      clock = at + 100
      const pending = [...callbacks.values()]
      callbacks.clear()
      for (const callback of pending) callback(999999)
    },
  }
}

describe('listening-only live stage', () => {
  it('consumes the real observation boundary without a second latency offset or take-owned identity', () =>
    createRoot((dispose) => {
      const bus = createGuitarLiveInputObservations()
      const context = { currentTime: 100, sampleRate: 48000 }
      const stage = useGuitarLiveHistoryStage({
        enabled: () => false,
        tuning: () => DEFAULT_GUITAR_TUNING,
        listening: {
          liveInputRoute: bus.route,
          subscribeLiveObservations: bus.subscribe,
        },
      })
      bus.start(context as AudioContext, 'interface')
      context.currentTime = 100.14
      bus.capture({
        kind: 'attack',
        source: 'interface',
        voiceId: null,
        level: 0.5,
        pitch: null,
        clock: { kind: 'audio-worklet', atFrame: 4804800, sampleRate: 48000 },
      })
      const pitch = { midi: 64, noteName: 'E4', clarity: 0.9, cents: 0 }
      // Assessment may call this legato because its future take excludes the
      // strike; Live still owns that earlier raw strike and must enrich it.
      bus.capture({
        kind: 'pitch-change',
        source: 'interface',
        voiceId: null,
        level: 0.5,
        pitch,
        clock: {
          kind: 'frame-loop',
          observedAt: 100.14,
          windowStartAt: 100.1,
          sampleRate: 48000,
          windowFrames: 1920,
        },
      })
      bus.pitch(100.14, 100.1, pitch)

      expect(stage.source.notes()).toHaveLength(1)
      expect(stage.source.notes()[0].id).toBe('live-1-1')
      expect(stage.source.notes()[0].startBeat).toBeCloseTo(0.2)
      expect(stage.source.timeline.positionSeconds()).toBeCloseTo(0.14)
      context.currentTime = 101
      bus.reset()
      bus.pitch(101.02, 100.98, pitch)
      expect(stage.source.notes()).toEqual([])
      bus.end()
      expect(stage.active()).toBe(false)
      dispose()
      bus.dispose()
    }))

  it('stays inert with input off and shows the first stabilized pitch immediately on the raw route clock', () =>
    createRoot(async (dispose) => {
      const input = harness()
      const stage = useGuitarLiveHistoryStage({
        enabled: () => true,
        tuning: () => DEFAULT_GUITAR_TUNING,
        listening: input.port,
      })
      await Promise.resolve()
      expect(stage.active()).toBe(false)
      expect(input.callbacks.size).toBe(0)
      expect(stage.source.notes()).toEqual([])

      input.start()
      input.pitch(1.123, 64)

      expect(stage.source.recordingHistory?.()).toBe(true)
      expect(stage.source.historyKind?.()).toBe('live')
      expect(stage.source.notes()[0]).toMatchObject({
        midi: 64,
        stringIndex: 0,
        fret: 0,
      })
      expect(stage.source.notes()[0].startBeat).toBeCloseTo(2.246)
      expect(stage.source.timeline.playheadBeat()).toBeCloseTo(2.326)
      expect(input.callbacks.size).toBe(1)
      dispose()
      expect(input.observers.size).toBe(0)
      expect(input.callbacks.size).toBe(0)
    }))

  it('keeps bounded observation while hidden but retires its visual clock without changing input', () =>
    createRoot(async (dispose) => {
      const input = harness()
      input.start()
      const [enabled, setEnabled] = createSignal(true)
      const stage = useGuitarLiveHistoryStage({
        enabled,
        tuning: () => DEFAULT_GUITAR_TUNING,
        listening: input.port,
      })
      await Promise.resolve()
      input.pitch(1, 64)
      input.frame(1.1)
      expect(stage.source.timeline.positionSeconds()).toBeCloseTo(1.1)
      expect(input.callbacks.size).toBe(1)

      setEnabled(false)
      expect(input.callbacks.size).toBe(0)
      input.pitch(1.2, 66)
      expect(stage.source.notes().map((note) => note.midi)).toEqual([64, 66])
      expect(stage.active()).toBe(true)
      expect(input.observers.size).toBe(1)
      setEnabled(true)
      input.frame(1.3)
      expect(stage.source.timeline.positionSeconds()).toBeCloseTo(1.3)
      expect(input.callbacks.size).toBe(1)
      input.stop()
      expect(input.callbacks.size).toBe(0)
      expect(stage.active()).toBe(false)
      dispose()
    }))

  it('uses the current tuning without inventing playable octaves for unsupported notes', () =>
    createRoot(async (dispose) => {
      const input = harness()
      input.start()
      const [tuning, setTuning] = createSignal(DEFAULT_GUITAR_TUNING)
      const stage = useGuitarLiveHistoryStage({
        enabled: () => false,
        tuning,
        listening: input.port,
      })
      await Promise.resolve()
      input.pitch(1, 64)
      input.pitch(1.2, 127)
      expect(stage.noteCount()).toBe(1)
      expect(stage.unmappedCount()).toBe(1)

      setTuning({ ...DEFAULT_GUITAR_TUNING, capo: 2 })

      expect(stage.source.notes()[0]).toMatchObject({
        midi: 64,
        stringIndex: 1,
        fret: 3,
      })
      expect(stage.unmappedCount()).toBe(1)
      expect(input.callbacks.size).toBe(0)
      dispose()
    }))

  it('keeps sustain history bounded while visible without feeding rendering timestamps into note evidence', () =>
    createRoot(async (dispose) => {
      const input = harness()
      input.start()
      const stage = useGuitarLiveHistoryStage({
        enabled: () => true,
        tuning: () => DEFAULT_GUITAR_TUNING,
        listening: input.port,
      })
      await Promise.resolve()
      input.pitch(1, 64)
      const note = stage.source.notes()[0]

      input.frame(1.5)

      expect(stage.source.timeline.positionSeconds()).toBe(1.5)
      expect(stage.source.notes()[0]).toEqual(note)
      input.frame(8)
      expect(stage.source.notes()).toEqual([])
      dispose()
    }))
})
