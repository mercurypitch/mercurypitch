// ============================================================
// Cinematic onboarding media tests — v0.4 package safeguards
// ============================================================

import { describe, expect, it } from 'vitest'
import type { CinematicOnboardingMediaManifest } from './cinematic-onboarding-media'
import { resolveCinematicOnboardingMedia, validateCinematicOnboardingMediaManifest, } from './cinematic-onboarding-media'
import { CINEMATIC_ONBOARDING_TIMELINE_V0_4 } from './cinematic-onboarding-timeline'

function mediaManifest(): CinematicOnboardingMediaManifest {
  const segments = Object.fromEntries(
    CINEMATIC_ONBOARDING_TIMELINE_V0_4.shots.flatMap((shot) =>
      shot.segments.map((segment) => {
        const stable = {
          poster: `/onboarding/${segment.id}.webp`,
          reducedStill: `/onboarding/${segment.id}-reduced.webp`,
          alt: `Stable scene for ${segment.id}`,
        }
        if (segment.kind === 'automatic') {
          return [
            segment.id,
            {
              ...stable,
              kind: 'automatic',
              video: `/onboarding/${segment.id}.mp4`,
            },
          ]
        }
        if (segment.kind === 'automatic_native_overlay') {
          return [segment.id, { ...stable, kind: 'automatic_native_overlay' }]
        }
        return [segment.id, { ...stable, kind: 'hold' }]
      }),
    ),
  ) as unknown as CinematicOnboardingMediaManifest['segments']

  return {
    revision: 'test-v0.4',
    sourceContractVersion: '0.4.0',
    sourceContractSha256: 'a'.repeat(64),
    audio: {
      kind: 'continuous_review_mix',
      src: '/onboarding/audio/review-mix-continuous-746f.m4a',
      sourceDurationFrames: 746,
      clockPolicy: 'pause_with_picture',
    },
    segments,
  }
}

describe('cinematic onboarding media', () => {
  it('uses one-shot video only for a normal moving beat', () => {
    expect(
      resolveCinematicOnboardingMedia(
        mediaManifest(),
        'S01_S02_AUTO_ENTRANCE_HELLO',
        'normal',
      ),
    ).toEqual({
      kind: 'video',
      src: '/onboarding/S01_S02_AUTO_ENTRANCE_HELLO.mp4',
      poster: '/onboarding/S01_S02_AUTO_ENTRANCE_HELLO.webp',
      alt: 'Stable scene for S01_S02_AUTO_ENTRANCE_HELLO',
    })
  })

  it('selects the authored still instead of every video in reduced mode', () => {
    expect(
      resolveCinematicOnboardingMedia(
        mediaManifest(),
        'S01_S02_AUTO_ENTRANCE_HELLO',
        'reduced',
      ),
    ).toEqual({
      kind: 'still',
      src: '/onboarding/S01_S02_AUTO_ENTRANCE_HELLO-reduced.webp',
      alt: 'Stable scene for S01_S02_AUTO_ENTRANCE_HELLO',
    })
  })

  it('resolves the H08 close as moving media only in normal mode', () => {
    const manifest = mediaManifest()

    expect(
      resolveCinematicOnboardingMedia(
        manifest,
        'S08_AUTO_TITLE_CLOSE',
        'normal',
      ),
    ).toEqual({
      kind: 'video',
      src: '/onboarding/S08_AUTO_TITLE_CLOSE.mp4',
      poster: '/onboarding/S08_AUTO_TITLE_CLOSE.webp',
      alt: 'Stable scene for S08_AUTO_TITLE_CLOSE',
    })
    expect(
      resolveCinematicOnboardingMedia(
        manifest,
        'S08_AUTO_TITLE_CLOSE',
        'reduced',
      ),
    ).toEqual({
      kind: 'still',
      src: '/onboarding/S08_AUTO_TITLE_CLOSE-reduced.webp',
      alt: 'Stable scene for S08_AUTO_TITLE_CLOSE',
    })
  })

  it('uses the final-state still and no fabricated video for a native overlay', () => {
    const manifest = mediaManifest()

    expect(
      resolveCinematicOnboardingMedia(
        manifest,
        'S04_AUTO_PULL_INTRO',
        'normal',
      ),
    ).toEqual({
      kind: 'still',
      src: '/onboarding/S04_AUTO_PULL_INTRO-reduced.webp',
      alt: 'Stable scene for S04_AUTO_PULL_INTRO',
    })
    expect('video' in manifest.segments.S04_AUTO_PULL_INTRO).toBe(false)
  })

  it('keeps a normal native interaction hold on the preceding final state', () => {
    expect(
      resolveCinematicOnboardingMedia(
        mediaManifest(),
        'S06_CONFIRM_AND_SAVE_PLAN_HOLD',
        'normal',
      ),
    ).toEqual({
      kind: 'still',
      src: '/onboarding/S06_CONFIRM_AND_SAVE_PLAN_HOLD-reduced.webp',
      alt: 'Stable scene for S06_CONFIRM_AND_SAVE_PLAN_HOLD',
    })
  })

  it('accepts the exact complete v0.4 manifest and continuous audio contract', () => {
    const manifest = mediaManifest()

    expect(validateCinematicOnboardingMediaManifest(manifest)).toEqual([])
    expect(manifest.audio).toEqual({
      kind: 'continuous_review_mix',
      src: '/onboarding/audio/review-mix-continuous-746f.m4a',
      sourceDurationFrames: 746,
      clockPolicy: 'pause_with_picture',
    })
  })

  it('rejects the old contract, wrong kinds, and a missing moving video', () => {
    const valid = mediaManifest()
    const invalid = {
      ...valid,
      sourceContractVersion: '0.2.0',
      segments: {
        ...valid.segments,
        S01_S02_AUTO_ENTRANCE_HELLO: {
          kind: 'hold',
          poster: '/onboarding/opening.webp',
          reducedStill: '/onboarding/opening-reduced.webp',
          alt: 'Opening',
        },
      },
    }

    const problems = validateCinematicOnboardingMediaManifest(invalid)

    expect(problems).toContain(
      'Media manifest targets timeline 0.2.0, not 0.4.0.',
    )
    expect(problems).toContain(
      'Media for "S01_S02_AUTO_ENTRANCE_HELLO" is hold, expected automatic.',
    )
    expect(problems).toContain(
      'Media for "S01_S02_AUTO_ENTRANCE_HELLO" has no video asset.',
    )
  })

  it('rejects videos and any other extra field on stable-only states', () => {
    const valid = mediaManifest()
    const invalid = {
      ...valid,
      extraTopLevel: true,
      segments: {
        ...valid.segments,
        S04_AUTO_PULL_INTRO: {
          ...valid.segments.S04_AUTO_PULL_INTRO,
          video: '/onboarding/fake-overlay.mp4',
        },
        S06_CONFIRM_AND_SAVE_PLAN_HOLD: {
          ...valid.segments.S06_CONFIRM_AND_SAVE_PLAN_HOLD,
          loop: true,
        },
      },
    }

    const problems = validateCinematicOnboardingMediaManifest(invalid)

    expect(problems).toContain(
      'Media manifest has unexpected field "extraTopLevel".',
    )
    expect(problems).toContain(
      'Media for "S04_AUTO_PULL_INTRO" has unexpected field "video".',
    )
    expect(problems).toContain(
      'Media for "S06_CONFIRM_AND_SAVE_PLAN_HOLD" has unexpected field "loop".',
    )
  })

  it('rejects unknown or missing segment records', () => {
    const valid = mediaManifest()
    const { S08_AUTO_TITLE_CLOSE: _missing, ...segments } = valid.segments
    const invalid = {
      ...valid,
      segments: {
        ...segments,
        UNKNOWN_STATE: valid.segments.S08_AUTO_TITLE_CLOSE,
      },
    }

    expect(
      validateCinematicOnboardingMediaManifest(invalid).join('\n'),
    ).toMatch(
      /unknown segment "UNKNOWN_STATE".*missing segment "S08_AUTO_TITLE_CLOSE"/isu,
    )
  })

  it('rejects a mismatched or incomplete continuous audio clock', () => {
    const valid = mediaManifest()
    const invalid = {
      ...valid,
      audio: {
        kind: 'stems',
        src: 'https://cdn.example/review.m4a',
        sourceDurationFrames: 624,
        clockPolicy: 'run_freely',
        gain: 1,
      },
    }

    expect(
      validateCinematicOnboardingMediaManifest(invalid).join('\n'),
    ).toMatch(
      /unexpected field "gain".*expected continuous_review_mix.*expected 746.*expected pause_with_picture.*non-packaged/isu,
    )
  })

  it('rejects remote, workstation, traversal, and malformed asset values', () => {
    for (const url of [
      '//cdn.example/opening.webp',
      'ftp://cdn.example/opening.webp',
      'data:image/webp;base64,abc',
      '/tmp/opening.webp',
      '/root/opening.webp',
      '/onboarding/../private.webp',
      '/onboarding/%2e%2e/private.webp',
    ]) {
      const valid = mediaManifest()
      const invalid = {
        ...valid,
        segments: {
          ...valid.segments,
          S01_S02_AUTO_ENTRANCE_HELLO: {
            ...valid.segments.S01_S02_AUTO_ENTRANCE_HELLO,
            poster: url,
          },
        },
      }

      expect(
        validateCinematicOnboardingMediaManifest(invalid).join('\n'),
      ).toMatch(/non-packaged asset URL/iu)
    }
  })

  it('rejects non-object and structurally malformed manifests', () => {
    expect(validateCinematicOnboardingMediaManifest(null)).toEqual([
      'Media manifest must be an object.',
    ])
    expect(
      validateCinematicOnboardingMediaManifest({
        revision: 2,
        sourceContractVersion: null,
        sourceContractSha256: false,
        audio: null,
        segments: null,
      }).join('\n'),
    ).toMatch(/revision.*timeline.*SHA-256.*audio.*segments/isu)
  })
})
