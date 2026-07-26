import { describe, expect, it } from 'vitest'
import type { MicRealitySnapshot } from '@/lib/mic-sentinel'
import { compareMicStates } from '@/lib/mic-sentinel'

const reality = (partial: Partial<MicRealitySnapshot>): MicRealitySnapshot => ({
  holds: [],
  streamLive: false,
  indicators: [],
  ...partial,
})

describe('mic sentinel — state comparison invariants', () => {
  it('all off and idle: no mismatches', () => {
    expect(compareMicStates(reality({}))).toEqual([])
  })

  it('healthy on-state: live stream, hold, icon on — no mismatches', () => {
    const result = compareMicStates(
      reality({
        holds: ['audio-engine-1'],
        streamLive: true,
        indicators: [{ id: 'practice', on: true }],
      }),
    )
    expect(result).toEqual([])
  })

  it('prod symptom a: icon on with no live track → ui-on-stream-dead', () => {
    const result = compareMicStates(
      reality({
        holds: ['audio-engine-1'],
        streamLive: false,
        indicators: [{ id: 'practice', on: true }],
      }),
    )
    expect(result.map((m) => m.kind)).toContain('ui-on-stream-dead')
    expect(result.find((m) => m.kind === 'ui-on-stream-dead')?.ids).toEqual([
      'practice',
    ])
  })

  it('prod symptom b: device live and held while every icon says off → live-without-ui', () => {
    const result = compareMicStates(
      reality({
        holds: ['stem-mixer'],
        streamLive: true,
        indicators: [
          { id: 'practice', on: false },
          { id: 'stem-mixer', on: false },
        ],
      }),
    )
    expect(result.map((m) => m.kind)).toEqual(['live-without-ui'])
  })

  it('phantom hold: consumer held with a dead stream → hold-on-dead-stream', () => {
    const result = compareMicStates(
      reality({ holds: ['audio-engine-1'], streamLive: false }),
    )
    expect(result.map((m) => m.kind)).toEqual(['hold-on-dead-stream'])
  })

  it('dead stream with an icon on reports both the UI and the hold', () => {
    const kinds = compareMicStates(
      reality({
        holds: ['stem-mixer'],
        streamLive: false,
        indicators: [{ id: 'stem-mixer', on: true }],
      }),
    ).map((m) => m.kind)
    expect(kinds).toContain('ui-on-stream-dead')
    expect(kinds).toContain('hold-on-dead-stream')
  })

  it('live stream with no registered indicators is not a mismatch', () => {
    // Standalone pages (mirror/glass) hold the mic without registering — the
    // sentinel must not cry wolf about surfaces it cannot see.
    expect(
      compareMicStates(reality({ holds: ['glass'], streamLive: true })),
    ).toEqual([])
  })

  it('linger window (stream live, zero holds, icons off) is not a mismatch', () => {
    expect(compareMicStates(reality({ streamLive: true }))).toEqual([])
  })
})
