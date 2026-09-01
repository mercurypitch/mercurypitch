// ============================================================
// Audio asset manifest tests — structure, binding and byte pins
// ============================================================

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { AudioAssetManifest } from './audio-manifest'
import { DEFAULT_AUDIO_ASSET_MANIFEST, findAudioAsset, findDialogueAudioAssetForLine, isPackagedAudioAssetUrl, referencedAudioSources, resolveAudioAsset, resolveDialogueAudioAsset, validateAudioAssetManifest, validateAudioDialogueLineBindings, } from './audio-manifest'

const HASH_A = 'a'.repeat(64)
const HASH_B = 'b'.repeat(64)
const CAPTION_HASH = 'c'.repeat(64)

const COMPLETE_MANIFEST: AudioAssetManifest = {
  schemaVersion: 1,
  revision: 'beside-cue-audio-test-v1',
  locale: 'en',
  assets: [
    {
      id: 'dialogue.pull.scrolling.meet',
      lane: 'dialogue',
      playback: { kind: 'one-shot' },
      dialogue: {
        lineId: 'pull.scrolling.meet',
        captionSha256: CAPTION_HASH,
      },
      sources: [
        {
          src: '/audio/voice/en/the-scroll/meet.m4a',
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256: HASH_A,
          byteLength: 12_345,
          durationMs: 4_800,
          sampleRateHz: 48_000,
          channels: 1,
        },
        {
          src: '/audio/voice/en/the-scroll/meet.ogg',
          mimeType: 'audio/ogg; codecs="opus"',
          sha256: HASH_B,
          byteLength: 11_111,
          durationMs: 4_790,
          sampleRateHz: 48_000,
          channels: 1,
        },
      ],
    },
    {
      id: 'score.onboarding.open',
      lane: 'score',
      playback: { kind: 'one-shot' },
      sources: [
        {
          src: './audio/score/en/onboarding-open.m4a',
          mimeType: 'audio/mp4',
          sha256: HASH_A,
          byteLength: 90_000,
          durationMs: 12_000,
          sampleRateHz: 48_000,
          channels: 2,
        },
      ],
    },
    {
      id: 'hold.onboarding.choice',
      lane: 'hold-bed',
      playback: { kind: 'loop', loopStartMs: 1_000, loopEndMs: 9_000 },
      sources: [
        {
          src: '/audio/hold-beds/onboarding-choice.m4a',
          mimeType: 'audio/mp4',
          sha256: HASH_A,
          byteLength: 80_000,
          durationMs: 10_000,
          sampleRateHz: 48_000,
          channels: 2,
        },
      ],
    },
    {
      id: 'foley.record.detent',
      lane: 'foley',
      playback: { kind: 'one-shot' },
      sources: [
        {
          src: '/audio/foley/record-detent.m4a',
          mimeType: 'audio/mp4',
          sha256: HASH_A,
          byteLength: 2_000,
          durationMs: 180,
          sampleRateHz: 48_000,
          channels: 1,
        },
      ],
    },
    {
      id: 'ui.reminder.confirmed',
      lane: 'ui',
      playback: { kind: 'one-shot' },
      sources: [
        {
          src: '/audio/ui/reminder-confirmed.m4a',
          mimeType: 'audio/mp4',
          sha256: HASH_A,
          byteLength: 2_100,
          durationMs: 220,
          sampleRateHz: 48_000,
          channels: 1,
        },
      ],
    },
  ],
}

function packageRoot(): string {
  const candidates = [process.cwd(), resolve(process.cwd(), 'apps/beside-cue')]
  const root = candidates.find((candidate) =>
    existsSync(resolve(candidate, 'src/content/audio-manifest.test.ts')),
  )
  if (root === undefined) {
    throw new Error('Could not locate the Beside Cue package root.')
  }
  return root
}

function publicPath(root: string, src: string): string {
  return resolve(root, 'public', src.replace(/^\.?\//u, ''))
}

describe('audio asset manifest', () => {
  it('ships a frozen, valid caption-only default', () => {
    expect(validateAudioAssetManifest(DEFAULT_AUDIO_ASSET_MANIFEST)).toEqual([])
    expect(DEFAULT_AUDIO_ASSET_MANIFEST.assets).toEqual([])
    expect(Object.isFrozen(DEFAULT_AUDIO_ASSET_MANIFEST)).toBe(true)
    expect(Object.isFrozen(DEFAULT_AUDIO_ASSET_MANIFEST.assets)).toBe(true)
  })

  it('accepts every reserved lane and ordered same-content variants', () => {
    expect(validateAudioAssetManifest(COMPLETE_MANIFEST)).toEqual([])
    expect(COMPLETE_MANIFEST.assets.map((asset) => asset.lane)).toEqual([
      'dialogue',
      'score',
      'hold-bed',
      'foley',
      'ui',
    ])
  })

  it('resolves supported variants in authored order without mutation', () => {
    const originalSources = COMPLETE_MANIFEST.assets[0]?.sources
    const resolved = resolveAudioAsset(
      COMPLETE_MANIFEST,
      'dialogue.pull.scrolling.meet',
      (mimeType) => mimeType.includes('ogg'),
    )

    expect(resolved?.sources.map((source) => source.src)).toEqual([
      '/audio/voice/en/the-scroll/meet.ogg',
    ])
    expect(COMPLETE_MANIFEST.assets[0]?.sources).toBe(originalSources)
    expect(resolveAudioAsset(COMPLETE_MANIFEST, 'missing')).toBeUndefined()
    expect(
      resolveAudioAsset(
        COMPLETE_MANIFEST,
        'dialogue.pull.scrolling.meet',
        () => false,
      ),
    ).toBeUndefined()
  })

  it('resolves dialogue only when asset, line and exact caption agree', () => {
    const exact = {
      assetId: 'dialogue.pull.scrolling.meet',
      lineId: 'pull.scrolling.meet',
      captionSha256: CAPTION_HASH,
    }
    expect(resolveDialogueAudioAsset(COMPLETE_MANIFEST, exact)?.id).toBe(
      exact.assetId,
    )
    expect(
      resolveDialogueAudioAsset(COMPLETE_MANIFEST, {
        ...exact,
        lineId: 'pull.snacking.meet',
      }),
    ).toBeUndefined()
    expect(
      resolveDialogueAudioAsset(COMPLETE_MANIFEST, {
        ...exact,
        captionSha256: HASH_A,
      }),
    ).toBeUndefined()
    expect(
      resolveDialogueAudioAsset(COMPLETE_MANIFEST, {
        ...exact,
        assetId: 'score.onboarding.open',
      }),
    ).toBeUndefined()
  })

  it('finds a unique exact dialogue binding without a line-side asset id', () => {
    const exact = {
      lineId: 'pull.scrolling.meet',
      captionSha256: CAPTION_HASH,
    }
    expect(findDialogueAudioAssetForLine(COMPLETE_MANIFEST, exact)?.id).toBe(
      'dialogue.pull.scrolling.meet',
    )
    expect(
      findDialogueAudioAssetForLine(COMPLETE_MANIFEST, {
        ...exact,
        captionSha256: HASH_A,
      }),
    ).toBeUndefined()

    const dialogue = COMPLETE_MANIFEST.assets[0]
    if (dialogue?.lane !== 'dialogue') {
      throw new Error('Expected the test dialogue asset.')
    }
    expect(
      findDialogueAudioAssetForLine(
        { ...COMPLETE_MANIFEST, assets: [dialogue, { ...dialogue }] },
        exact,
      ),
    ).toBeUndefined()
  })

  it('cross-checks future line bindings and reports orphaned dialogue', () => {
    expect(
      validateAudioDialogueLineBindings(COMPLETE_MANIFEST, [
        {
          lineId: 'pull.scrolling.meet',
          captionSha256: CAPTION_HASH,
        },
        {
          lineId: 'pull.snacking.meet',
          captionSha256: HASH_A,
        },
      ]),
    ).toEqual([])

    expect(
      validateAudioDialogueLineBindings(COMPLETE_MANIFEST, [
        {
          lineId: 'pull.scrolling.meet',
          captionSha256: HASH_A,
          audioAssetId: 'dialogue.pull.scrolling.meet',
        },
      ]).join('\n'),
    ).toMatch(/does not exactly match/iu)
    expect(validateAudioDialogueLineBindings(COMPLETE_MANIFEST, [])).toEqual([
      'Dialogue audio asset "dialogue.pull.scrolling.meet" is not bound to a line.',
    ])
  })

  it('keeps packaged URLs local, undecorated and traversal-free', () => {
    expect(isPackagedAudioAssetUrl('/audio/voice/en/corky/line.m4a')).toBe(true)
    expect(isPackagedAudioAssetUrl('./audio/voice/en/corky/line.m4a')).toBe(
      true,
    )
    expect(
      isPackagedAudioAssetUrl(
        '/onboarding/corky-v2.4/audio/dialogue/corky-greeting-v0_2.m4a',
      ),
    ).toBe(true)
    expect(isPackagedAudioAssetUrl('https://provider.test/line.m4a')).toBe(
      false,
    )
    expect(isPackagedAudioAssetUrl('/audio/../private/line.m4a')).toBe(false)
    expect(
      isPackagedAudioAssetUrl('/onboarding/corky-v2.4/audio/../private.m4a'),
    ).toBe(false)
    expect(isPackagedAudioAssetUrl('/audio/voice/line.m4a?v=2')).toBe(false)
    expect(isPackagedAudioAssetUrl('/onboarding/audio/line.m4a')).toBe(false)
    expect(isPackagedAudioAssetUrl(' /audio/voice/line.m4a')).toBe(false)
  })

  it('reports structural, integrity, lane and loop faults together', () => {
    const problems = validateAudioAssetManifest({
      schemaVersion: 2,
      revision: 'Not valid',
      locale: '',
      surprise: true,
      assets: [
        {
          id: 'bad asset',
          lane: 'dialogue',
          playback: { kind: 'loop', loopStartMs: 500, loopEndMs: 5_000 },
          sources: [
            {
              src: 'https://provider.test/line.m4a',
              mimeType: 'video/mp4',
              sha256: 'ABC',
              byteLength: 0,
              durationMs: 1_000,
              sampleRateHz: 0,
              channels: 6,
            },
          ],
          dialogue: { lineId: '', captionSha256: 'nope' },
        },
        {
          id: 'hold.bad',
          lane: 'hold-bed',
          playback: { kind: 'one-shot' },
          sources: [],
        },
      ],
    }).join('\n')

    expect(problems).toMatch(/unexpected field "surprise"/iu)
    expect(problems).toMatch(/schema is 2/iu)
    expect(problems).toMatch(/valid revision/iu)
    expect(problems).toMatch(/valid locale/iu)
    expect(problems).toMatch(/valid id/iu)
    expect(problems).toMatch(/non-packaged/iu)
    expect(problems).toMatch(/MIME/iu)
    expect(problems).toMatch(/SHA-256/iu)
    expect(problems).toMatch(/byte length/iu)
    expect(problems).toMatch(/sample rate/iu)
    expect(problems).toMatch(/channels/iu)
    expect(problems).toMatch(/loop end exceeds/iu)
    expect(problems).toMatch(/dialogue must use one-shot/iu)
    expect(problems).toMatch(/dialogue line id/iu)
    expect(problems).toMatch(/caption SHA-256/iu)
    expect(problems).toMatch(/at least one source/iu)
    expect(problems).toMatch(/hold bed must declare bounded loop/iu)
  })

  it('rejects duplicate semantic ids, source URLs and dialogue lines', () => {
    const dialogue = findAudioAsset(
      COMPLETE_MANIFEST,
      'dialogue.pull.scrolling.meet',
    )
    if (dialogue?.lane !== 'dialogue') {
      throw new Error('Expected the test dialogue asset.')
    }
    const problems = validateAudioAssetManifest({
      ...COMPLETE_MANIFEST,
      assets: [
        dialogue,
        {
          ...dialogue,
          sources: [
            {
              ...dialogue.sources[0],
              src: '/audio/voice/en/the-scroll/alternate.m4a',
            },
          ],
        },
        {
          ...dialogue,
          id: 'dialogue.pull.scrolling.alternate',
        },
      ],
    }).join('\n')

    expect(problems).toMatch(/declared more than once/iu)
    expect(problems).toMatch(/bound more than once/iu)
  })

  it('enumerates exact source references for static byte verification', () => {
    expect(referencedAudioSources(COMPLETE_MANIFEST)).toHaveLength(6)
    expect(referencedAudioSources(COMPLETE_MANIFEST)[0]).toMatchObject({
      assetId: 'dialogue.pull.scrolling.meet',
      lane: 'dialogue',
      sourceIndex: 0,
      source: { src: '/audio/voice/en/the-scroll/meet.m4a' },
    })
  })

  it('pins every packaged default byte declared by the manifest', () => {
    const root = packageRoot()

    for (const { source } of referencedAudioSources(
      DEFAULT_AUDIO_ASSET_MANIFEST,
    )) {
      const path = publicPath(root, source.src)
      expect(existsSync(path), source.src).toBe(true)
      const bytes = readFileSync(path)
      expect(bytes.byteLength, source.src).toBe(source.byteLength)
      expect(createHash('sha256').update(bytes).digest('hex'), source.src).toBe(
        source.sha256,
      )
    }
  })
})
