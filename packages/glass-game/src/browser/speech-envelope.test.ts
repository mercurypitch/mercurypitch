// Speech envelope tests — real PCM silence, syllables, stereo and playback bounds.
import { describe, expect, it } from 'vitest'
import { createSpeechEnvelope, speechEnvelopeAt } from './speech-envelope'

function pcm(channels: number[][]): AudioBuffer {
  return {
    sampleRate: 1000,
    length: channels[0].length,
    numberOfChannels: channels.length,
    getChannelData: (channel: number) => new Float32Array(channels[channel]),
  } as AudioBuffer
}

describe('narration mouth envelope', () => {
  it('closes in silence and interpolates a real syllable from the playback clock', () => {
    const envelope = createSpeechEnvelope(
      pcm([
        [...Array(20).fill(0), ...Array(20).fill(0.192), ...Array(20).fill(0)],
      ]),
    )
    expect(speechEnvelopeAt(envelope, 0)).toBe(0)
    expect(speechEnvelopeAt(envelope, 0.01)).toBeCloseTo(0.5)
    expect(speechEnvelopeAt(envelope, 0.02)).toBeCloseTo(1)
    expect(speechEnvelopeAt(envelope, 0.04)).toBe(0)
    expect(speechEnvelopeAt(envelope, 0.06)).toBe(0)
  })

  it('uses either channel without phase cancellation and ignores tiny noise', () => {
    const envelope = createSpeechEnvelope(
      pcm([
        [...Array(20).fill(0.002), ...Array(20).fill(0.192)],
        [...Array(20).fill(-0.002), ...Array(20).fill(-0.192)],
      ]),
    )
    expect(speechEnvelopeAt(envelope, 0)).toBe(0)
    expect(speechEnvelopeAt(envelope, 0.02)).toBeCloseTo(1)
  })

  it('stays finite and bounded for empty, malformed and out-of-time samples', () => {
    const envelope = createSpeechEnvelope(pcm([[NaN, Infinity, -Infinity, 3]]))
    expect(speechEnvelopeAt(envelope, 0)).toBe(1)
    for (const time of [-1, NaN, Infinity, 0.004, 50])
      expect(speechEnvelopeAt(envelope, time)).toBe(0)
    expect(speechEnvelopeAt(createSpeechEnvelope(pcm([[]])), 0)).toBe(0)
  })
})
