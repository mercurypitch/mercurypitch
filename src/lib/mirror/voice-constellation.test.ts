// ============================================================
// Voice Mirror constellation — persisted-history model invariants.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { VoiceprintRecord } from '@/db/services/voiceprint-service'
import { buildVoiceConstellation } from './voice-constellation'

const SUMMARY = {
  lowMidi: 40,
  highMidi: 64,
  semitones: 24,
  accuracy: 80,
  steadiness: 70,
} as const

function voiceprint(
  id: string,
  twin: string | null,
  takenAt: string,
): VoiceprintRecord {
  return {
    id,
    summary: SUMMARY,
    twin,
    source: 'mirror',
    takenAt,
  }
}

describe('buildVoiceConstellation', () => {
  it('sorts newest-first and deduplicates current and past catalogue matches', () => {
    const constellation = buildVoiceConstellation([
      voiceprint('older-cher', 'Cher', '2026-05-01T10:00:00.000Z'),
      voiceprint('newest', 'Adele', '2026-08-01T10:00:00.000Z'),
      voiceprint('duplicate-cher', 'Cher', '2026-04-01T10:00:00.000Z'),
      voiceprint('duplicate-adele', 'Adele', '2026-03-01T10:00:00.000Z'),
      voiceprint('null', null, '2026-02-01T10:00:00.000Z'),
    ])

    expect(constellation.currentVoiceprint?.id).toBe('newest')
    expect(constellation.currentTwin).toBe('Adele')
    expect(
      constellation.legends.filter((legend) => legend.state === 'current'),
    ).toEqual([
      expect.objectContaining({
        name: 'Adele',
        matchedAt: '2026-08-01T10:00:00.000Z',
        imageSrc: '/legends/adele.webp',
      }),
    ])
    expect(
      constellation.legends.filter((legend) => legend.state === 'past'),
    ).toEqual([
      expect.objectContaining({
        name: 'Cher',
        matchedAt: '2026-05-01T10:00:00.000Z',
      }),
    ])

    const unmatched = constellation.legends.find(
      (legend) => legend.name === 'Freddie Mercury',
    )
    expect(unmatched).toEqual({
      id: 'freddie-mercury',
      name: 'Freddie Mercury',
      band: 'Tenor',
      state: 'unmatched',
    })
    expect(unmatched).not.toHaveProperty('imageSrc')
  })

  it('keeps a null-twin newest record current while older matches stay past', () => {
    const constellation = buildVoiceConstellation([
      voiceprint('older', 'Adele', '2026-07-01T10:00:00.000Z'),
      voiceprint('newest-null', null, '2026-08-01T10:00:00.000Z'),
    ])

    expect(constellation.currentVoiceprint?.id).toBe('newest-null')
    expect(constellation.currentTwin).toBeNull()
    expect(
      constellation.legends.find((legend) => legend.name === 'Adele'),
    ).toEqual(
      expect.objectContaining({
        state: 'past',
        matchedAt: '2026-07-01T10:00:00.000Z',
      }),
    )
    expect(
      constellation.legends.some((legend) => legend.state === 'current'),
    ).toBe(false)
  })

  it('returns an entirely locked catalogue for empty history', () => {
    const constellation = buildVoiceConstellation([])

    expect(constellation.currentVoiceprint).toBeNull()
    expect(constellation.currentTwin).toBeNull()
    expect(constellation.legacyMatches).toEqual([])
    expect(constellation.legends).toHaveLength(21)
    expect(
      constellation.legends.every(
        (legend) => legend.state === 'unmatched' && !('imageSrc' in legend),
      ),
    ).toBe(true)
  })

  it('preserves removed legend names in a deduplicated legacy fallback', () => {
    const constellation = buildVoiceConstellation([
      voiceprint('legacy-past', 'Archive Singer', '2026-05-01T10:00:00.000Z'),
      voiceprint(
        'legacy-current',
        'Removed Legend',
        '2026-08-01T10:00:00.000Z',
      ),
      voiceprint(
        'legacy-current-duplicate',
        'Removed Legend',
        '2026-04-01T10:00:00.000Z',
      ),
      voiceprint('catalogue-past', 'Prince', '2026-03-01T10:00:00.000Z'),
    ])

    expect(constellation.currentTwin).toBe('Removed Legend')
    expect(constellation.legacyMatches).toEqual([
      {
        name: 'Removed Legend',
        state: 'current',
        matchedAt: '2026-08-01T10:00:00.000Z',
      },
      {
        name: 'Archive Singer',
        state: 'past',
        matchedAt: '2026-05-01T10:00:00.000Z',
      },
    ])
    expect(
      constellation.legends.find((legend) => legend.name === 'Prince')?.state,
    ).toBe('past')
  })

  it('trusts the persisted twin instead of recalculating from its range', () => {
    const constellation = buildVoiceConstellation([
      // The summary is a Bass-shaped range, but the saved result is Prince.
      voiceprint('saved-result', 'Prince', '2026-08-01T10:00:00.000Z'),
    ])

    expect(
      constellation.legends.find((legend) => legend.name === 'Prince')?.state,
    ).toBe('current')
    expect(
      constellation.legends
        .filter((legend) => legend.band === 'Bass')
        .every((legend) => legend.state === 'unmatched'),
    ).toBe(true)
  })
})
