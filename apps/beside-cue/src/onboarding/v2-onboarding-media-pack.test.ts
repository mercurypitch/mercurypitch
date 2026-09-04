// ============================================================
// V2 onboarding media pack tests — authored target resolution
// ============================================================

import { describe, expect, it } from 'vitest'
import type { V2OnboardingMediaPack } from './v2-onboarding-media-pack'
import { resolveV2OnboardingMediaRequest, resolveV2OnboardingPlateMediaRequest, resolveV2OnboardingRecordMediaRequest, resolveV2OnboardingSceneMediaRequest, V2_ONBOARDING_MEDIA_PACK, } from './v2-onboarding-media-pack'

const BASE_ROOT = '/onboarding/corky-v2.4'
const V2_5_ROOT = '/onboarding/corky-v2.5'

describe('V2 onboarding media pack', () => {
  it('publishes the V2.5 intro and record performances over one P02 authority', () => {
    const pack = V2_ONBOARDING_MEDIA_PACK

    expect(pack.revision).toBe('corky-v2.5-media-v1')
    expect(Object.keys(pack.pulls)).toEqual([
      'scrolling',
      'snacking',
      'avoidance',
    ])
    expect(pack.poster?.src).toBe(
      `${BASE_ROOT}/stills/p02-table-ready-v0_17.webp`,
    )
    expect(pack.record?.stoppedAuthority).toEqual(pack.pulls.scrolling?.end)
    expect(pack.plate).toEqual(pack.record?.stoppedAuthority)
    expect(pack.scenes).toMatchObject({
      'corky-reveal': {
        primary: {
          kind: 'video',
          src: `${V2_5_ROOT}/picture/b01-corky-greeting-direct-to-p02-v0_1.mp4`,
        },
        reducedStill: {
          src: `${BASE_ROOT}/stills/p02-table-ready-v0_17.webp`,
        },
      },
      'table-reveal': {
        primary: {
          kind: 'video',
          src: `${BASE_ROOT}/picture/b02-table-reveal-v0_1.mp4`,
        },
        reducedStill: {
          src: `${BASE_ROOT}/stills/p02-table-ready-v0_17.webp`,
        },
      },
    })
    expect(pack.record).toMatchObject({
      start: {
        kind: 'video',
        src: `${V2_5_ROOT}/picture/b06-corky-starts-record-v0_1.mp4`,
      },
      spin: {
        kind: 'video',
        src: `${V2_5_ROOT}/picture/b06-whole-vinyl-spin-v0_1.mp4`,
      },
      stoppedAuthority: {
        kind: 'still',
        src: `${BASE_ROOT}/stills/p02-table-ready-v0_17.webp`,
      },
    })
    expect(pack.pulls.scrolling).toMatchObject({
      present: {
        kind: 'video',
        src: `${BASE_ROOT}/picture/b03-scrolling-present-v0_2.mp4`,
      },
      hold: {
        kind: 'still',
        src: `${BASE_ROOT}/stills/p03-scrolling-settled-v0_2.webp`,
      },
      recede: {
        kind: 'video',
        src: `${BASE_ROOT}/picture/b05-scrolling-recede-v0_2.mp4`,
      },
      end: {
        kind: 'still',
        src: `${BASE_ROOT}/stills/p02-table-ready-v0_17.webp`,
      },
    })
  })

  it.each([
    ['corky-reveal', 'b01-corky-greeting-direct-to-p02-v0_1.mp4'],
    ['table-reveal', 'b02-table-reveal-v0_1.mp4'],
  ] as const)('resolves the %s scene as automatic media', (sceneId, suffix) => {
    const root = sceneId === 'corky-reveal' ? V2_5_ROOT : BASE_ROOT
    expect(
      resolveV2OnboardingSceneMediaRequest(V2_ONBOARDING_MEDIA_PACK, {
        targetId: `intro:${sceneId}`,
        sceneId,
      }),
    ).toMatchObject({
      targetId: `intro:${sceneId}`,
      targetKind: 'automatic',
      primary: { kind: 'video', src: `${root}/picture/${suffix}` },
    })
  })

  it.each([
    ['start', 'automatic', 'b06-corky-starts-record-v0_1.mp4'],
    ['spin', 'hold', 'b06-whole-vinyl-spin-v0_1.mp4'],
  ] as const)(
    'resolves the record %s movie with the P02 reduced-motion and poster fallback',
    (moment, targetKind, filename) => {
      expect(
        resolveV2OnboardingRecordMediaRequest(V2_ONBOARDING_MEDIA_PACK, {
          targetId: `record:${moment}`,
          moment,
        }),
      ).toMatchObject({
        targetId: `record:${moment}`,
        targetKind,
        primary: {
          kind: 'video',
          src: `${V2_5_ROOT}/picture/${filename}`,
        },
        reducedStill: {
          kind: 'still',
          src: `${BASE_ROOT}/stills/p02-table-ready-v0_17.webp`,
        },
        poster: {
          kind: 'still',
          src: `${BASE_ROOT}/stills/p02-table-ready-v0_17.webp`,
        },
      })
    },
  )

  it.each([
    ['scrolling', 'v0_2', 'v0_2'],
    ['snacking', 'v0_3', 'v0_4'],
    ['avoidance', 'v0_1', 'v0_1'],
  ] as const)(
    'maps the complete %s enter, shared hold, exit, and P02 endpoint',
    (pullId, presentVersion, recedeVersion) => {
      const pull = V2_ONBOARDING_MEDIA_PACK.pulls[pullId]
      expect(pull).toBeDefined()
      expect(pull?.present).toMatchObject({
        kind: 'video',
        src: `${BASE_ROOT}/picture/b03-${pullId}-present-${presentVersion}.mp4`,
      })
      expect(pull?.hold).toMatchObject({
        kind: 'still',
        src: expect.stringContaining(`/p03-${pullId}-settled-`),
      })
      expect(pull?.recede).toMatchObject({
        kind: 'video',
        src: `${BASE_ROOT}/picture/b05-${pullId}-recede-${recedeVersion}.mp4`,
      })
      expect(pull?.end).toEqual(
        V2_ONBOARDING_MEDIA_PACK.record?.stoppedAuthority,
      )
    },
  )

  it('resolves one stable P02 request for choices and unauthored Pulls', () => {
    expect(
      resolveV2OnboardingPlateMediaRequest(V2_ONBOARDING_MEDIA_PACK),
    ).toMatchObject({
      targetId: 'plate:p02',
      targetKind: 'hold',
      primary: {
        kind: 'still',
        src: `${BASE_ROOT}/stills/p02-table-ready-v0_17.webp`,
      },
    })
  })

  it.each([
    ['present', 'automatic', 'video', 'p03-scrolling-settled-v0_2.webp'],
    ['hold', 'hold', 'still', 'p03-scrolling-settled-v0_2.webp'],
    ['recede', 'automatic', 'video', 'p02-table-ready-v0_17.webp'],
    ['end', 'hold', 'still', 'p02-table-ready-v0_17.webp'],
  ] as const)(
    'maps the %s moment onto its primary and authored reduced-motion still',
    (moment, targetKind, primaryKind, reducedSuffix) => {
      const request = resolveV2OnboardingMediaRequest(
        V2_ONBOARDING_MEDIA_PACK,
        { targetId: `scrolling:${moment}`, pullId: 'scrolling', moment },
      )

      expect(request).toMatchObject({
        targetId: `scrolling:${moment}`,
        targetKind,
        primary: { kind: primaryKind },
        reducedStill: { src: `${BASE_ROOT}/stills/${reducedSuffix}` },
        poster: {
          src: `${BASE_ROOT}/stills/p02-table-ready-v0_17.webp`,
        },
      })
    },
  )

  it('declines missing Pulls and moving beats without a still fallback', () => {
    const incompletePack: V2OnboardingMediaPack = {
      revision: 'incomplete',
      brand: { kind: 'brand', alt: '' },
      pulls: {
        custom: {
          present: { kind: 'video', src: '/custom.mp4', alt: '' },
        },
      },
    }

    expect(
      resolveV2OnboardingMediaRequest(incompletePack, {
        targetId: 'missing:present',
        pullId: 'missing',
        moment: 'present',
      }),
    ).toBeUndefined()
    expect(
      resolveV2OnboardingMediaRequest(incompletePack, {
        targetId: 'custom:present',
        pullId: 'custom',
        moment: 'present',
      }),
    ).toBeUndefined()
  })
})
