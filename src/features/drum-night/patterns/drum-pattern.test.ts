// ============================================================
// Drum pattern format tests — parsing, GM round-trip, document projection
// ============================================================

import { describe, expect, it } from 'vitest'
import { drumVoiceForMidi } from '@/lib/drum-voice-map'
import type { DrumVoiceId } from '@/lib/drum-voices'
import type { DrumPattern } from './drum-pattern'
import { createDrumPatternDocument, DRUM_PATTERN_GM_KEYS, DRUM_PATTERN_STEP_BEATS, drumPatternDurationBeats, drumPatternHits, drumPatternIssues, parseDrumPatternLane, } from './drum-pattern'

function pattern(overrides: Partial<DrumPattern> = {}): DrumPattern {
  return {
    id: 'test-pattern',
    name: 'Test Pattern',
    style: 'rock',
    description: 'A single bar for the parser.',
    bars: 1,
    tempoBpm: 100,
    tempoRange: [80, 120],
    lanes: {
      kick: 'X-------X-------',
      snare: '----X-------X---',
    },
    provenance: { attribution: 'Test', license: 'original' },
    ...overrides,
  }
}

describe('parseDrumPatternLane', () => {
  it('maps the three dynamics and skips rests', () => {
    const reading = parseDrumPatternLane('X-x-o-----------')

    expect(reading.cells).toEqual([
      { step: 0, velocity: 114 },
      { step: 2, velocity: 88 },
      { step: 4, velocity: 42 },
    ])
    expect(reading.stepCount).toBe(16)
    expect(reading.invalidSymbols).toEqual([])
  })

  it('drops bar dividers without shifting the grid', () => {
    const withDivider = parseDrumPatternLane('X-------|--------X-------')
    const without = parseDrumPatternLane('X---------------X-------')

    expect(withDivider.cells).toEqual(without.cells)
    expect(withDivider.stepCount).toBe(24)
  })

  it('reports an unknown symbol instead of throwing', () => {
    const reading = parseDrumPatternLane('X-?-')

    expect(reading.invalidSymbols).toEqual(['?'])
    expect(reading.cells).toEqual([{ step: 0, velocity: 114 }])
    // The bad cell still consumes its slot, so later hits keep their position.
    expect(reading.stepCount).toBe(4)
  })
})

describe('drumPatternIssues', () => {
  it('accepts a well-formed pattern', () => {
    expect(drumPatternIssues(pattern())).toEqual([])
  })

  it('names a lane that is the wrong length', () => {
    expect(drumPatternIssues(pattern({ lanes: { kick: 'X-------' } }))).toEqual(
      [{ voice: 'kick', kind: 'length-mismatch', detail: '8 of 16' }],
    )
  })

  it('names a lane with an unknown symbol', () => {
    const issues = drumPatternIssues(
      pattern({ lanes: { kick: 'X?------X?------' } }),
    )

    expect(issues).toContainEqual({
      voice: 'kick',
      kind: 'invalid-symbol',
      detail: '?',
    })
  })
})

describe('DRUM_PATTERN_GM_KEYS', () => {
  it('round-trips every voice through the shared GM fold', () => {
    for (const [voice, gmKey] of Object.entries(DRUM_PATTERN_GM_KEYS)) {
      expect(drumVoiceForMidi(gmKey)).toBe(voice as DrumVoiceId)
    }
  })
})

describe('drumPatternHits', () => {
  it('places hits on the sixteenth grid in beat order', () => {
    const hits = drumPatternHits(pattern())

    expect(hits.map((hit) => hit.startBeat)).toEqual([0, 1, 2, 3])
    expect(hits.map((hit) => hit.gmKey)).toEqual([36, 38, 36, 38])
    expect(DRUM_PATTERN_STEP_BEATS).toBe(0.25)
  })

  it('gives sustaining metals a longer written duration than drums', () => {
    const hits = drumPatternHits(
      pattern({
        lanes: { crash: 'X---------------', kick: 'X---------------' },
      }),
    )

    expect(hits.find((hit) => hit.gmKey === 49)?.writtenDuration).toBe(0.5)
    expect(hits.find((hit) => hit.gmKey === 36)?.writtenDuration).toBe(0.25)
  })

  it('is stable across calls', () => {
    expect(drumPatternHits(pattern())).toEqual(drumPatternHits(pattern()))
  })
})

describe('createDrumPatternDocument', () => {
  it('builds a playable prepared document', () => {
    const document = createDrumPatternDocument(pattern())

    expect(document).not.toBeNull()
    expect(document?.sourceFormat).toBe('prepared')
    expect(document?.title).toBe('Test Pattern')
    expect(document?.hitCount).toBe(4)
    expect(document?.canonicalSong.bpm).toBe(100)
    expect(drumPatternDurationBeats(pattern())).toBe(4)
  })

  it('returns null rather than an empty session for a silent pattern', () => {
    expect(
      createDrumPatternDocument(
        pattern({ lanes: { kick: '----------------' } }),
      ),
    ).toBeNull()
  })
})
