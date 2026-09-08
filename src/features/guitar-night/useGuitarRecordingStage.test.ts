// Live draft projection preserves free-time frames and never promotes preview notes into a practice target.
import { createRoot, createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_GUITAR_TUNING } from '@/lib/guitar/instrument-tuning'
import type { GuitarPracticeScore, GuitarRecording, } from '@/lib/guitar/recording-types'
import { useGuitarRecordingStage } from './useGuitarRecordingStage'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})
describe('recording stage projection', () => {
  it('bounds live projection work while preserving long sustains and all stopped evidence', () =>
    createRoot((dispose) => {
      const [busy, setBusy] = createSignal(true)
      const notes = Array.from({ length: 3000 }, (_, index) => ({
        id: `note-${index}`,
        midi: 64,
        startFrame: index * 4800,
        endFrame: index * 4800 + 4000,
        clarity: 0.9,
        onset: 'attack' as const,
      }))
      notes.push({ ...notes[0], id: 'sustain', endFrame: 300 * 48000 })
      const stage = useGuitarRecordingStage(
        {
          busy,
          state: () => 'idle',
          captureSeconds: () => 300,
          duration: () => 300,
          previewRecording: () =>
            ({ sampleRate: 48000, frames: 300 * 48000 }) as GuitarRecording,
          previewScore: () => null,
          previewNotes: () => notes,
        },
        () => DEFAULT_GUITAR_TUNING,
      )
      expect(stage.source.notes()).toHaveLength(61)
      expect(stage.source.notes().at(-1)?.id).toBe('sustain')
      expect(notes).toHaveLength(3001)
      setBusy(false)
      expect(stage.source.notes()).toHaveLength(3001)
      dispose()
    }))
  it('keeps capture time intact and switches from history to dry replay without accepting a score', () =>
    createRoot((dispose) => {
      const [engaged, setEngaged] = createSignal(false)
      const [position, setPosition] = createSignal(0)
      const stage = useGuitarRecordingStage(
        {
          state: () => 'idle',
          busy: () => false,
          duration: () => 10,
          captureSeconds: () => 10,
          previewRecording: () =>
            ({
              id: 'take',
              frames: 480000,
              sampleRate: 48000,
            }) as GuitarRecording,
          previewNotes: () => [],
          previewScore: () => null,
        },
        () => DEFAULT_GUITAR_TUNING,
        { engaged, position },
      )
      expect(stage.source.timeline.positionSeconds()).toBe(10)
      expect(stage.source.recordingHistory?.()).toBe(true)
      setEngaged(true)
      expect(stage.source.recordingHistory?.()).toBe(false)
      expect(stage.source.timeline.playheadBeat()).toBe(0)
      setPosition(1.25)
      expect(stage.source.timeline.playheadBeat()).toBe(2.5)
      expect(stage.source.timeline.durationSeconds()).toBe(10)
      dispose()
    }))
  it('moves between durable chunks on the capture clock and retires the visual loop', () =>
    createRoot(async (dispose) => {
      const callbacks = new Map<number, FrameRequestCallback>()
      let next = 0
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
        (callback) => {
          callbacks.set(++next, callback)
          return next
        },
      )
      vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
        callbacks.delete(id)
      })
      const frame = () => {
        const pending = [...callbacks.values()]
        callbacks.clear()
        for (const callback of pending) callback(0)
      }
      const [state, setState] = createSignal<'idle' | 'recording'>('idle')
      let captured = 5
      const stage = useGuitarRecordingStage(
        {
          state,
          busy: () => state() !== 'idle',
          duration: () => 4.95,
          captureSeconds: () => captured,
          previewRecording: () =>
            ({
              id: 'take',
              frames: 240000,
              sampleRate: 48000,
            }) as GuitarRecording,
          previewNotes: () => [],
          previewScore: () => null,
        },
        () => DEFAULT_GUITAR_TUNING,
      )
      await Promise.resolve()
      expect(callbacks.size).toBe(0)
      setState('recording')
      frame()
      expect(stage.source.timeline.positionSeconds()).toBe(5)
      captured = 5.02
      frame()
      expect(stage.source.timeline.positionSeconds()).toBeCloseTo(5.02)
      captured = 5.04
      frame()
      expect(stage.source.timeline.positionSeconds()).toBeCloseTo(5.04)
      stage.setShowLiveNotes(false)
      expect(callbacks.size).toBe(0)
      stage.setShowLiveNotes(true)
      expect(callbacks.size).toBe(1)
      setState('idle')
      expect(callbacks.size).toBe(0)
      expect(stage.source.timeline.positionSeconds()).toBe(5)
      setState('recording')
      expect(callbacks.size).toBe(1)
      dispose()
      expect(callbacks.size).toBe(0)
    }))
  it('previews corrections only for the stopped current take, preserving seconds and chosen fingering', () =>
    createRoot(async (dispose) => {
      const [busy, setBusy] = createSignal(true)
      const [audition, setAudition] = createSignal(false)
      const [auditionSource, setAuditionSource] = createSignal<
        'recording' | 'notes'
      >('recording')
      const row = {
        id: 'current-take',
        sampleRate: 48000,
        frames: 528000,
        tuning: { ...DEFAULT_GUITAR_TUNING, capo: 2 },
      } as GuitarRecording
      const [score, setScore] = createSignal<GuitarPracticeScore | null>({
        id: 'correction',
        recordingId: row.id,
        title: 'Corrected melody',
        revision: 1,
        createdAt: '2026-09-07T00:00:00Z',
        updatedAt: '2026-09-07T00:00:00Z',
        bpm: 60,
        timeSignature: [4, 4],
        grid: 'chosen',
        tuning: [...DEFAULT_GUITAR_TUNING.openMidi],
        capo: 0,
        notes: [
          {
            id: 'corrected-note',
            evidenceId: 'raw-note',
            midi: 64,
            startBeat: 8.25,
            endBeat: 9.5,
            string: 2,
            fret: 5,
          },
        ],
        attachment: null,
      })
      const stage = useGuitarRecordingStage(
        {
          busy,
          state: () => (busy() ? 'recording' : 'idle'),
          captureSeconds: () => 11,
          duration: () => 11,
          previewRecording: () => row,
          previewScore: score,
          previewNotes: () => [
            {
              id: 'raw-note',
              midi: 42,
              startFrame: 396000,
              endFrame: 456000,
              clarity: 0.9,
              onset: 'attack',
            },
          ],
        },
        () => DEFAULT_GUITAR_TUNING,
        {
          engaged: audition,
          position: () => 1,
          source: auditionSource,
          duration: () => 13,
        },
      )
      await Promise.resolve()
      expect(stage.tuning().capo).toBe(2)
      expect(stage.source.notes()[0].midi).toBe(42)
      expect(stage.source.timeline.positionSeconds()).toBe(11)
      setBusy(false)
      expect(stage.tuning().capo).toBe(0)
      expect(stage.source.notes()).toEqual([
        expect.objectContaining({
          id: 'corrected-note',
          midi: 64,
          stringIndex: 1,
          fret: 5,
          startBeat: 16.5,
          duration: 2.5,
        }),
      ])
      setAudition(true)
      expect(stage.source.notes()[0].midi).toBe(42)
      expect(stage.source.timeline.durationSeconds()).toBe(13)
      setAuditionSource('notes')
      expect(stage.source.notes()[0].midi).toBe(64)
      setAudition(false)
      setScore((current) => ({ ...current!, recordingId: 'different-take' }))
      expect(stage.tuning().capo).toBe(2)
      expect(stage.source.notes()[0].midi).toBe(42)
      dispose()
    }))

  it('shows free timing, hides only the live projection, and retains a frozen take on Stop', () =>
    createRoot(async (dispose) => {
      const [busy, setBusy] = createSignal(true)
      const [row, setRow] = createSignal({
        sampleRate: 48000,
        frames: 96000,
        tuning: { ...DEFAULT_GUITAR_TUNING, capo: 2 },
      } as GuitarRecording | null)
      const notes = [
        {
          id: 'ok',
          midi: 42,
          startFrame: 12345,
          endFrame: 29000,
          clarity: 0.9,
          onset: 'attack' as const,
        },
        {
          id: 'low',
          midi: 28,
          startFrame: 36000,
          endFrame: 46000,
          clarity: 0.7,
          onset: 'pitch-change' as const,
        },
      ]
      const stage = useGuitarRecordingStage(
        {
          busy,
          state: () => (busy() ? 'recording' : 'idle'),
          captureSeconds: () => 2,
          duration: () => 2,
          previewRecording: row,
          previewNotes: () => notes,
          previewScore: () => null,
        },
        () => DEFAULT_GUITAR_TUNING,
      )
      await Promise.resolve()
      expect(stage.source.notes()).toEqual([
        expect.objectContaining({
          midi: 42,
          stringIndex: 5,
          fret: 0,
          startBeat: 12345 / 24000,
          duration: (29000 - 12345) / 24000,
        }),
      ])
      expect(stage.source.timeline.playheadBeat()).toBe(4)
      expect(stage.source.timeline.durationSeconds()).toBe(2)
      stage.setShowLiveNotes(false)
      expect(stage.source.notes()).toEqual([])
      expect(notes).toHaveLength(2)
      setBusy(false)
      expect(stage.source.notes()).toHaveLength(1)
      expect(stage.source.timeline.positionSeconds()).toBe(2)
      expect(stage.source.recordingHistory?.()).toBe(true)
      setRow(null)
      expect(stage.available()).toBe(false)
      expect(stage.source.notes()).toEqual([])
      dispose()
    }))
})
