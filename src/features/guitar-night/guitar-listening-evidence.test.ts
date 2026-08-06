// Guitar listening evidence tests keep Jam Doctor observations factual and take-bound.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { GuitarListeningEvent } from './useGuitarListeningController'
import { summarizeGuitarListeningEvidence } from './useGuitarListeningController'

function listeningEvent(
  atMs: number,
  midi: number,
  clarity: number,
): GuitarListeningEvent {
  return {
    atMs,
    midi,
    clarity,
    noteName: 'E2',
    cents: 0,
    rms: 0.08,
  }
}

describe('summarizeGuitarListeningEvidence', () => {
  it('does not invent observations before a take contains evidence', () => {
    expect(summarizeGuitarListeningEvidence([])).toEqual([])
  })

  it('reports only measurements supported by captured attacks', () => {
    const observations = summarizeGuitarListeningEvidence([
      listeningEvent(0, 40, 0.7),
      listeningEvent(500, 43, 0.8),
      listeningEvent(1010, 47, 0.9),
      listeningEvent(1490, 45, 1),
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
        detail: 'Detector confidence across captured attacks.',
      },
      {
        label: 'Attack spacing',
        value: '±10 ms',
        detail: 'Median spacing 500 ms; lower variation is steadier.',
      },
      {
        label: 'Range heard',
        value: '7 semitones',
        detail: 'Lowest-to-highest detected attack in this take.',
      },
    ])
  })

  it('withholds confidence, timing, and range claims from one attack', () => {
    expect(
      summarizeGuitarListeningEvidence([listeningEvent(100, 40, 0.92)]),
    ).toEqual([
      {
        label: 'Attacks heard',
        value: '1',
        detail: 'Fresh note attacks captured in this take.',
      },
    ])
  })
})
