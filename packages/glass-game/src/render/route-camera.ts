// Route camera policy — commit authored compositions only after a stable landing.

import type { LevelCameraDefinition, RouteCameraSectionDefinition, } from '../contracts'

const DEFAULT_LANDING_DWELL_SECONDS = 0.75
const MINIMUM_LANDING_DWELL_SECONDS = 0.4
const MAXIMUM_LANDING_DWELL_SECONDS = 1.5
const MAXIMUM_SAMPLE_SECONDS = 0.05

export interface RouteCameraSample {
  grounded: boolean
  supportPlatformId?: string | null
}

export interface RouteCameraUpdate {
  section: RouteCameraSectionDefinition | null
  changed: boolean
}

function boundedLandingDwell(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_LANDING_DWELL_SECONDS
  return Math.min(
    MAXIMUM_LANDING_DWELL_SECONDS,
    Math.max(MINIMUM_LANDING_DWELL_SECONDS, value!),
  )
}

/**
 * Keeps a route shot stable through jumps and support-boundary noise. The
 * director changes sections only after continuous grounded support on a
 * platform owned by the next section.
 */
export function createRouteCameraDirector(
  definition: LevelCameraDefinition | undefined,
) {
  const sections = definition?.sections ?? []
  const initial =
    sections.find((section) => section.id === definition?.initialSectionId) ??
    sections[0] ??
    null
  const sectionByPlatform = new Map<string, RouteCameraSectionDefinition>()
  for (const section of sections)
    for (const platformId of section.platformIds)
      if (!sectionByPlatform.has(platformId))
        sectionByPlatform.set(platformId, section)
  const landingDwellSeconds = boundedLandingDwell(
    definition?.landingDwellSeconds,
  )
  let active = initial
  let candidate: RouteCameraSectionDefinition | null = null
  let candidateSeconds = 0

  function clearCandidate(): void {
    candidate = null
    candidateSeconds = 0
  }

  return {
    section(): RouteCameraSectionDefinition | null {
      return active
    },
    update(
      sample: RouteCameraSample,
      elapsedSeconds: number,
    ): RouteCameraUpdate {
      if (!sample.grounded || sample.supportPlatformId == null) {
        clearCandidate()
        return { section: active, changed: false }
      }
      const supported = sectionByPlatform.get(sample.supportPlatformId) ?? null
      if (supported === null || supported.id === active?.id) {
        clearCandidate()
        return { section: active, changed: false }
      }
      if (candidate?.id !== supported.id) {
        candidate = supported
        candidateSeconds = 0
      }
      const safeElapsed = Number.isFinite(elapsedSeconds)
        ? Math.min(MAXIMUM_SAMPLE_SECONDS, Math.max(0, elapsedSeconds))
        : 0
      candidateSeconds += safeElapsed
      if (candidateSeconds < landingDwellSeconds)
        return { section: active, changed: false }
      active = supported
      clearCandidate()
      return { section: active, changed: true }
    },
  }
}
