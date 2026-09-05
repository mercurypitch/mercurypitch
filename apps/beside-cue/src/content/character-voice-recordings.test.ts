// ============================================================
// Character recording registration tests — no invented or mismatched speech
// ============================================================

import { describe, expect, it } from 'vitest'
import type { AudioSourceVariant } from './audio-manifest'
import type { CharacterVoiceRecording } from './character-voice-recordings'
import { registerCharacterVoiceRecordings } from './character-voice-recordings'
import { PREMIUM_PULL_LINES } from './premium-pulls'
import { CANONICAL_VOICE_LINES } from './voice-lines'

const GREETING = CANONICAL_VOICE_LINES[0]

function recording(): CharacterVoiceRecording {
  // Deliberate test metadata, never imported by the packaged content registry.
  return {
    lineId: GREETING.id,
    captionSha256: GREETING.captionSha256,
    sources: [
      {
        src: '/audio/voice/test/greeting.m4a',
        mimeType: 'audio/mp4; codecs="mp4a.40.2"',
        sha256: 'a'.repeat(64),
        byteLength: 12_000,
        durationMs: 3_500,
        sampleRateHz: 48_000,
        channels: 1,
      },
    ],
  }
}

describe('character voice recording registration', () => {
  it('keeps the greeting semantic identity and exact canonical caption binding', () => {
    const delivery = recording()

    const assets = registerCharacterVoiceRecordings([delivery])

    expect(assets).toEqual([
      {
        id: 'dialogue.corky.onboarding.greeting',
        lane: 'dialogue',
        playback: { kind: 'one-shot' },
        dialogue: {
          lineId: GREETING.id,
          captionSha256: GREETING.captionSha256,
        },
        sources: delivery.sources,
      },
    ])
  })

  it('does not invent a recording for an unselected character', () => {
    expect(registerCharacterVoiceRecordings([])).toEqual([])
    expect(registerCharacterVoiceRecordings([recording()])).toHaveLength(1)
  })

  it('registers every premium beat against its exact canonical caption', () => {
    const deliveries = PREMIUM_PULL_LINES.map(
      (line): CharacterVoiceRecording => ({
        lineId: line.id,
        captionSha256: line.captionSha256,
        sources: [
          {
            ...recording().sources[0],
            src: `/audio/voice/test/${line.fileStem}.m4a`,
          },
        ],
      }),
    )

    const assets = registerCharacterVoiceRecordings(deliveries)

    expect(assets).toHaveLength(24)
    expect(assets.map((asset) => asset.id)).toEqual(
      PREMIUM_PULL_LINES.map((line) => `dialogue.${line.id}`),
    )
    for (const [index, asset] of assets.entries()) {
      expect(asset.dialogue).toEqual({
        lineId: deliveries[index]?.lineId,
        captionSha256: deliveries[index]?.captionSha256,
      })
    }
  })

  it('rejects changed captions and reserve-only companion identities', () => {
    expect(() =>
      registerCharacterVoiceRecordings([
        {
          ...recording(),
          captionSha256: 'b'.repeat(64),
        },
      ]),
    ).toThrow('Recording caption does not match')
    expect(() =>
      registerCharacterVoiceRecordings([
        {
          ...recording(),
          lineId: 'pocket-turner.hello',
        },
      ]),
    ).toThrow('Unknown recorded character line')
  })

  it('rejects duplicate greeting bindings and invalid delivery metadata', () => {
    expect(() =>
      registerCharacterVoiceRecordings([recording(), recording()]),
    ).toThrow('declared more than once')
    const delivery = recording()
    expect(() =>
      registerCharacterVoiceRecordings([
        {
          ...delivery,
          sources: [{ ...delivery.sources[0], durationMs: 0 }],
        },
      ]),
    ).toThrow('duration must be a finite positive number')
    expect(() =>
      registerCharacterVoiceRecordings([
        {
          ...delivery,
          sources: [
            { ...delivery.sources[0], src: 'https://example.com/voice.m4a' },
          ],
        },
      ]),
    ).toThrow('Invalid character voice recordings')
  })

  it('isolates and freezes delivery metadata without mutating the supplied manifest', () => {
    const source: AudioSourceVariant = { ...recording().sources[0] }
    const delivery = { ...recording(), sources: [source] as const }

    const assets = registerCharacterVoiceRecordings([delivery])

    expect(Object.isFrozen(source)).toBe(false)
    expect(assets[0]?.sources[0]).not.toBe(source)
    expect(Object.isFrozen(assets)).toBe(true)
    expect(Object.isFrozen(assets[0])).toBe(true)
    expect(Object.isFrozen(assets[0]?.sources)).toBe(true)
    expect(Object.isFrozen(assets[0]?.sources[0])).toBe(true)
    expect(Object.isFrozen(assets[0]?.dialogue)).toBe(true)
    expect(Object.isFrozen(assets[0]?.playback)).toBe(true)
  })
})
