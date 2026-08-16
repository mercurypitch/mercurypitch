// ============================================================
// Cinematic onboarding media — portable Phase-5 asset boundary
// ============================================================

import type { CinematicOnboardingMode, CinematicOnboardingSegmentId, CinematicOnboardingTimeline, } from './cinematic-onboarding-timeline'
import { CINEMATIC_ONBOARDING_TIMELINE_V0_2 } from './cinematic-onboarding-timeline'

/** Media shared by a moving beat and its no-motion equivalent. */
export interface CinematicOnboardingStableMedia {
  /** First paint and decode-failure fallback. */
  readonly poster: string
  /** Complete, readable state used when reduced motion is requested. */
  readonly reducedStill: string
  /** Describes the scene state; captions and controls remain native DOM. */
  readonly alt: string
}

export interface CinematicOnboardingAutomaticMedia extends CinematicOnboardingStableMedia {
  readonly kind: 'automatic'
  /** One-shot H.264/yuv420p clip. The runtime must never loop it. */
  readonly video: string
}

export interface CinematicOnboardingHoldMedia extends CinematicOnboardingStableMedia {
  readonly kind: 'hold'
}

export type CinematicOnboardingSegmentMedia =
  | CinematicOnboardingAutomaticMedia
  | CinematicOnboardingHoldMedia

/**
 * Phase 5 fills this manifest with packaged app assets. Blender files, rig
 * reports, and local workstation paths remain in the dotfiles source package.
 */
export interface CinematicOnboardingMediaManifest {
  readonly revision: string
  readonly sourceContractVersion: CinematicOnboardingTimeline['version']
  readonly sourceContractSha256: string
  readonly segments: Readonly<
    Record<CinematicOnboardingSegmentId, CinematicOnboardingSegmentMedia>
  >
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
 * Chooses media without reading browser preferences. The director owns the
 * mode so a running scene cannot silently switch contracts halfway through.
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

  return { kind: 'still', src: media.reducedStill, alt: media.alt }
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

/** Runtime guard for a generated Phase-5 manifest. */
export function validateCinematicOnboardingMediaManifest(
  manifest: unknown,
): readonly string[] {
  const problems: string[] = []
  const expectedSegments = CINEMATIC_ONBOARDING_TIMELINE_V0_2.shots.flatMap(
    (shot) => shot.segments,
  )
  const expectedIds = new Set(expectedSegments.map((segment) => segment.id))
  if (!isRecord(manifest)) {
    return ['Media manifest must be an object.']
  }

  const revision = manifest.revision
  const sourceContractVersion = manifest.sourceContractVersion
  const sourceContractSha256 = manifest.sourceContractSha256
  const supplied = isRecord(manifest.segments) ? manifest.segments : undefined

  if (typeof revision !== 'string' || revision.trim() === '') {
    problems.push('Media manifest revision is empty.')
  }
  if (sourceContractVersion !== CINEMATIC_ONBOARDING_TIMELINE_V0_2.version) {
    problems.push(
      `Media manifest targets timeline ${String(sourceContractVersion)}, not ${CINEMATIC_ONBOARDING_TIMELINE_V0_2.version}.`,
    )
  }
  if (
    typeof sourceContractSha256 !== 'string' ||
    !/^[a-f\d]{64}$/iu.test(sourceContractSha256)
  ) {
    problems.push('Media manifest has no valid source-contract SHA-256.')
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

    const expectedKind =
      segment.kind === 'automatic' ? 'automatic' : ('hold' as const)
    const kind = media.kind
    if (kind !== expectedKind) {
      problems.push(
        `Media for "${segment.id}" is ${String(kind)}, expected ${expectedKind}.`,
      )
    }
    if (typeof media.alt !== 'string' || media.alt.trim() === '') {
      problems.push(`Media for "${segment.id}" has no description.`)
    }

    const urls = [media.poster, media.reducedStill]
    if (expectedKind === 'automatic') urls.push(media.video)
    for (const url of urls) {
      if (!isPackagedOnboardingAssetUrl(url)) {
        problems.push(
          `Media for "${segment.id}" has a non-packaged asset URL "${String(url)}".`,
        )
      }
    }
  }

  return problems
}
