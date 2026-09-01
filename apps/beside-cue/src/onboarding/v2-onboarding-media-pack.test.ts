// ============================================================
// V2 onboarding media pack tests — authored target resolution
// ============================================================

import { describe, expect, it } from 'vitest'
import type { V2OnboardingMediaPack } from './v2-onboarding-media-pack'
import { resolveV2OnboardingMediaRequest, V2_ONBOARDING_PREVIEW_MEDIA_PACK, } from './v2-onboarding-media-pack'

const ROOT = '/onboarding/corky-v2-preview/scrolling'

describe('V2 onboarding media pack', () => {
  it('publishes the frozen Scroll resources and one shared record authority', () => {
    const pack = V2_ONBOARDING_PREVIEW_MEDIA_PACK

    expect(pack.revision).toBe('corky-v2-preview-v0.2')
    expect(Object.keys(pack.pulls)).toEqual(['scrolling'])
    expect(pack.poster?.src).toBe(`${ROOT}/p02-table-ready-v0_1.webp`)
    expect(pack.record?.stoppedAuthority).toEqual(pack.pulls.scrolling?.end)
    expect(pack.pulls.scrolling).toMatchObject({
      present: {
        kind: 'video',
        src: `${ROOT}/b03-scrolling-present-v0_1.mp4`,
      },
      hold: {
        kind: 'still',
        src: `${ROOT}/p03-scrolling-settled-v0_1.webp`,
      },
      recede: {
        kind: 'video',
        src: `${ROOT}/b05-scrolling-recede-v0_1.mp4`,
      },
      end: {
        kind: 'still',
        src: `${ROOT}/p02-table-ready-v0_1.webp`,
      },
    })
  })

  it.each([
    ['present', 'automatic', 'video', 'p03-scrolling-settled-v0_1.webp'],
    ['hold', 'hold', 'still', 'p03-scrolling-settled-v0_1.webp'],
    ['recede', 'automatic', 'video', 'p02-table-ready-v0_1.webp'],
    ['end', 'hold', 'still', 'p02-table-ready-v0_1.webp'],
  ] as const)(
    'maps the %s moment onto its primary and authored reduced-motion still',
    (moment, targetKind, primaryKind, reducedSuffix) => {
      const request = resolveV2OnboardingMediaRequest(
        V2_ONBOARDING_PREVIEW_MEDIA_PACK,
        { targetId: `scrolling:${moment}`, pullId: 'scrolling', moment },
      )

      expect(request).toMatchObject({
        targetId: `scrolling:${moment}`,
        targetKind,
        primary: { kind: primaryKind },
        reducedStill: { src: `${ROOT}/${reducedSuffix}` },
        poster: { src: `${ROOT}/p02-table-ready-v0_1.webp` },
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
