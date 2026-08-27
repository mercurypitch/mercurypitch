// ============================================================
// Cinematic onboarding media — portable v0.5 asset boundary
// ============================================================

import type { CinematicOnboardingMode, CinematicOnboardingSegment, CinematicOnboardingSegmentId, CinematicOnboardingTimeline, } from './cinematic-onboarding-timeline'
import { CINEMATIC_ONBOARDING_TIMELINE_V0_5 } from './cinematic-onboarding-timeline'

/** Media shared by a moving beat and its stable-plate equivalent. */
export interface CinematicOnboardingStableMedia {
  /** First paint and moving-video error fallback. */
  readonly poster: string
  /** Complete readable end state used for holds, overlays and reduced motion. */
  readonly reducedStill: string
  /** Describes the scene state; captions and controls remain native DOM. */
  readonly alt: string
}

export interface CinematicOnboardingAutomaticMedia extends CinematicOnboardingStableMedia {
  readonly kind: 'automatic'
  /** One-shot H.264/yuv420p clip. The runtime must never loop it. */
  readonly video: string
}

export interface CinematicOnboardingAutomaticNativeOverlayMedia extends CinematicOnboardingStableMedia {
  readonly kind: 'automatic_native_overlay'
}

export interface CinematicOnboardingHoldMedia extends CinematicOnboardingStableMedia {
  readonly kind: 'hold'
}

export type CinematicOnboardingSegmentMedia =
  | CinematicOnboardingAutomaticMedia
  | CinematicOnboardingAutomaticNativeOverlayMedia
  | CinematicOnboardingHoldMedia

export interface CinematicOnboardingContinuousAudioMedia {
  readonly kind: 'continuous_review_mix'
  readonly src: string
  readonly sourceDurationFrames: 788
  readonly clockPolicy: 'pause_with_picture'
}

export interface LegacyCinematicOnboardingContinuousAudioMediaV04 {
  readonly kind: 'continuous_review_mix'
  readonly src: string
  readonly sourceDurationFrames: 746
  readonly clockPolicy: 'pause_with_picture'
}

/** Packaged delivery manifest; authoring and workstation paths stay outside. */
export interface CinematicOnboardingMediaManifest {
  readonly revision: string
  readonly sourceContractVersion: CinematicOnboardingTimeline['version']
  readonly sourceContractSha256: string
  /** Silent picture files share this one authored 788-frame audio clock. */
  readonly audio: CinematicOnboardingContinuousAudioMedia
  readonly segments: Readonly<
    Record<CinematicOnboardingSegmentId, CinematicOnboardingSegmentMedia>
  >
}

/**
 * Deprecated manifest shape retained only so a v0.3 config can be inspected
 * without pretending it satisfies the active v0.5 segment contract.
 */
export interface LegacyCinematicOnboardingMediaManifestV03 {
  readonly revision: string
  readonly sourceContractVersion: '0.3.0'
  readonly sourceContractSha256: string
  readonly audio: LegacyCinematicOnboardingContinuousAudioMediaV04
  readonly segments: Readonly<Record<string, CinematicOnboardingSegmentMedia>>
}

export interface LegacyCinematicOnboardingMediaManifestV04 {
  readonly revision: string
  readonly sourceContractVersion: '0.4.0'
  readonly sourceContractSha256: string
  readonly audio: LegacyCinematicOnboardingContinuousAudioMediaV04
  readonly segments: Readonly<Record<string, CinematicOnboardingSegmentMedia>>
}

export type CinematicOnboardingResolvedMedia =
  | {
      readonly kind: 'video'
      readonly src: string
      readonly poster: string
      readonly alt: string
    }
  | {
      readonly kind: 'still'
      readonly src: string
      readonly alt: string
    }

/**
 * Normal moving beats use video. Native overlays, interaction holds and
 * reduced motion consistently select the authored final-state still.
 */
export function resolveCinematicOnboardingMedia(
  manifest: CinematicOnboardingMediaManifest,
  segmentId: CinematicOnboardingSegmentId,
  mode: CinematicOnboardingMode,
): CinematicOnboardingResolvedMedia {
  const media = manifest.segments[segmentId]
  if (mode === 'normal' && media.kind === 'automatic') {
    return {
      kind: 'video',
      src: media.video,
      poster: media.poster,
      alt: media.alt,
    }
  }

  return {
    kind: 'still',
    src: media.reducedStill,
    alt: media.alt,
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPackagedOnboardingAssetUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false

  const url = value.trim()
  if (
    url === '' ||
    url.includes('\\') ||
    url.includes('?') ||
    url.includes('#') ||
    url.includes('%') ||
    /^[a-z][a-z\d+.-]*:/iu.test(url) ||
    url.startsWith('//')
  ) {
    return false
  }

  const path = url.startsWith('/')
    ? url.slice(1)
    : url.startsWith('./')
      ? url.slice(2)
      : url
  const segments = path.split('/')

  return (
    path.startsWith('onboarding/') &&
    /^[a-z\d][a-z\d._/-]*$/iu.test(path) &&
    segments.every(
      (segment) => segment !== '' && segment !== '.' && segment !== '..',
    )
  )
}

const TOP_LEVEL_KEYS = [
  'revision',
  'sourceContractVersion',
  'sourceContractSha256',
  'audio',
  'segments',
] as const

const AUDIO_KEYS = [
  'kind',
  'src',
  'sourceDurationFrames',
  'clockPolicy',
] as const

const STABLE_MEDIA_KEYS = ['kind', 'poster', 'reducedStill', 'alt'] as const
const AUTOMATIC_MEDIA_KEYS = [...STABLE_MEDIA_KEYS, 'video'] as const

function expectedManifestKind(
  segment: CinematicOnboardingSegment,
): CinematicOnboardingSegmentMedia['kind'] {
  if (segment.kind === 'automatic') return 'automatic'
  if (segment.kind === 'automatic_native_overlay') {
    return 'automatic_native_overlay'
  }
  return 'hold'
}

function reportUnexpectedKeys(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[],
  label: string,
  problems: string[],
): void {
  const expectedSet = new Set(expected)
  for (const key of Object.keys(value)) {
    if (!expectedSet.has(key)) {
      problems.push(`${label} has unexpected field "${key}".`)
    }
  }
}

/** Strict runtime guard for a generated v0.5 delivery manifest. */
export function validateCinematicOnboardingMediaManifest(
  manifest: unknown,
): readonly string[] {
  const problems: string[] = []
  const expectedSegments = CINEMATIC_ONBOARDING_TIMELINE_V0_5.shots.flatMap(
    (shot) => shot.segments,
  )
  const expectedIds = new Set(expectedSegments.map((segment) => segment.id))
  if (!isRecord(manifest)) {
    return ['Media manifest must be an object.']
  }

  reportUnexpectedKeys(manifest, TOP_LEVEL_KEYS, 'Media manifest', problems)

  const revision = manifest.revision
  const sourceContractVersion = manifest.sourceContractVersion
  const sourceContractSha256 = manifest.sourceContractSha256
  const audio = isRecord(manifest.audio) ? manifest.audio : undefined
  const supplied = isRecord(manifest.segments) ? manifest.segments : undefined

  if (typeof revision !== 'string' || revision.trim() === '') {
    problems.push('Media manifest revision is empty.')
  }
  if (sourceContractVersion !== CINEMATIC_ONBOARDING_TIMELINE_V0_5.version) {
    problems.push(
      `Media manifest targets timeline ${String(sourceContractVersion)}, not ${CINEMATIC_ONBOARDING_TIMELINE_V0_5.version}.`,
    )
  }
  if (
    typeof sourceContractSha256 !== 'string' ||
    !/^[a-f\d]{64}$/u.test(sourceContractSha256)
  ) {
    problems.push(
      'Media manifest has no valid lowercase source-contract SHA-256.',
    )
  }

  if (audio === undefined) {
    problems.push('Media manifest audio must be an object.')
  } else {
    reportUnexpectedKeys(audio, AUDIO_KEYS, 'Media manifest audio', problems)
    if (audio.kind !== 'continuous_review_mix') {
      problems.push(
        `Media manifest audio is ${String(audio.kind)}, expected continuous_review_mix.`,
      )
    }
    if (audio.sourceDurationFrames !== 788) {
      problems.push(
        `Media manifest audio has ${String(audio.sourceDurationFrames)} source frames, expected 788.`,
      )
    }
    if (audio.clockPolicy !== 'pause_with_picture') {
      problems.push(
        `Media manifest audio uses ${String(audio.clockPolicy)}, expected pause_with_picture.`,
      )
    }
    if (!isPackagedOnboardingAssetUrl(audio.src)) {
      problems.push(
        `Media manifest audio has a non-packaged asset URL "${String(audio.src)}".`,
      )
    }
  }

  if (supplied === undefined) {
    problems.push('Media manifest segments must be an object.')
    return problems
  }

  for (const id of Object.keys(supplied)) {
    if (!expectedIds.has(id as CinematicOnboardingSegmentId)) {
      problems.push(`Media manifest has unknown segment "${id}".`)
    }
  }

  for (const segment of expectedSegments) {
    const media = supplied[segment.id]
    if (!isRecord(media)) {
      problems.push(`Media manifest is missing segment "${segment.id}".`)
      continue
    }

    const expectedKind = expectedManifestKind(segment)
    const expectedKeys =
      expectedKind === 'automatic' ? AUTOMATIC_MEDIA_KEYS : STABLE_MEDIA_KEYS
    reportUnexpectedKeys(
      media,
      expectedKeys,
      `Media for "${segment.id}"`,
      problems,
    )

    if (media.kind !== expectedKind) {
      problems.push(
        `Media for "${segment.id}" is ${String(media.kind)}, expected ${expectedKind}.`,
      )
    }
    if (typeof media.alt !== 'string' || media.alt.trim() === '') {
      problems.push(`Media for "${segment.id}" has no description.`)
    }

    const urls: readonly (readonly [string, unknown])[] =
      expectedKind === 'automatic'
        ? [
            ['poster', media.poster],
            ['reducedStill', media.reducedStill],
            ['video', media.video],
          ]
        : [
            ['poster', media.poster],
            ['reducedStill', media.reducedStill],
          ]
    for (const [field, url] of urls) {
      if (typeof url !== 'string' || url.trim() === '') {
        problems.push(`Media for "${segment.id}" has no ${field} asset.`)
        continue
      }
      if (!isPackagedOnboardingAssetUrl(url)) {
        problems.push(
          `Media for "${segment.id}" has a non-packaged asset URL "${String(url)}".`,
        )
      }
    }
  }

  return problems
}
