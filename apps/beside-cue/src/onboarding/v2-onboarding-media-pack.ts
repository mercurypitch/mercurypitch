// ============================================================
// V2 onboarding media pack — injectable, asset-optional Pull picture contract
// ============================================================
//
// A Pull may ship one beat at a time. Resolution refuses incomplete moving
// beats instead of inventing an unsafe fallback, while a complete Pull maps
// directly onto the presenter's deterministic recovery chain.

import type { V2OnboardingBrandResource, V2OnboardingLoadableResource, V2OnboardingMediaPresentationRequest, V2OnboardingStillResource, } from './v2-onboarding-media-presenter'

export type V2OnboardingPullMediaMoment = 'present' | 'hold' | 'recede' | 'end'
export type V2OnboardingSceneMediaId = 'corky-reveal' | 'table-reveal'

export interface V2OnboardingSceneMedia {
  readonly primary: V2OnboardingLoadableResource
  readonly reducedStill: V2OnboardingStillResource
  readonly poster: V2OnboardingStillResource
}

export interface V2OnboardingPullMedia {
  readonly present?: V2OnboardingLoadableResource
  readonly hold?: V2OnboardingLoadableResource
  readonly recede?: V2OnboardingLoadableResource
  readonly end?: V2OnboardingLoadableResource
}

export interface V2OnboardingRecordMedia {
  /** Exact stopped plate beneath the deterministic native platter layer. */
  readonly stoppedAuthority: V2OnboardingStillResource
}

export interface V2OnboardingMediaPack {
  readonly revision: string
  readonly brand: V2OnboardingBrandResource
  readonly poster?: V2OnboardingStillResource
  readonly plate?: V2OnboardingStillResource
  readonly scenes?: Readonly<
    Partial<Record<V2OnboardingSceneMediaId, V2OnboardingSceneMedia>>
  >
  readonly record?: V2OnboardingRecordMedia
  readonly pulls: Readonly<Record<string, V2OnboardingPullMedia | undefined>>
}

export interface V2OnboardingMediaTarget {
  readonly targetId: string
  readonly pullId: string
  readonly moment: V2OnboardingPullMediaMoment
}

const PREVIEW_ROOT = '/onboarding/corky-v2.4'

const EMPTY_SET: V2OnboardingStillResource = Object.freeze({
  kind: 'still',
  src: `${PREVIEW_ROOT}/stills/p00-set-empty-v0_1.webp`,
  alt: '',
})

const CORKY_REST: V2OnboardingStillResource = Object.freeze({
  kind: 'still',
  src: `${PREVIEW_ROOT}/stills/p01-corky-rest-v0_4.webp`,
  alt: '',
})

const TABLE_READY: V2OnboardingStillResource = Object.freeze({
  kind: 'still',
  src: `${PREVIEW_ROOT}/stills/p02-table-ready-v0_17.webp`,
  alt: '',
})

const SCROLLING_SETTLED: V2OnboardingStillResource = Object.freeze({
  kind: 'still',
  src: `${PREVIEW_ROOT}/stills/p03-scrolling-settled-v0_2.webp`,
  alt: '',
})

const SNACKING_SETTLED: V2OnboardingStillResource = Object.freeze({
  kind: 'still',
  src: `${PREVIEW_ROOT}/stills/p03-snacking-settled-v0_3.webp`,
  alt: '',
})

const AVOIDANCE_SETTLED: V2OnboardingStillResource = Object.freeze({
  kind: 'still',
  src: `${PREVIEW_ROOT}/stills/p03-avoidance-settled-v0_1.webp`,
  alt: '',
})

/** Founder-approved V2.4 scene pack for the explicit PR Android preview. */
export const V2_ONBOARDING_PREVIEW_MEDIA_PACK: V2OnboardingMediaPack =
  Object.freeze({
    revision: 'corky-v2.4-preview-v1',
    brand: Object.freeze({ kind: 'brand', alt: '' }),
    poster: TABLE_READY,
    plate: TABLE_READY,
    scenes: Object.freeze({
      'corky-reveal': Object.freeze({
        primary: Object.freeze({
          kind: 'video',
          src: `${PREVIEW_ROOT}/picture/b01-corky-reveal-v0_2.mp4`,
          alt: '',
        }),
        reducedStill: CORKY_REST,
        poster: EMPTY_SET,
      }),
      'table-reveal': Object.freeze({
        primary: Object.freeze({
          kind: 'video',
          src: `${PREVIEW_ROOT}/picture/b02-table-reveal-v0_1.mp4`,
          alt: '',
        }),
        reducedStill: TABLE_READY,
        poster: CORKY_REST,
      }),
    }),
    record: Object.freeze({ stoppedAuthority: TABLE_READY }),
    pulls: Object.freeze({
      scrolling: Object.freeze({
        present: Object.freeze({
          kind: 'video',
          src: `${PREVIEW_ROOT}/picture/b03-scrolling-present-v0_2.mp4`,
          alt: '',
        }),
        hold: SCROLLING_SETTLED,
        recede: Object.freeze({
          kind: 'video',
          src: `${PREVIEW_ROOT}/picture/b05-scrolling-recede-v0_2.mp4`,
          alt: '',
        }),
        end: TABLE_READY,
      }),
      snacking: Object.freeze({
        present: Object.freeze({
          kind: 'video',
          src: `${PREVIEW_ROOT}/picture/b03-snacking-present-v0_3.mp4`,
          alt: '',
        }),
        hold: SNACKING_SETTLED,
        recede: Object.freeze({
          kind: 'video',
          src: `${PREVIEW_ROOT}/picture/b05-snacking-recede-v0_4.mp4`,
          alt: '',
        }),
        end: TABLE_READY,
      }),
      avoidance: Object.freeze({
        present: Object.freeze({
          kind: 'video',
          src: `${PREVIEW_ROOT}/picture/b03-avoidance-present-v0_1.mp4`,
          alt: '',
        }),
        hold: AVOIDANCE_SETTLED,
        recede: Object.freeze({
          kind: 'video',
          src: `${PREVIEW_ROOT}/picture/b05-avoidance-recede-v0_1.mp4`,
          alt: '',
        }),
        end: TABLE_READY,
      }),
    }),
  })

export function resolveV2OnboardingSceneMediaRequest(
  pack: V2OnboardingMediaPack,
  target: {
    readonly targetId: string
    readonly sceneId: V2OnboardingSceneMediaId
  },
): V2OnboardingMediaPresentationRequest | undefined {
  const scene = pack.scenes?.[target.sceneId]
  if (scene === undefined) return undefined
  return {
    targetId: target.targetId,
    targetKind: 'automatic',
    primary: scene.primary,
    reducedStill: scene.reducedStill,
    poster: scene.poster,
    brand: pack.brand,
  }
}

export function resolveV2OnboardingPlateMediaRequest(
  pack: V2OnboardingMediaPack,
): V2OnboardingMediaPresentationRequest | undefined {
  const plate = pack.plate ?? pack.record?.stoppedAuthority ?? pack.poster
  if (plate === undefined) return undefined
  return {
    targetId: 'plate:p02',
    targetKind: 'hold',
    primary: plate,
    reducedStill: plate,
    poster: plate,
    brand: pack.brand,
  }
}

function stillResource(
  resource: V2OnboardingLoadableResource | undefined,
): V2OnboardingStillResource | undefined {
  return resource?.kind === 'still' ? resource : undefined
}

function reducedStillFor(
  pull: V2OnboardingPullMedia,
  moment: V2OnboardingPullMediaMoment,
): V2OnboardingStillResource | undefined {
  const primary = pull[moment]
  const primaryStill = stillResource(primary)
  if (primaryStill !== undefined) return primaryStill

  if (moment === 'present') {
    return stillResource(pull.hold) ?? stillResource(pull.end)
  }
  if (moment === 'recede') {
    return stillResource(pull.end) ?? stillResource(pull.hold)
  }
  return undefined
}

/**
 * Resolves only authored targets. Missing Pulls or incomplete moving beats
 * return undefined so the native Director can retain its current visual.
 */
export function resolveV2OnboardingMediaRequest(
  pack: V2OnboardingMediaPack,
  target: V2OnboardingMediaTarget,
): V2OnboardingMediaPresentationRequest | undefined {
  const pull = pack.pulls[target.pullId]
  const primary = pull?.[target.moment]
  if (pull === undefined || primary === undefined) return undefined

  const reducedStill = reducedStillFor(pull, target.moment)
  const poster = pack.poster ?? reducedStill
  if (reducedStill === undefined || poster === undefined) return undefined

  return {
    targetId: target.targetId,
    targetKind:
      target.moment === 'present' || target.moment === 'recede'
        ? 'automatic'
        : 'hold',
    primary,
    reducedStill,
    poster,
    brand: pack.brand,
  }
}
