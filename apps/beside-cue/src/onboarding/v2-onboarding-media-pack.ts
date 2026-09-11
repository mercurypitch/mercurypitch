// ============================================================
// V2 onboarding media pack — injectable, asset-optional Pull picture contract
// ============================================================
//
// A Pull may ship one beat at a time. Resolution refuses incomplete moving
// beats instead of inventing an unsafe fallback, while a complete Pull maps
// directly onto the presenter's deterministic recovery chain. A Pull whose
// clips are defective can be held: they stay packaged, but its moving beats
// resolve to their authored stills (see V2_ONBOARDING_PULL_MOTION_HOLDS).

import { PREMIUM_PULL_IDS } from '@/content/premium-pulls'
import type { V2OnboardingBrandResource, V2OnboardingLoadableResource, V2OnboardingMediaPresentationRequest, V2OnboardingStillResource, } from './v2-onboarding-media-presenter'

export type V2OnboardingPullMediaMoment = 'present' | 'hold' | 'recede' | 'end'
export type V2OnboardingSceneMediaId = 'corky-reveal' | 'table-reveal'
export type V2OnboardingRecordMediaMoment = 'start' | 'spin'

export interface V2OnboardingSceneMedia {
  readonly primary: V2OnboardingLoadableResource
  readonly reducedStill: V2OnboardingStillResource
  readonly poster: V2OnboardingStillResource
}

export interface V2OnboardingPullMotionHold {
  /** The confirmed defect, so whoever lifts the hold knows what was repaired. */
  readonly defect: string
  /** ISO date the defect was confirmed. */
  readonly since: string
}

export interface V2OnboardingPullMedia {
  readonly present?: V2OnboardingLoadableResource
  readonly hold?: V2OnboardingLoadableResource
  readonly recede?: V2OnboardingLoadableResource
  readonly end?: V2OnboardingLoadableResource
  /**
   * Keeps a defective present and recede clip off every screen. The clips stay
   * registered and packaged; resolution substitutes the beat's authored still,
   * exactly as reduced motion already does, so the Director completes the beat
   * on its dwell and dialogue gates alone and the flow never stalls.
   */
  readonly motionHold?: V2OnboardingPullMotionHold
}

export interface V2OnboardingRecordMedia {
  /** Corky's complete, one-shot physical button press. */
  readonly start: V2OnboardingLoadableResource
  /** Founder-approved finite standing-spin shot before the native hold. */
  readonly spin: V2OnboardingLoadableResource
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

const MEDIA_ROOT = '/onboarding/corky-v2.4'
const V2_5_MEDIA_ROOT = '/onboarding/corky-v2.5'
const EXPANSION_ROOT = '/onboarding/pull-expansion-v1'

/** Pulls whose enter and recede movies come from the expansion delivery. */
const EXPANSION_PULL_IDS = [
  'familiar-ritual',
  'two-minute-pause',
  'one-tap-convenience',
  ...PREMIUM_PULL_IDS,
] as const

type ExpansionPullId = (typeof EXPANSION_PULL_IDS)[number]

/**
 * Expansion Pulls whose moving beats must not reach a person's screen. Lift a
 * hold by deleting its entry once repaired clips are staged under a new
 * version suffix and the delivery hashes are refreshed; nothing else changes.
 */
export const V2_ONBOARDING_PULL_MOTION_HOLDS: Readonly<
  Partial<Record<ExpansionPullId, V2OnboardingPullMotionHold>>
> = Object.freeze({
  // Confirmed 2026-09-07 (pillow-edge-audit): both Pillow clips carry a cutout
  // defect baked in by keying their magenta-matte sources. A magenta fringe
  // follows the silhouette, dark fragments trail the moving feet and parts of
  // the legs are removed. It exists in the lossless composition before
  // encoding, so no playback setting can hide it. The repair, a tracked
  // foreground mask or a green-screen re-shoot, is separate work.
  'the-pillow': Object.freeze({
    defect:
      'magenta fringe and missing leg pixels baked into the entrance and recede cutouts',
    since: '2026-09-07',
  }),
})

const EMPTY_SET: V2OnboardingStillResource = Object.freeze({
  kind: 'still',
  src: `${MEDIA_ROOT}/stills/p00-set-empty-v0_1.webp`,
  alt: '',
})

const CORKY_REST: V2OnboardingStillResource = Object.freeze({
  kind: 'still',
  src: `${MEDIA_ROOT}/stills/p01-corky-rest-v0_4.webp`,
  alt: '',
})

const TABLE_READY: V2OnboardingStillResource = Object.freeze({
  kind: 'still',
  src: `${MEDIA_ROOT}/stills/p02-table-ready-v0_17.webp`,
  alt: '',
})

const SCROLLING_SETTLED: V2OnboardingStillResource = Object.freeze({
  kind: 'still',
  src: `${MEDIA_ROOT}/stills/p03-scrolling-settled-v0_2.webp`,
  alt: '',
})

const SNACKING_SETTLED: V2OnboardingStillResource = Object.freeze({
  kind: 'still',
  src: `${MEDIA_ROOT}/stills/p03-snacking-settled-v0_3.webp`,
  alt: '',
})

const AVOIDANCE_SETTLED: V2OnboardingStillResource = Object.freeze({
  kind: 'still',
  src: `${MEDIA_ROOT}/stills/p03-avoidance-settled-v0_1.webp`,
  alt: '',
})

/** Founder-approved V2.5 scene pack used by every product build. */
export const V2_ONBOARDING_MEDIA_PACK: V2OnboardingMediaPack = Object.freeze({
  revision: 'corky-v2.5-pull-expansion-v2-edge-safe',
  brand: Object.freeze({ kind: 'brand', alt: '' }),
  poster: TABLE_READY,
  plate: TABLE_READY,
  scenes: Object.freeze({
    'corky-reveal': Object.freeze({
      primary: Object.freeze({
        kind: 'video',
        src: `${V2_5_MEDIA_ROOT}/picture/b01-corky-greeting-direct-to-p02-v0_1.mp4`,
        alt: '',
      }),
      reducedStill: TABLE_READY,
      poster: EMPTY_SET,
    }),
    'table-reveal': Object.freeze({
      primary: Object.freeze({
        kind: 'video',
        src: `${MEDIA_ROOT}/picture/b02-table-reveal-v0_1.mp4`,
        alt: '',
      }),
      reducedStill: TABLE_READY,
      poster: CORKY_REST,
    }),
  }),
  record: Object.freeze({
    start: Object.freeze({
      kind: 'video',
      src: `${V2_5_MEDIA_ROOT}/picture/b06-corky-starts-record-v0_1.mp4`,
      alt: '',
    }),
    spin: Object.freeze({
      kind: 'video',
      src: `${V2_5_MEDIA_ROOT}/picture/b06-whole-vinyl-spin-v0_1.mp4`,
      alt: '',
    }),
    stoppedAuthority: TABLE_READY,
  }),
  pulls: Object.freeze({
    ...Object.fromEntries(
      EXPANSION_PULL_IDS.map((id) => {
        const motionHold = V2_ONBOARDING_PULL_MOTION_HOLDS[id]
        return [
          id,
          Object.freeze({
            present: Object.freeze({
              kind: 'video' as const,
              src: `${EXPANSION_ROOT}/b03-${id}-present-v0_2.mp4`,
              alt: '',
            }),
            hold: Object.freeze({
              kind: 'still' as const,
              src: `${EXPANSION_ROOT}/p03-${id}-settled-v0_1.webp`,
              alt: '',
            }),
            recede: Object.freeze({
              kind: 'video' as const,
              src: `${EXPANSION_ROOT}/b05-${id}-recede-v0_2.mp4`,
              alt: '',
            }),
            end: TABLE_READY,
            ...(motionHold === undefined ? {} : { motionHold }),
          }),
        ]
      }),
    ),
    scrolling: Object.freeze({
      present: Object.freeze({
        kind: 'video',
        src: `${EXPANSION_ROOT}/b03-scrolling-present-v0_3.mp4`,
        alt: '',
      }),
      hold: SCROLLING_SETTLED,
      recede: Object.freeze({
        kind: 'video',
        src: `${EXPANSION_ROOT}/b05-scrolling-recede-v0_3.mp4`,
        alt: '',
      }),
      end: TABLE_READY,
    }),
    snacking: Object.freeze({
      present: Object.freeze({
        kind: 'video',
        src: `${MEDIA_ROOT}/picture/b03-snacking-present-v0_3.mp4`,
        alt: '',
      }),
      hold: SNACKING_SETTLED,
      recede: Object.freeze({
        kind: 'video',
        src: `${MEDIA_ROOT}/picture/b05-snacking-recede-v0_4.mp4`,
        alt: '',
      }),
      end: TABLE_READY,
    }),
    avoidance: Object.freeze({
      present: Object.freeze({
        kind: 'video',
        src: `${MEDIA_ROOT}/picture/b03-avoidance-present-v0_1.mp4`,
        alt: '',
      }),
      hold: AVOIDANCE_SETTLED,
      recede: Object.freeze({
        kind: 'video',
        src: `${MEDIA_ROOT}/picture/b05-avoidance-recede-v0_1.mp4`,
        alt: '',
      }),
      end: TABLE_READY,
    }),
  }),
})

export function resolveV2OnboardingRecordMediaRequest(
  pack: V2OnboardingMediaPack,
  target: {
    readonly targetId: string
    readonly moment: V2OnboardingRecordMediaMoment
  },
): V2OnboardingMediaPresentationRequest | undefined {
  const record = pack.record
  if (record === undefined) return undefined
  const primary = record[target.moment]
  return {
    targetId: target.targetId,
    targetKind: target.moment === 'start' ? 'automatic' : 'hold',
    primary,
    reducedStill: record.stoppedAuthority,
    poster: record.stoppedAuthority,
    brand: pack.brand,
  }
}

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

  const moving = target.moment === 'present' || target.moment === 'recede'
  // A held Pull shows its authored still where the clip would have played. The
  // target stays automatic, so the beat still advances on its own.
  const held = moving && pull.motionHold !== undefined

  return {
    targetId: target.targetId,
    targetKind: moving ? 'automatic' : 'hold',
    primary: held ? reducedStill : primary,
    reducedStill,
    poster,
    brand: pack.brand,
  }
}
