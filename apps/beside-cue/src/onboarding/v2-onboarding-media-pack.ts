// ============================================================
// V2 onboarding media pack — injectable, asset-optional Pull picture contract
// ============================================================
//
// A Pull may ship one beat at a time. Resolution refuses incomplete moving
// beats instead of inventing an unsafe fallback, while a complete Pull maps
// directly onto the presenter's deterministic recovery chain.

import type { V2OnboardingBrandResource, V2OnboardingLoadableResource, V2OnboardingMediaPresentationRequest, V2OnboardingStillResource, } from './v2-onboarding-media-presenter'

export type V2OnboardingPullMediaMoment = 'present' | 'hold' | 'recede' | 'end'

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
  readonly record?: V2OnboardingRecordMedia
  readonly pulls: Readonly<Record<string, V2OnboardingPullMedia | undefined>>
}

export interface V2OnboardingMediaTarget {
  readonly targetId: string
  readonly pullId: string
  readonly moment: V2OnboardingPullMediaMoment
}

const PREVIEW_ROOT = '/onboarding/corky-v2-preview/scrolling'

const TABLE_READY: V2OnboardingStillResource = Object.freeze({
  kind: 'still',
  src: `${PREVIEW_ROOT}/p02-table-ready-v0_1.webp`,
  alt: '',
})

const SCROLLING_SETTLED: V2OnboardingStillResource = Object.freeze({
  kind: 'still',
  src: `${PREVIEW_ROOT}/p03-scrolling-settled-v0_1.webp`,
  alt: '',
})

/** Preview delivery: only Endless scrolling has authored V2 picture. */
export const V2_ONBOARDING_PREVIEW_MEDIA_PACK: V2OnboardingMediaPack =
  Object.freeze({
    revision: 'corky-v2-preview-v0.2',
    brand: Object.freeze({ kind: 'brand', alt: '' }),
    poster: TABLE_READY,
    record: Object.freeze({ stoppedAuthority: TABLE_READY }),
    pulls: Object.freeze({
      scrolling: Object.freeze({
        present: Object.freeze({
          kind: 'video',
          src: `${PREVIEW_ROOT}/b03-scrolling-present-v0_1.mp4`,
          alt: '',
        }),
        hold: SCROLLING_SETTLED,
        recede: Object.freeze({
          kind: 'video',
          src: `${PREVIEW_ROOT}/b05-scrolling-recede-v0_1.mp4`,
          alt: '',
        }),
        end: TABLE_READY,
      }),
    }),
  })

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
