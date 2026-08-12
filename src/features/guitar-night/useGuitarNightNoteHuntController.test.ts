// ============================================================
// Guitar Night Note Hunt controller tests — calm marks and pitch-only truth
// ============================================================

import { createRoot, createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { createNoteHuntRound, createNoteHuntState, } from '@/features/guitar/activities/note-hunt'
import type { GuitarInputEvent } from '@/lib/guitar/input-events'
import { standardTuning } from '@/lib/guitar/instrument-tuning'
import { useGuitarNightNoteHuntController } from './useGuitarNightNoteHuntController'

function pitchEvent(id: string, midi: number): GuitarInputEvent {
  return {
    id,
    kind: 'attack',
    source: 'midi',
    voiceId: id,
    at: 0,
    capturedAt: 0,
    level: 1,
    clock: {
      kind: 'web-midi',
      eventTimestampMs: 0,
      observedPerformanceMs: 0,
      mappedAudioTime: 0,
      inputId: 'midi-1',
      channel: 0,
    },
    pitch: {
      midi,
      noteName: midi === 64 ? 'E4' : 'F4',
      cents: 0,
      clarity: 1,
    },
  }
}

function provisionalEvent(id: string): GuitarInputEvent {
  return {
    ...pitchEvent(id, 64),
    pitch: null,
  }
}

describe('useGuitarNightNoteHuntController', () => {
  it('keeps only the latest miss while preserving exact found positions', () => {
    createRoot((dispose) => {
      const controller = useGuitarNightNoteHuntController({
        tuning: () => standardTuning('guitar'),
        events: () => [],
        pitchRevision: () => 0,
      })

      controller.markPosition(0, 1)
      expect(controller.cellState(0, 1)).toBe('miss')
      controller.markPosition(1, 1)
      expect(controller.cellState(0, 1)).toBe('idle')
      expect(controller.cellState(1, 1)).toBe('miss')
      controller.markPosition(0, 0)
      expect(controller.cellState(1, 1)).toBe('idle')
      expect(controller.cellState(0, 0)).toBe('found')
      dispose()
    })
  })

  it('lets fresh listening evidence replace older touch feedback without marking a place', async () => {
    await new Promise<void>((resolve) => {
      createRoot((dispose) => {
        const [events, setEvents] = createSignal<readonly GuitarInputEvent[]>(
          [],
        )
        const [revision, setRevision] = createSignal(0)
        const controller = useGuitarNightNoteHuntController({
          tuning: () => standardTuning('guitar'),
          events,
          pitchRevision: revision,
        })

        controller.markPosition(0, 1)
        expect(controller.feedback()).toContain('not E')
        setEvents([pitchEvent('event-1', 64)])
        setRevision(1)

        queueMicrotask(() => {
          expect(controller.feedback()).toBe(
            'E heard. Tap the place where you played it.',
          )
          expect(controller.foundCount()).toBe(0)
          expect(controller.cellState(0, 1)).toBe('idle')
          dispose()
          resolve()
        })
      })
    })
  })

  it('chooses the next target only from pitch classes playable in the round', () => {
    createRoot((dispose) => {
      const tuning = standardTuning('guitar', 4)
      const initialState = createNoteHuntState(
        createNoteHuntRound(tuning, {
          fretRange: { firstFret: 0, lastFret: 0 },
          targetPitchClass: 4,
        }),
      )
      const onState = vi.fn()
      const controller = useGuitarNightNoteHuntController({
        tuning: () => tuning,
        events: () => [],
        pitchRevision: () => 0,
        initialState,
        onState,
      })

      controller.markPosition(0, 0)
      expect(controller.complete()).toBe(true)
      expect(controller.completedRoundCount()).toBe(1)
      controller.startNextRound()

      expect(controller.round().targetPitchClass).toBe(7)
      expect(controller.completedRoundCount()).toBe(1)
      expect(onState).toHaveBeenLastCalledWith(controller.state(), 1)
      dispose()
    })
  })

  it('does not replay already-consumed listening evidence in the next round', async () => {
    await new Promise<void>((resolve) => {
      createRoot((dispose) => {
        const tuning = standardTuning('guitar', 4)
        const initialState = createNoteHuntState(
          createNoteHuntRound(tuning, {
            fretRange: { firstFret: 0, lastFret: 0 },
            targetPitchClass: 4,
          }),
        )
        const [events, setEvents] = createSignal<readonly GuitarInputEvent[]>(
          [],
        )
        const [revision, setRevision] = createSignal(0)
        const controller = useGuitarNightNoteHuntController({
          tuning: () => tuning,
          events,
          pitchRevision: revision,
          initialState,
        })

        setEvents([pitchEvent('heard-e', 64)])
        setRevision(1)

        queueMicrotask(() => {
          expect(controller.lastPitchEvidence()?.eventId).toBe('heard-e')
          controller.markPosition(0, 0)
          controller.startNextRound()
          expect(controller.lastPitchEvidence()).toBeNull()

          setEvents([
            pitchEvent('heard-e', 64),
            provisionalEvent('new-provisional'),
          ])
          setRevision(2)

          queueMicrotask(() => {
            expect(controller.lastPitchEvidence()).toBeNull()
            expect(controller.feedback()).toContain('Tap every G')
            dispose()
            resolve()
          })
        })
      })
    })
  })
})
