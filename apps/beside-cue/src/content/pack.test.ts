import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { assetUrls } from './assets'
import type { AudioAssetManifest, AudioSourceVariant } from './audio-manifest'
import { MOMENTS } from './moments'
import { CHARACTER_STATES, DEFAULT_CONTENT_PACK, findCharacter, findCueEntity, findLine, findPullCharacter, GENERIC_PULL_CHARACTER, validateContentPack, } from './pack'
import { pullOptions } from './pulls'
import { V2_ONBOARDING_AUDIO_ASSET_MANIFEST } from './v2-onboarding-audio-manifest'
import { CANONICAL_VOICE_LINES } from './voice-lines'

const RECORDED_LINE = CANONICAL_VOICE_LINES[0]
const VALID_SOURCE: AudioSourceVariant = {
  src: `/audio/voice/en/corky/${RECORDED_LINE.fileStem}.m4a`,
  mimeType: 'audio/mp4; codecs="mp4a.40.2"',
  sha256: 'a'.repeat(64),
  byteLength: 12_345,
  durationMs: 1_800,
  sampleRateHz: 48_000,
  channels: 1,
}

function manifestWithRecording(
  source: AudioSourceVariant = VALID_SOURCE,
  captionSha256: string = RECORDED_LINE.captionSha256,
): AudioAssetManifest {
  return {
    schemaVersion: 1,
    revision: 'beside-cue-audio-pack-test-v1',
    locale: 'en',
    assets: [
      {
        id: `dialogue.${RECORDED_LINE.id}`,
        lane: 'dialogue',
        playback: { kind: 'one-shot' },
        dialogue: {
          lineId: RECORDED_LINE.id,
          captionSha256,
        },
        sources: [source],
      },
    ],
  }
}

describe('content pack', () => {
  it('ships the exact canonical V2 registry with its approved audio layer', () => {
    expect(DEFAULT_CONTENT_PACK.version).toBe('0.6.0')
    expect(DEFAULT_CONTENT_PACK.lines.slice(0, 43)).toEqual(
      CANONICAL_VOICE_LINES,
    )
    expect(DEFAULT_CONTENT_PACK.lines).toHaveLength(67)
    expect(
      DEFAULT_CONTENT_PACK.lines
        .slice(43)
        .every((line) => line.captionSha256 === undefined),
    ).toBe(true)
    expect(DEFAULT_CONTENT_PACK.audio).toBe(V2_ONBOARDING_AUDIO_ASSET_MANIFEST)
    expect(DEFAULT_CONTENT_PACK.audio.assets).toHaveLength(4)
    expect(validateContentPack(DEFAULT_CONTENT_PACK)).toEqual([])
  })

  it('accepts a future descriptor bound to one exact canonical caption', () => {
    const pack = {
      ...DEFAULT_CONTENT_PACK,
      audio: manifestWithRecording(),
    }

    expect(validateContentPack(pack)).toEqual([])
  })

  it('rejects a structurally valid recording with a stale caption binding', () => {
    const problems = validateContentPack({
      ...DEFAULT_CONTENT_PACK,
      audio: manifestWithRecording(VALID_SOURCE, 'b'.repeat(64)),
    })

    expect(problems.join('\n')).toMatch(/not bound to a line/iu)
  })

  it('surfaces delivery-byte faults from an otherwise bound descriptor', () => {
    const problems = validateContentPack({
      ...DEFAULT_CONTENT_PACK,
      audio: manifestWithRecording({
        ...VALID_SOURCE,
        src: 'https://provider.test/corky.m4a',
        sha256: 'not-a-hash',
        durationMs: 0,
      }),
    }).join('\n')

    expect(problems).toMatch(/non-packaged source URL/iu)
    expect(problems).toMatch(/lowercase SHA-256/iu)
    expect(problems).toMatch(/duration must be a finite positive number/iu)
  })

  it('gives the lead character every state the app can ask for', () => {
    const corky = findCharacter(DEFAULT_CONTENT_PACK, 'corky')

    expect(corky).toBeDefined()
    for (const state of CHARACTER_STATES) {
      expect(corky?.states[state].still).toMatch(/\.webp$/u)
      expect(corky?.states[state].alt.length).toBeGreaterThan(0)
    }
  })

  it('gives every built-in Pull its own character', () => {
    // A custom Pull deliberately has none; the built-in six must not.
    for (const option of pullOptions) {
      expect(findPullCharacter(DEFAULT_CONTENT_PACK, option.id)).toBeDefined()
    }
  })

  it('has no authored character for a custom Pull', () => {
    expect(findPullCharacter(DEFAULT_CONTENT_PACK, 'custom')).toBeUndefined()
    expect(findPullCharacter(DEFAULT_CONTENT_PACK, undefined)).toBeUndefined()
  })

  it('keeps the V1 cue-entity API as an alias', () => {
    expect(DEFAULT_CONTENT_PACK.cueEntities).toBe(
      DEFAULT_CONTENT_PACK.pullCharacters,
    )
    expect(findCueEntity(DEFAULT_CONTENT_PACK, 'snacking')).toBe(
      findPullCharacter(DEFAULT_CONTENT_PACK, 'snacking'),
    )
  })

  it('defines every line that a moment references', () => {
    // This is the check that stops a content edit from throwing at runtime:
    // `resolveMoment` trusts the pack, and this is why it can.
    for (const definition of Object.values(MOMENTS)) {
      expect(definition.lineIds.length).toBeGreaterThan(0)
      for (const lineId of definition.lineIds) {
        expect(
          findLine(DEFAULT_CONTENT_PACK, lineId),
          `moment "${definition.id}" references missing line "${lineId}"`,
        ).toBeDefined()
      }
    }
  })

  it('defines the exact Meet caption for every built-in Pull preview', () => {
    for (const option of pullOptions) {
      expect(
        findLine(DEFAULT_CONTENT_PACK, option.previewLineId),
        `Pull "${option.id}" references missing preview line "${option.previewLineId}"`,
      ).toBeDefined()
    }
  })

  it('reports every fault at once rather than the first', () => {
    const invalidPullCharacters = [
      ...DEFAULT_CONTENT_PACK.pullCharacters,
      {
        id: 'not-a-pull',
        name: 'Ghost',
        token: { still: '/x.webp', alt: '' },
        noticeOverlay: { still: '/y.webp', alt: '' },
        voiceNote: '',
      },
    ]
    const problems = validateContentPack({
      ...DEFAULT_CONTENT_PACK,
      leadCharacterId: 'nobody',
      pullCharacters: invalidPullCharacters,
      cueEntities: invalidPullCharacters,
      lines: [
        ...DEFAULT_CONTENT_PACK.lines,
        { id: 'corky.onboarding.greeting', text: 'Duplicate.' },
      ],
    })

    expect(problems).toHaveLength(4)
    expect(problems.join('\n')).toMatch(/nobody/u)
    expect(problems.join('\n')).toMatch(/not-a-pull/u)
    expect(problems.join('\n')).toMatch(/declared twice/u)
  })

  it('points every asset slot at a file that exists', () => {
    // The URLs are built from template literals, so nothing catches a renamed
    // or missing render until a screen shows a broken image on a device. This
    // does, at test time, for every tier of every slot.
    // Vitest roots at the package directory. Asserting that first means a
    // wrong root fails as "no public directory" rather than as every asset
    // being missing at once.
    const publicDir = `${process.cwd()}/public`
    expect(existsSync(publicDir), `no public directory at ${publicDir}`).toBe(
      true,
    )
    const slots = [
      ...DEFAULT_CONTENT_PACK.characters.flatMap((character) =>
        CHARACTER_STATES.map((state) => character.states[state]),
      ),
      ...[
        ...DEFAULT_CONTENT_PACK.pullCharacters,
        GENERIC_PULL_CHARACTER,
      ].flatMap((pullCharacter) => [
        pullCharacter.token,
        pullCharacter.noticeOverlay,
      ]),
    ]

    const missing = slots
      .flatMap((slot) => assetUrls(slot))
      // `BASE_URL` is the app's mount point; on disk everything sits under
      // `public`, so strip the leading slash and join.
      .map((url) => ({ url, path: `${publicDir}/${url.replace(/^\/+/u, '')}` }))
      .filter((entry) => !existsSync(entry.path))
      .map((entry) => entry.url)

    expect(missing).toEqual([])
    expect(slots.length).toBeGreaterThan(0)
  })

  it('uses the approved versioned Pull studies with literal descriptions', () => {
    for (const pullCharacter of DEFAULT_CONTENT_PACK.pullCharacters) {
      expect(pullCharacter.token.still).toMatch(
        pullCharacter.noticeLayout === 'token'
          ? /[/]onboarding[/]pull-expansion-v1[/]the-.+-token-v0_1[.]webp$/u
          : /[/]art[/]pulls[/]pull-.+-nanobanana-v0_1-512[.]webp$/u,
      )
      expect(pullCharacter.token.alt).toMatch(
        new RegExp(`^${pullCharacter.name}`, 'u'),
      )
      expect(pullCharacter.token.alt).not.toMatch(/standing in|placeholder/iu)
    }
  })

  it('keeps every user-facing cue description broad and neutral', () => {
    const publicCopy = [
      ...pullOptions.flatMap((option) => [
        option.label,
        option.moment,
        ...option.suggestions,
      ]),
      ...DEFAULT_CONTENT_PACK.pullCharacters.flatMap((character) => [
        character.name,
        character.token.alt,
        character.voiceNote,
      ]),
    ].join('\n')

    expect(publicCopy).not.toMatch(/alcohol|smok|vap|takeaway/iu)
  })

  it('maps unpublished legacy pull ids to the neutral cast', () => {
    expect(findPullCharacter(DEFAULT_CONTENT_PACK, 'alcohol-ritual')?.id).toBe(
      'familiar-ritual',
    )
    expect(findPullCharacter(DEFAULT_CONTENT_PACK, 'smoking-vaping')?.id).toBe(
      'two-minute-pause',
    )
    expect(findPullCharacter(DEFAULT_CONTENT_PACK, 'takeaway')?.id).toBe(
      'one-tap-convenience',
    )
  })

  it('keeps spoken character lines free of sensitive legacy interpretations', () => {
    // Pull characters may name themselves after a deliberate in-app selection,
    // but neutral V2 profiles must never reveal the unpublished substance- or
    // purchase-specific interpretations that used to sit behind three ids.
    const pullWords = /alcohol|smok|vap|takeaway/iu
    for (const line of DEFAULT_CONTENT_PACK.lines) {
      expect(line.text, `line "${line.id}" names a pull`).not.toMatch(pullWords)
    }
  })
})
