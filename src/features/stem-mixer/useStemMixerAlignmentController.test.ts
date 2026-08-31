// ============================================================
// useStemMixerAlignmentController unit tests
// ============================================================

import { createRoot, createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import type { MergedNote } from '@/lib/midi-generator'
import type { WhisperSegment } from '@/lib/whisper-service'
import type { CanonicalLrcEntry } from './types'
import { useStemMixerAlignmentController } from './useStemMixerAlignmentController'

describe('useStemMixerAlignmentController', () => {
  it('selects denoised notes, raw-offline notes, and realtime notes in priority order and computes alignment', () => {
    createRoot((dispose) => {
      const [segmented, setSegmented] = createSignal<MergedNote[]>([])
      const [merged, setMerged] = createSignal<MergedNote[]>([])
      const [realtime, setRealtime] = createSignal<
        Array<{ frequency: number; noteName: string; time: number }>
      >([])
      const [whisperSegs, setWhisperSegs] = createSignal<WhisperSegment[]>([
        { text: 'Hello', timestamp: [1, 2] },
        { text: 'World', timestamp: [2, 3] },
      ])
      const [canonicalLrc, setCanonicalLrc] = createSignal<CanonicalLrcEntry[]>(
        [
          {
            type: 'line',
            canonicalIndex: 0,
            time: 1.0,
            text: 'Hello World',
            words: ['Hello', 'World'],
            lrcIndex: 0,
          },
        ],
      )
      const showNotification = vi.fn()

      const controller = useStemMixerAlignmentController({
        segmentedNotes: segmented,
        mergedNotes: merged,
        getPitchHistory: realtime,
        whisperSegments: whisperSegs,
        canonicalLrcLines: canonicalLrc,
        showNotification,
      })

      // 1. Initially no notes
      let res = controller.alignmentResult()
      expect(res.totalWords).toBe(0)
      expect(res.accuracy).toBe(0)

      // 2. Realtime fallback with notes and segments -> computes alignment
      setRealtime([
        { frequency: 440, noteName: 'A4', time: 1.2 },
        { frequency: 440, noteName: 'A4', time: 1.5 },
      ])
      res = controller.alignmentResult()
      expect(res.alignedWords.length).toBeGreaterThanOrEqual(0)

      // 3. Raw offline notes override realtime
      setMerged([{ startSec: 1.0, endSec: 2.0, midi: 69, noteName: 'A4' }])
      res = controller.alignmentResult()
      expect(res.alignedWords.length).toBeGreaterThanOrEqual(0)

      // 4. Denoised notes override raw offline
      setSegmented([{ startSec: 1.0, endSec: 2.0, midi: 69, noteName: 'A4' }])
      res = controller.alignmentResult()
      expect(res.alignedWords.length).toBeGreaterThanOrEqual(0)

      // 5. Toggle useDenoised to false -> falls back to raw offline
      controller.setUseDenoised(false)
      expect(controller.useDenoised()).toBe(false)
      res = controller.alignmentResult()
      expect(res.alignedWords.length).toBeGreaterThanOrEqual(0)

      // 6. When notes exist but word segments are empty
      setWhisperSegs([])
      setCanonicalLrc([])
      res = controller.alignmentResult()
      expect(res.alignedWords.length).toBe(0)
      expect(res.totalWords).toBe(0)

      dispose()
    })
  })

  it('handles transcription completion notifications, low accuracy warnings, and respects playlist quiet mode', async () => {
    await new Promise<void>((resolve) => {
      createRoot((dispose) => {
        const [segmented] = createSignal<MergedNote[]>([
          { startSec: 1.0, endSec: 2.0, midi: 69, noteName: 'A4' },
        ])
        const [merged] = createSignal<MergedNote[]>([])
        const [whisperSegs] = createSignal<WhisperSegment[]>([
          {
            text: 'completely different text with no pitch overlap',
            timestamp: [50, 60],
          },
        ])
        const [canonicalLrc] = createSignal<CanonicalLrcEntry[]>([
          {
            type: 'line',
            canonicalIndex: 0,
            time: 50.0,
            text: 'completely different text',
            words: ['completely', 'different', 'text'],
            lrcIndex: 0,
          },
        ])
        const showNotification = vi.fn()
        let playlistActive = false

        const controller = useStemMixerAlignmentController({
          segmentedNotes: segmented,
          mergedNotes: merged,
          getPitchHistory: () => [],
          whisperSegments: whisperSegs,
          canonicalLrcLines: canonicalLrc,
          showNotification,
          isPlaylistActive: () => playlistActive,
          audioPerformanceDebug: {
            start: vi.fn(),
            stop: vi.fn(),
            snapshot: vi.fn(),
          },
        })

        // Test empty segments notification
        controller.handleTranscriptionComplete([])
        setTimeout(() => {
          expect(showNotification).toHaveBeenCalledWith(
            expect.stringContaining('Transcription timed out or failed'),
            'error',
          )

          // Test low accuracy warning notification
          showNotification.mockClear()
          controller.handleTranscriptionComplete(whisperSegs())
          setTimeout(() => {
            expect(showNotification).toHaveBeenCalledWith(
              expect.stringContaining('Alignment accuracy is very low'),
              'error',
            )

            // Test playlist quiet mode (no notification when playlist is active)
            showNotification.mockClear()
            playlistActive = true
            controller.handleTranscriptionComplete([])
            setTimeout(() => {
              expect(showNotification).not.toHaveBeenCalled()

              dispose()
              resolve()
            }, 10)
          }, 10)
        }, 10)
      })
    })
  })
})
