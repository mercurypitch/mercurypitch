// ============================================================
// V2 onboarding audio manifest tests — identity and delivery-byte pins
// ============================================================

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { referencedAudioSources, validateAudioAssetManifest, } from './audio-manifest'
import { SELECTED_CHARACTER_VOICE_AUDIO_ASSETS } from './selected-character-voice-recordings'
import { V2_ONBOARDING_AUDIO_ASSET_IDS, V2_ONBOARDING_AUDIO_ASSET_MANIFEST, } from './v2-onboarding-audio-manifest'

function packageRoot(): string {
  const candidates = [process.cwd(), resolve(process.cwd(), 'apps/beside-cue')]
  const root = candidates.find((candidate) =>
    existsSync(
      resolve(candidate, 'src/content/v2-onboarding-audio-manifest.test.ts'),
    ),
  )
  if (root === undefined) {
    throw new Error('Could not locate the Beside Cue package root.')
  }
  return root
}

describe('V2 onboarding audio manifest', () => {
  it('composes the selected voices with the existing score and effects', () => {
    expect(V2_ONBOARDING_AUDIO_ASSET_IDS).toEqual({
      greeting: 'dialogue.corky.onboarding.greeting',
      score: 'score.onboarding.v2',
      introTableSlide: 'foley.onboarding.intro-table-slide',
      platterStop: 'foley.onboarding.platter-stop',
    })
    expect(
      V2_ONBOARDING_AUDIO_ASSET_MANIFEST.assets.map((asset) => asset.id),
    ).toEqual([
      ...SELECTED_CHARACTER_VOICE_AUDIO_ASSETS.map((asset) => asset.id),
      V2_ONBOARDING_AUDIO_ASSET_IDS.score,
      V2_ONBOARDING_AUDIO_ASSET_IDS.introTableSlide,
      V2_ONBOARDING_AUDIO_ASSET_IDS.platterStop,
    ])
    expect(V2_ONBOARDING_AUDIO_ASSET_MANIFEST.assets).toHaveLength(70)
  })

  it('keeps the complete composition running through an indefinite decision', () => {
    const score = V2_ONBOARDING_AUDIO_ASSET_MANIFEST.assets.find(
      (asset) => asset.id === V2_ONBOARDING_AUDIO_ASSET_IDS.score,
    )

    expect(score?.lane).toBe('score')
    expect(score?.playback).toEqual({
      kind: 'loop',
      loopStartMs: 1_500,
      loopEndMs: 77_880,
    })
    expect(score?.sources[0]?.durationMs).toBe(77_880)
  })

  it('replaces the old greeting recording without a duplicate semantic binding', () => {
    const greetings = V2_ONBOARDING_AUDIO_ASSET_MANIFEST.assets.filter(
      (asset) => asset.id === V2_ONBOARDING_AUDIO_ASSET_IDS.greeting,
    )

    expect(greetings).toHaveLength(1)
    expect(greetings[0]?.sources[0]).toEqual({
      src: '/audio/voice/en/corky/en__corky__onboarding-greeting__v1_01.m4a',
      mimeType: 'audio/mp4; codecs="mp4a.40.2"',
      durationMs: 1_869.021,
      sha256:
        'd13be42cec087cec140e4ddc5f4d700f54df0de59103210799beb3e535ca03f9',
      byteLength: 31_003,
      sampleRateHz: 48_000,
      channels: 1,
    })
    expect(
      referencedAudioSources(V2_ONBOARDING_AUDIO_ASSET_MANIFEST).some(
        ({ source }) => source.src.includes('corky-greeting-v0_3'),
      ),
    ).toBe(false)
  })

  it('preserves the pre-existing score and effect delivery hashes and sizes', () => {
    expect(
      V2_ONBOARDING_AUDIO_ASSET_MANIFEST.assets
        .filter((asset) => asset.lane !== 'dialogue')
        .map((asset) => ({
          id: asset.id,
          sha256: asset.sources[0].sha256,
          byteLength: asset.sources[0].byteLength,
        })),
    ).toEqual([
      {
        id: 'score.onboarding.v2',
        sha256:
          '6548afbd060216d772173ad9d9b9229f36723d3ed82e7fec3ff48535b59fedac',
        byteLength: 1_638_086,
      },
      {
        id: 'foley.onboarding.intro-table-slide',
        sha256:
          '19771a2a5e685c0632f6066adbc96f3839e035ddbe38d505b546126a549002ac',
        byteLength: 62_129,
      },
      {
        id: 'foley.onboarding.platter-stop',
        sha256:
          '0b277a72ed506d9281487a77424e058080ab61bcd0e099dc88a3bc8234ad1cd3',
        byteLength: 40_268,
      },
    ])
  })

  it('is structurally valid and immutable at the public boundary', () => {
    expect(
      validateAudioAssetManifest(V2_ONBOARDING_AUDIO_ASSET_MANIFEST),
    ).toEqual([])
    expect(Object.isFrozen(V2_ONBOARDING_AUDIO_ASSET_MANIFEST)).toBe(true)
    expect(Object.isFrozen(V2_ONBOARDING_AUDIO_ASSET_MANIFEST.assets)).toBe(
      true,
    )
  })

  it('pins every declared source to the exact packaged bytes', () => {
    const root = packageRoot()

    for (const { source } of referencedAudioSources(
      V2_ONBOARDING_AUDIO_ASSET_MANIFEST,
    )) {
      const path = resolve(root, 'public', source.src.replace(/^\.?\//u, ''))
      expect(existsSync(path), source.src).toBe(true)
      const bytes = readFileSync(path)
      expect(bytes.byteLength, source.src).toBe(source.byteLength)
      expect(createHash('sha256').update(bytes).digest('hex'), source.src).toBe(
        source.sha256,
      )
    }
  })
})
