// ============================================================
// usePracticeToolsController unit tests
// ============================================================

import { createRoot, createSignal } from 'solid-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as micFeedback from '@/features/mic-feedback/auto-calibrate'
import * as melodyStore from '@/stores/melody-store'
import * as notificationsStore from '@/stores/notifications-store'
import * as sessionHistoryStore from '@/stores/practice-session-store'
import type { MelodyData, MelodyItem, PracticeResult } from '@/types'
import { usePracticeToolsController } from './usePracticeToolsController'

describe('usePracticeToolsController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(notificationsStore, 'showNotification').mockImplementation(
      () => {},
    )
    vi.spyOn(micFeedback, 'autoCalibrateSensitivity').mockResolvedValue('home')
  })

  it('handles auto-calibration with mic inactive, active, and failed mic start', async () => {
    await new Promise<void>((resolve) => {
      createRoot(async (dispose) => {
        const [micActive, setMicActive] = createSignal(false)
        const startMicMock = vi.fn().mockResolvedValue(false)
        const getInputLevelMock = vi.fn().mockReturnValue(0.7)

        const controller = usePracticeToolsController({
          practiceEngine: {
            startMic: startMicMock,
            getInputLevel: getInputLevelMock,
          },
          micActive,
          currentNoteIndex: () => -1,
          setKeyName: vi.fn(),
          setScaleType: vi.fn(),
          practiceResult: () => null,
          setPracticeResult: vi.fn(),
          setLiveScore: vi.fn(),
        })

        // 1. Mic inactive and fails to start
        await controller.handleAutoCalibrate()
        expect(startMicMock).toHaveBeenCalled()
        expect(notificationsStore.showNotification).toHaveBeenCalledWith(
          'Enable your mic to auto-calibrate.',
          'warning',
        )

        // 2. Mic inactive and succeeds in starting
        startMicMock.mockResolvedValueOnce(true)
        await controller.handleAutoCalibrate()
        expect(micFeedback.autoCalibrateSensitivity).toHaveBeenCalled()

        // 3. Mic already active
        setMicActive(true)
        startMicMock.mockClear()
        await controller.handleAutoCalibrate()
        expect(startMicMock).not.toHaveBeenCalled()
        expect(micFeedback.autoCalibrateSensitivity).toHaveBeenCalledTimes(2)

        dispose()
        resolve()
      })
    })
  })

  it('handles octave shifting and key/scale mirror effect', async () => {
    await new Promise<void>((resolve) => {
      createRoot(async (dispose) => {
        const shiftSpy = vi
          .spyOn(melodyStore, 'shiftMelodyOctave')
          .mockReturnValue(true)
        const setKeyNameMock = vi.fn()
        const setScaleTypeMock = vi.fn()

        melodyStore.setCurrentMelody({
          id: 'm1',
          name: 'Melody 1',
          key: 'G',
          scaleType: 'dorian',
          items: [],
        } as unknown as MelodyData)

        const controller = usePracticeToolsController({
          practiceEngine: {
            startMic: vi.fn(),
            getInputLevel: vi.fn(),
          },
          micActive: () => true,
          currentNoteIndex: () => -1,
          setKeyName: setKeyNameMock,
          setScaleType: setScaleTypeMock,
          practiceResult: () => null,
          setPracticeResult: vi.fn(),
          setLiveScore: vi.fn(),
        })

        // Octave shift
        controller.handleOctaveShift(1)
        expect(shiftSpy).toHaveBeenCalledWith(1)

        // Effect check
        await new Promise((r) => setTimeout(r, 0))
        expect(setKeyNameMock).toHaveBeenCalledWith('G')
        expect(setScaleTypeMock).toHaveBeenCalledWith('dorian')

        dispose()
        resolve()
      })
    })
  })

  it('computes targetNote, targetNoteName, and noteAccuracyMap', () => {
    createRoot((dispose) => {
      const [currentNoteIndex, setCurrentNoteIndex] = createSignal(-1)
      const testItems: MelodyItem[] = [
        {
          id: 1,
          note: { midi: 60, name: 'C', octave: 4, freq: 261.63 },
          startBeat: 0,
          duration: 1,
          velocity: 100,
        },
        {
          id: 2,
          note: { midi: 64, name: 'E', octave: 4, freq: 329.63 },
          startBeat: 1,
          duration: 1,
          velocity: 100,
        },
      ]
      vi.spyOn(melodyStore, 'getCurrentItems').mockReturnValue(testItems)

      const map = new Map<number, number>([[60, 0.95]])
      vi.spyOn(sessionHistoryStore, 'getSessionHistory').mockReturnValue([])
      vi.spyOn(sessionHistoryStore, 'getNoteAccuracyMap').mockReturnValue(map)

      const controller = usePracticeToolsController({
        practiceEngine: {
          startMic: vi.fn(),
          getInputLevel: vi.fn(),
        },
        micActive: () => true,
        currentNoteIndex,
        setKeyName: vi.fn(),
        setScaleType: vi.fn(),
        practiceResult: () => null,
        setPracticeResult: vi.fn(),
        setLiveScore: vi.fn(),
      })

      // Out of bounds index (-1)
      expect(controller.targetNote()).toBeNull()
      expect(controller.targetNoteName()).toBeNull()

      // Valid index 0
      setCurrentNoteIndex(0)
      expect(controller.targetNote()?.midi).toBe(60)
      expect(controller.targetNoteName()).toBe('C4')

      // Valid index 1
      setCurrentNoteIndex(1)
      expect(controller.targetNote()?.midi).toBe(64)
      expect(controller.targetNoteName()).toBe('E4')

      // Accuracy map
      expect(controller.noteAccuracyMap()).toBe(map)

      dispose()
    })
  })

  it('grades scores and handles score overlay dismissal', () => {
    createRoot((dispose) => {
      const [practiceResult, setPracticeResult] =
        createSignal<PracticeResult | null>(null)
      const setPracticeResultMock = vi.fn()
      const setLiveScoreMock = vi.fn()

      const controller = usePracticeToolsController({
        practiceEngine: {
          startMic: vi.fn(),
          getInputLevel: vi.fn(),
        },
        micActive: () => true,
        currentNoteIndex: () => -1,
        setKeyName: vi.fn(),
        setScaleType: vi.fn(),
        practiceResult,
        setPracticeResult: setPracticeResultMock,
        setLiveScore: setLiveScoreMock,
      })

      expect(controller.scoreGrade()).toBe('')
      expect(controller.scoreLabel()).toBe('')

      // 95 -> Pitch Perfect!
      setPracticeResult({ score: 95 } as PracticeResult)
      expect(controller.scoreGrade()).toBe('grade-perfect')
      expect(controller.scoreLabel()).toBe('Pitch Perfect!')

      // 85 -> Excellent!
      setPracticeResult({ score: 85 } as PracticeResult)
      expect(controller.scoreGrade()).toBe('grade-excellent')
      expect(controller.scoreLabel()).toBe('Excellent!')

      // 70 -> Good!
      setPracticeResult({ score: 70 } as PracticeResult)
      expect(controller.scoreGrade()).toBe('grade-good')
      expect(controller.scoreLabel()).toBe('Good!')

      // 55 -> Okay!
      setPracticeResult({ score: 55 } as PracticeResult)
      expect(controller.scoreGrade()).toBe('grade-okay')
      expect(controller.scoreLabel()).toBe('Okay!')

      // 40 -> Needs Work
      setPracticeResult({ score: 40 } as PracticeResult)
      expect(controller.scoreGrade()).toBe('grade-needs-work')
      expect(controller.scoreLabel()).toBe('Needs Work')

      // Close score overlay
      controller.closeScoreOverlay()
      expect(setPracticeResultMock).toHaveBeenCalledWith(null)
      expect(setLiveScoreMock).toHaveBeenCalledWith(null)

      dispose()
    })
  })
})
