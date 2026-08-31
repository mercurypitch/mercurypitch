// ============================================================
// useTakeReviewController unit tests
// ============================================================

import { createRoot, createSignal } from 'solid-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { midiFloatToFreq } from '@/lib/pitch-pipeline/log-pitch'
import type { RawPitchFrame } from '@/lib/pitch-pipeline/offline-segment'
import type { MelodyItem } from '@/types'
import type { PendingTake } from './useRecordingController'
import { useTakeReviewController } from './useTakeReviewController'

function hold(
  midi: number | null,
  n: number,
  startIdx: number,
): RawPitchFrame[] {
  return Array.from({ length: n }, (_, k) => {
    const i = startIdx + k
    return {
      beat: i * 0.02,
      timeSec: i * 0.01,
      freq: midi === null ? null : midiFloatToFreq(midi),
      clarity: midi === null ? 0 : 0.9,
    }
  })
}

describe('useTakeReviewController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('computes liveRecordingMelody with provisionalNote while recording', () => {
    createRoot((dispose) => {
      const [isRecording, setIsRecording] = createSignal(false)
      const [recordedMelody, setRecordedMelody] = createSignal<MelodyItem[]>([])
      const [provisionalNote, setProvisionalNote] = createSignal<{
        midi: number
        startBeat: number
      } | null>(null)
      const [currentBeat, setCurrentBeat] = createSignal(0)
      const commitTakeMock = vi.fn()

      const controller = useTakeReviewController({
        recording: {
          isRecording,
          recordedMelody,
          provisionalNote,
          pendingTake: () => null,
          commitTake: commitTakeMock,
        },
        currentBeat,
        bpm: () => 120,
        keyName: () => 'C',
        scaleType: () => 'major',
        totalBeats: () => 16,
      })

      // When idle, empty liveRecordingMelody and previewMelody
      expect(controller.liveRecordingMelody()).toEqual([])
      expect(controller.previewMelody()).toEqual([])

      // Start recording with 1 recorded note and 1 provisional note
      setIsRecording(true)
      const initialItem: MelodyItem = {
        id: 1,
        note: { midi: 60, name: 'C', octave: 4, freq: 261.63 },
        startBeat: 0,
        duration: 1,
        velocity: 100,
      }
      setRecordedMelody([initialItem])
      setProvisionalNote({ midi: 64, startBeat: 2 })
      setCurrentBeat(3.5)

      const live = controller.liveRecordingMelody()
      expect(live.length).toBe(2)
      expect(live[0]).toEqual(initialItem)
      expect(live[1].note.midi).toBe(64)
      expect(live[1].startBeat).toBe(2)
      expect(live[1].duration).toBeCloseTo(1.5)
      expect(controller.previewMelody()).toEqual(live)

      dispose()
    })
  })

  it('handles take review segmentation, nudge timing, and commit', async () => {
    await new Promise<void>((resolve) => {
      createRoot(async (dispose) => {
        const [pendingTake, setPendingTake] = createSignal<PendingTake | null>(
          null,
        )
        const commitTakeMock = vi.fn()

        const controller = useTakeReviewController({
          recording: {
            isRecording: () => false,
            recordedMelody: () => [],
            provisionalNote: () => null,
            pendingTake,
            commitTake: commitTakeMock,
          },
          currentBeat: () => 0,
          bpm: () => 120,
          keyName: () => 'C',
          scaleType: () => 'major',
          totalBeats: () => 16,
        })

        // Set pending take with realistic frames
        const frames = [...hold(60, 40, 0), ...hold(null, 12, 40)]
        const sampleTake: PendingTake = {
          frames,
          endBeat: 4,
        }

        controller.setReviewNudgeMs(50)
        controller.setReviewAmount(0.8)

        setPendingTake(sampleTake)
        await new Promise((r) => setTimeout(r, 0))

        // When a new pending take arrives, nudgeMs resets to 0
        expect(controller.reviewNudgeMs()).toBe(0)
        expect(controller.reviewAmount()).toBe(0.8)

        // Review melody should segment frames
        const reviewed = controller.reviewMelody()
        expect(reviewed.length).toBeGreaterThan(0)
        expect(controller.previewMelody()).toEqual(reviewed)

        // Commit take
        controller.commitTake()
        expect(commitTakeMock).toHaveBeenCalledWith(reviewed)

        dispose()
        resolve()
      })
    })
  })

  it('dynamically computes composeTotalBeats during recording and review', () => {
    createRoot((dispose) => {
      const [isRecording, setIsRecording] = createSignal(false)
      const [pendingTake, setPendingTake] = createSignal<PendingTake | null>(
        null,
      )
      const [currentBeat, setCurrentBeat] = createSignal(0)

      const controller = useTakeReviewController({
        recording: {
          isRecording,
          recordedMelody: () => [],
          provisionalNote: () => null,
          pendingTake,
          commitTake: vi.fn(),
        },
        currentBeat,
        bpm: () => 120,
        keyName: () => 'C',
        scaleType: () => 'major',
        totalBeats: () => 16,
      })

      // Idle baseline
      expect(controller.composeTotalBeats()).toBe(16)

      // Recording past 16 beats grows the grid
      setIsRecording(true)
      setCurrentBeat(20)
      // (floor((20 + 8) / 4) + 1) * 4 = 8 * 4 = 32
      expect(controller.composeTotalBeats()).toBe(32)

      // Stop recording, enter review with endBeat = 26
      setIsRecording(false)
      setPendingTake({
        frames: [],
        endBeat: 26,
      })
      // ceil((26 + 4) / 4) * 4 = ceil(30/4)*4 = 8*4 = 32
      expect(controller.composeTotalBeats()).toBe(32)

      dispose()
    })
  })
})
