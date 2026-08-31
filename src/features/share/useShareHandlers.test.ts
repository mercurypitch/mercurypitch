// ============================================================
// useShareHandlers unit tests
// ============================================================

import { createRoot, createSignal } from 'solid-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TAB_COMPOSE, TAB_EXERCISES } from '@/features/tabs/constants'
import * as shareCodec from '@/lib/share-codec'
import { encodeExerciseForShare, encodeMelodyForShare, encodeRoutineForShare, } from '@/lib/share-codec'
import * as melodyStore from '@/stores/melody-store'
import * as notificationsStore from '@/stores/notifications-store'
import type { MelodyItem } from '@/types'
import { useShareHandlers } from './useShareHandlers'

describe('useShareHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(notificationsStore, 'showNotification').mockImplementation(
      () => {},
    )
  })

  it('handles shared melody loading with bpm, key, scale, drums, and tab switch', () => {
    createRoot((dispose) => {
      const [bpm, setBpm] = createSignal(120)
      const [keyName, setKeyName] = createSignal('C')
      const [scaleType, setScaleType] = createSignal('major')
      const setActiveTab = vi.fn()
      const setSelectedExercise = vi.fn()
      const setAutoStartExercise = vi.fn()

      const handlers = useShareHandlers({
        bpm,
        setBpm,
        keyName,
        setKeyName,
        scaleType,
        setScaleType,
        setActiveTab,
        setSelectedExercise,
        setAutoStartExercise,
      })

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
          note: { midi: 62, name: 'D', octave: 4, freq: 293.66 },
          startBeat: 1,
          duration: 1,
          velocity: 100,
        },
      ]

      const encoded = encodeMelodyForShare(
        testItems,
        135,
        'D',
        'minor',
        2,
        'Test Song',
        'drums',
      )

      handlers.handleShareMelody(encoded)

      // eslint-disable-next-line solid/reactivity
      expect(bpm()).toBe(135)
      // eslint-disable-next-line solid/reactivity
      expect(keyName()).toBe('D')
      // eslint-disable-next-line solid/reactivity
      expect(scaleType()).toBe('minor')
      expect(setActiveTab).toHaveBeenCalledWith(TAB_COMPOSE)
      expect(notificationsStore.showNotification).toHaveBeenCalledWith(
        'Loaded shared melody: Test Song',
        'info',
      )

      // Test invalid melody payload
      handlers.handleShareMelody('invalid-payload')

      dispose()
    })
  })

  it('handles shared exercise and routine loading', () => {
    createRoot((dispose) => {
      const [bpm, setBpm] = createSignal(120)
      const [keyName, setKeyName] = createSignal('C')
      const [scaleType, setScaleType] = createSignal('major')
      const setActiveTab = vi.fn()
      const setSelectedExercise = vi.fn()
      const setAutoStartExercise = vi.fn()

      const handlers = useShareHandlers({
        bpm,
        setBpm,
        keyName,
        setKeyName,
        scaleType,
        setScaleType,
        setActiveTab,
        setSelectedExercise,
        setAutoStartExercise,
      })

      // Exercise
      const exercisePayload = encodeExerciseForShare(
        'sirens',
        undefined,
        undefined,
        undefined,
        'Vocal Sirens',
      )
      handlers.handleShareExercise(exercisePayload)
      expect(setActiveTab).toHaveBeenCalledWith(TAB_EXERCISES)
      expect(setSelectedExercise).toHaveBeenCalledWith('sirens')
      expect(setAutoStartExercise).toHaveBeenCalledWith(true)

      // Routine
      const routinePayload = encodeRoutineForShare({
        id: 'routine-1',
        name: 'Warmup Routine',
        description: '10 min warmup',
        segments: [{ type: 'exercise', durationSec: 120, config: {} }],
      })
      handlers.handleShareRoutine(routinePayload)
      expect(setActiveTab).toHaveBeenCalledWith(TAB_EXERCISES)

      // Fallback
      handlers.handleShareFallback('unknown', '123')
      expect(notificationsStore.showNotification).toHaveBeenCalledWith(
        expect.stringContaining('expired'),
        'warning',
      )

      dispose()
    })
  })

  it('handles short url resolution and error handling', async () => {
    await new Promise<void>((resolve) => {
      createRoot(async (dispose) => {
        const handlers = useShareHandlers({
          bpm: () => 120,
          setBpm: vi.fn(),
          keyName: () => 'C',
          setKeyName: vi.fn(),
          scaleType: () => 'major',
          setScaleType: vi.fn(),
          setActiveTab: vi.fn(),
          setSelectedExercise: vi.fn(),
          setAutoStartExercise: vi.fn(),
        })

        // Expired short link
        vi.spyOn(shareCodec, 'fetchShortPayload').mockResolvedValueOnce(null)
        handlers.handleShareShort('expired-id')
        await new Promise((r) => setTimeout(r, 0))
        expect(notificationsStore.showNotification).toHaveBeenCalledWith(
          'This shared link has expired or is invalid.',
          'warning',
        )

        // Corrupted short link
        vi.spyOn(shareCodec, 'fetchShortPayload').mockResolvedValueOnce(
          'corrupted-data',
        )
        handlers.handleShareShort('corrupt-id')
        await new Promise((r) => setTimeout(r, 0))
        expect(notificationsStore.showNotification).toHaveBeenCalledWith(
          'Shared content is corrupted or in an older format.',
          'warning',
        )

        // Valid melody short link
        const testItems: MelodyItem[] = [
          {
            id: 1,
            note: { midi: 60, name: 'C', octave: 4, freq: 261.63 },
            startBeat: 0,
            duration: 1,
            velocity: 100,
          },
        ]
        const validPayload = encodeMelodyForShare(
          testItems,
          120,
          'C',
          'major',
          1,
          'Short Song',
        )
        vi.spyOn(shareCodec, 'fetchShortPayload').mockResolvedValueOnce(
          validPayload,
        )
        handlers.handleShareShort('valid-id')
        await new Promise((r) => setTimeout(r, 0))
        expect(notificationsStore.showNotification).toHaveBeenCalledWith(
          'Loaded shared melody: Short Song',
          'info',
        )

        dispose()
        resolve()
      })
    })
  })

  it('handles copy share link for empty and populated melodies', async () => {
    await new Promise<void>((resolve) => {
      createRoot(async (dispose) => {
        const [bpm, setBpm] = createSignal(120)
        const [keyName, setKeyName] = createSignal('C')
        const [scaleType, setScaleType] = createSignal('major')

        const handlers = useShareHandlers({
          bpm,
          setBpm,
          keyName,
          setKeyName,
          scaleType,
          setScaleType,
          setActiveTab: vi.fn(),
          setSelectedExercise: vi.fn(),
          setAutoStartExercise: vi.fn(),
        })

        // Empty melody
        vi.spyOn(melodyStore, 'getCurrentItems').mockReturnValue([])
        handlers.handleCopyShareLink()
        expect(notificationsStore.showNotification).toHaveBeenCalledWith(
          'No melody to share',
          'warning',
        )

        // Populated melody with copy success
        const testItems: MelodyItem[] = [
          {
            id: 1,
            note: { midi: 60, name: 'C', octave: 4, freq: 261.63 },
            startBeat: 0,
            duration: 1,
            velocity: 100,
          },
        ]
        vi.spyOn(melodyStore, 'getCurrentItems').mockReturnValue(testItems)
        vi.spyOn(shareCodec, 'copyShareUrl').mockResolvedValueOnce(true)
        handlers.handleCopyShareLink()
        await new Promise((r) => setTimeout(r, 0))
        expect(notificationsStore.showNotification).toHaveBeenCalledWith(
          'Share link copied!',
          'info',
        )

        dispose()
        resolve()
      })
    })
  })
})
