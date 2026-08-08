// Guitar listening evidence tests keep Jam Doctor observations factual and take-bound.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { GuitarInputEvent } from '@/lib/guitar/input-events'
import { summarizeGuitarListeningEvidence } from './useGuitarListeningController'

function attack(
  atSeconds: number,
  midi: number | null,
  clarity = 0.8,
): GuitarInputEvent {
  return {
    kind: 'attack',
    source: 'microphone',
    at: atSeconds,
    capturedAt: atSeconds + 0.04,
    level: 0.08,
    pitch: midi === null ? null : { midi, noteName: 'E2', cents: 0, clarity },
  }
}

function legato(atSeconds: number, midi: number): GuitarInputEvent {
  return { ...attack(atSeconds, midi), kind: 'pitch-change' }
}

describe('summarizeGuitarListeningEvidence', () => {
  it('does not invent observations before a take contains evidence', () => {
    expect(summarizeGuitarListeningEvidence([])).toEqual([])
  })

  it('reports only measurements supported by captured attacks', () => {
    const observations = summarizeGuitarListeningEvidence([
      attack(0, 40, 0.7),
      attack(0.5, 43, 0.8),
      attack(1.01, 47, 0.9),
      attack(1.49, 45, 1),
    ])

    expect(observations).toEqual([
      {
        label: 'Attacks heard',
        value: '4',
        detail: 'Fresh note attacks captured in this take.',
      },
      {
        label: 'Median clarity',
        value: '85%',
        detail: 'Detector confidence across identified notes.',
      },
      {
        label: 'Attack spacing',
        value: '±10 ms',
        detail: 'Median spacing 500 ms; lower variation is steadier.',
      },
      {
        label: 'Range heard',
        value: '7 semitones',
        detail: 'Lowest-to-highest identified note in this take.',
      },
    ])
  })

  it('withholds confidence, timing, and range claims from one attack', () => {
    expect(summarizeGuitarListeningEvidence([attack(0.1, 40, 0.92)])).toEqual([
      {
        label: 'Attacks heard',
        value: '1',
        detail: 'Fresh note attacks captured in this take.',
      },
    ])
  })

  it('counts a hammer-on as playing, but never as a pick', () => {
    const observations = summarizeGuitarListeningEvidence([
      attack(0, 40),
      legato(0.12, 42),
      legato(0.24, 44),
      attack(0.5, 45),
    ])

    expect(observations[0]).toEqual({
      label: 'Attacks heard',
      value: '2',
      detail: 'Fresh note attacks captured in this take.',
    })
    expect(observations[1]).toEqual({
      label: 'Notes without a pick',
      value: '2',
      detail: 'Hammer-ons, pull-offs or slides — heard as pitch changes.',
    })
    // Two picks 500 ms apart is not enough to claim anything about steadiness,
    // and the legato notes in between must not be borrowed to make it four.
    expect(observations.some((entry) => entry.label === 'Attack spacing')).toBe(
      false,
    )
  })

  it('says how many attacks it could not name rather than dropping them', () => {
    const observations = summarizeGuitarListeningEvidence([
      attack(0, 40),
      attack(0.5, null),
      attack(1, 44),
    ])

    expect(observations).toContainEqual({
      label: 'Notes identified',
      value: '2 of 3',
      detail: 'The rest were heard but not clear enough to name.',
    })
    // Two clear readings is under the floor for a median worth showing.
    expect(observations.some((entry) => entry.label === 'Median clarity')).toBe(
      false,
    )
  })
})
