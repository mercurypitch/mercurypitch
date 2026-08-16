// ============================================================
// Cinematic onboarding media tests — Phase-5 package safeguards
// ============================================================

import { describe, expect, it } from 'vitest'
import type { CinematicOnboardingMediaManifest } from './cinematic-onboarding-media'
import { resolveCinematicOnboardingMedia, validateCinematicOnboardingMediaManifest, } from './cinematic-onboarding-media'
import { CINEMATIC_ONBOARDING_TIMELINE_V0_2 } from './cinematic-onboarding-timeline'

function mediaManifest(): CinematicOnboardingMediaManifest {
  const segments = Object.fromEntries(
    CINEMATIC_ONBOARDING_TIMELINE_V0_2.shots.flatMap((shot) =>
      shot.segments.map((segment) => [
        segment.id,
        segment.kind === 'automatic'
          ? {
              kind: 'automatic',
              poster: `/onboarding/${segment.id}.webp`,
              reducedStill: `/onboarding/${segment.id}-reduced.webp`,
              video: `/onboarding/${segment.id}.mp4`,
              alt: `Stable scene for ${segment.id}`,
            }
          : {
              kind: 'hold',
              poster: `/onboarding/${segment.id}.webp`,
              reducedStill: `/onboarding/${segment.id}-reduced.webp`,
              alt: `Stable scene for ${segment.id}`,
            },
      ]),
    ),
  ) as unknown as CinematicOnboardingMediaManifest['segments']

  return {
    revision: 'test-v0.2',
    sourceContractVersion: '0.2.0',
    sourceContractSha256: 'a'.repeat(64),
    segments,
  }
}

describe('cinematic onboarding media', () => {
  it('uses one-shot video only for a normal automatic beat', () => {
    expect(
      resolveCinematicOnboardingMedia(
        mediaManifest(),
        'S02_AUTO_HELLO',
        'normal',
      ),
    ).toEqual({
      kind: 'video',
      src: '/onboarding/S02_AUTO_HELLO.mp4',
      poster: '/onboarding/S02_AUTO_HELLO.webp',
      alt: 'Stable scene for S02_AUTO_HELLO',
    })
  })

  it('never selects video in reduced mode', () => {
    expect(
      resolveCinematicOnboardingMedia(
        mediaManifest(),
        'S02_AUTO_HELLO',
        'reduced',
      ),
    ).toEqual({
      kind: 'still',
      src: '/onboarding/S02_AUTO_HELLO-reduced.webp',
      alt: 'Stable scene for S02_AUTO_HELLO',
    })
  })

  it('keeps a native interaction hold on its stable scene', () => {
    expect(
      resolveCinematicOnboardingMedia(
        mediaManifest(),
        'S06_SIM_USER_SPIN_STOP_HOLD',
        'normal',
      ).kind,
    ).toBe('still')
  })

  it('accepts only a complete, portable manifest that matches segment kinds', () => {
    expect(validateCinematicOnboardingMediaManifest(mediaManifest())).toEqual(
      [],
    )

    const valid = mediaManifest()
    const invalid = {
      ...valid,
      sourceContractSha256: 'not-a-sha',
      segments: {
        ...valid.segments,
        S01_AUTO_ENTER: {
          kind: 'hold',
          poster: 'file:///tmp/opening.webp',
          reducedStill: '/home/person/opening.webp',
          alt: '',
        },
      },
    } as unknown as CinematicOnboardingMediaManifest

    expect(
      validateCinematicOnboardingMediaManifest(invalid).join('\n'),
    ).toMatch(
      /SHA-256.*S01_AUTO_ENTER.*expected automatic.*description.*non-packaged/isu,
    )
  })

  it('rejects remote, workstation, traversal, and malformed manifest values', () => {
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
          S01_AUTO_ENTER: {
            ...valid.segments.S01_AUTO_ENTER,
            poster: url,
          },
        },
      }

      expect(
        validateCinematicOnboardingMediaManifest(invalid).join('\n'),
      ).toMatch(/non-packaged asset URL/iu)
    }

    expect(validateCinematicOnboardingMediaManifest(null)).toEqual([
      'Media manifest must be an object.',
    ])
    expect(
      validateCinematicOnboardingMediaManifest({
        revision: 2,
        sourceContractVersion: null,
        sourceContractSha256: false,
        segments: { S01_AUTO_ENTER: null },
      }).join('\n'),
    ).toMatch(/revision.*timeline.*SHA-256.*missing/isu)
  })
})
