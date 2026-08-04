import { describe, expect, it } from 'vitest'
import { decodeVoiceAtlasContour, encodeVoiceAtlasContour, VOICE_ATLAS_MAX_POINTS, voiceAtlasSourceLabel, } from './voice-contour'

describe('Voice Atlas contour codec', () => {
  it('round-trips pitch, confidence, level, and honest unvoiced gaps', () => {
    const encoded = encodeVoiceAtlasContour(
      [
        { t: 0, f0: 440, conf: 0.9, rms: 0.2 },
        { t: 0.04, f0: 0, conf: 0.1, rms: 0.04 },
        { t: 0.08, f0: 466.16, conf: 1, rms: 0.6 },
      ],
      { source: 'practice-engine-v1' },
    )
    const decoded = decodeVoiceAtlasContour(JSON.stringify(encoded))

    expect(encoded).toMatchObject({ v: 1, s: 'practice-engine-v1', hz: 30 })
    expect(decoded).toMatchObject({
      version: 1,
      source: 'practice-engine-v1',
      sampleRateHz: 30,
      voicedRatio: 0.667,
    })
    expect(decoded?.points).toEqual([
      { timeMs: 0, midiCents: 6900, confidence: 230 / 255, level: 51 / 255 },
      { timeMs: 40, midiCents: null, confidence: 26 / 255, level: 10 / 255 },
      { timeMs: 80, midiCents: 7000, confidence: 1, level: 153 / 255 },
    ])
    expect(decoded?.pitchRange).toEqual([6900, 7000])
  })

  it('bounds long high-rate captures while preserving their final frame', () => {
    const frames = Array.from(
      { length: VOICE_ATLAS_MAX_POINTS * 4 },
      (_, index) => ({
        t: index / 120,
        f0: 220,
        conf: 0.9,
        rms: 0.2,
      }),
    )
    const encoded = encodeVoiceAtlasContour(frames)

    expect(encoded.p.length).toBeLessThanOrEqual(VOICE_ATLAS_MAX_POINTS)
    expect(encoded.p.at(-1)?.[0]).toBe(Math.round(frames.at(-1)!.t * 1000))
  })

  it('accepts a silent capture without inventing pitch', () => {
    const encoded = encodeVoiceAtlasContour([
      { t: 0, f0: 0, conf: 0, rms: 0.03 },
    ])

    expect(encoded.r).toBeNull()
    expect(encoded.vr).toBe(0)
    expect(decodeVoiceAtlasContour(encoded)?.points[0]?.midiCents).toBeNull()
  })

  it.each([
    '{not json',
    { v: 2, s: 'f0-stream-yin-v1', hz: 30, p: [], r: null, vr: 0 },
    { v: 1, s: 'unknown', hz: 30, p: [], r: null, vr: 0 },
    {
      v: 1,
      s: 'f0-stream-yin-v1',
      hz: 30,
      p: [
        [20, 6900, 200, 100],
        [10, 6900, 200, 100],
      ],
      r: [6900, 6900],
      vr: 1,
    },
  ])('rejects corrupt or unsupported payloads', (payload) => {
    expect(decodeVoiceAtlasContour(payload)).toBeNull()
  })

  it('names both current analysis sources without quality claims', () => {
    expect(voiceAtlasSourceLabel('f0-stream-yin-v1')).toContain('pitch stream')
    expect(voiceAtlasSourceLabel('practice-engine-v1')).toContain(
      'practice engine',
    )
  })
})
