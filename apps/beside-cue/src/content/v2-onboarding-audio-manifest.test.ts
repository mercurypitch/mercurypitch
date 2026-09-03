// ============================================================
// V2 onboarding audio manifest tests — identity and delivery-byte pins
// ============================================================

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { referencedAudioSources, validateAudioAssetManifest, } from './audio-manifest'
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
  it('exposes the four semantic ids the director can schedule', () => {
    expect(V2_ONBOARDING_AUDIO_ASSET_IDS).toEqual({
      greeting: 'dialogue.corky.onboarding.greeting',
      score: 'score.onboarding.v2',
      introTableSlide: 'foley.onboarding.intro-table-slide',
      platterStop: 'foley.onboarding.platter-stop',
    })
    expect(
      V2_ONBOARDING_AUDIO_ASSET_MANIFEST.assets.map((asset) => asset.id),
    ).toEqual(Object.values(V2_ONBOARDING_AUDIO_ASSET_IDS))
  })

  it('keeps the reviewed score finite instead of inventing a loop', () => {
    const score = V2_ONBOARDING_AUDIO_ASSET_MANIFEST.assets.find(
      (asset) => asset.id === V2_ONBOARDING_AUDIO_ASSET_IDS.score,
    )

    expect(score?.lane).toBe('score')
    expect(score?.playback).toEqual({ kind: 'one-shot' })
    expect(score?.sources[0]?.durationMs).toBe(32_833.333)
  })

  it('binds the accepted Kling greeting to its authored speech window', () => {
    const greeting = V2_ONBOARDING_AUDIO_ASSET_MANIFEST.assets.find(
      (asset) => asset.id === V2_ONBOARDING_AUDIO_ASSET_IDS.greeting,
    )

    expect(greeting?.sources[0]).toMatchObject({
      src: '/onboarding/corky-v2.4/audio/dialogue/corky-greeting-v0_3.m4a',
      durationMs: 5_038.75,
      sha256:
        '544f25d1a2565f600ed3ceb10bf93e1807b223e8dd93ff05589125315dcd6cba',
      byteLength: 123_466,
    })
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
