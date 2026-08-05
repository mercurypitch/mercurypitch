// ============================================================
// Voice Mirror — pure constellation model from voiceprint history.
// ============================================================
//
// Persisted twin names are the source of truth. This layer never re-runs the
// matcher from range data: doing so could rewrite a person's history when the
// roster changes. Unknown historical names remain visible as legacy matches.

import type { VoiceprintRecord } from '@/db/services/voiceprint-service'
import type { VoiceLegend, VoiceTypeBandId } from './legend-catalog'
import { VOICE_LEGENDS } from './legend-catalog'

export type VoiceConstellationState = 'current' | 'past' | 'unmatched'

/** One catalogue position, safe for the locked/unlocked gallery UI. */
export interface VoiceConstellationLegend {
  readonly id: string
  readonly name: string
  readonly band: VoiceTypeBandId
  readonly state: VoiceConstellationState
  /** Present only for current or previously matched legends. */
  readonly imageSrc?: string
  /** Timestamp of the newest voiceprint represented by this position. */
  readonly matchedAt?: string
}

/** A persisted match whose legend is no longer in the current catalogue. */
export interface LegacyVoiceConstellationMatch {
  readonly name: string
  readonly state: Exclude<VoiceConstellationState, 'unmatched'>
  readonly matchedAt: string
}

export interface VoiceConstellation {
  /** The newest voiceprint, even when it has no twin. */
  readonly currentVoiceprint: VoiceprintRecord | null
  /** The newest voiceprint's persisted twin, without reclassification. */
  readonly currentTwin: string | null
  /** All catalogue positions in stable display order. */
  readonly legends: readonly VoiceConstellationLegend[]
  /** Unique persisted names absent from the current catalogue. */
  readonly legacyMatches: readonly LegacyVoiceConstellationMatch[]
}

interface PersistedMatch {
  readonly state: Exclude<VoiceConstellationState, 'unmatched'>
  readonly matchedAt: string
}

const LEGEND_BY_NAME: ReadonlyMap<string, VoiceLegend> = new Map(
  VOICE_LEGENDS.map((legend) => [legend.name, legend]),
)

/**
 * Build the locked/unlocked constellation from a voiceprint timeline.
 *
 * Input is sorted defensively so callers outside listVoiceprints() cannot
 * accidentally mark an older take as current. Null twins contribute no
 * match. Repeated names collapse to their newest occurrence.
 */
export function buildVoiceConstellation(
  records: readonly VoiceprintRecord[],
): VoiceConstellation {
  const newestFirst = [...records].sort((a, b) =>
    b.takenAt.localeCompare(a.takenAt),
  )
  const currentVoiceprint = newestFirst[0] ?? null
  const catalogueMatches = new Map<string, PersistedMatch>()
  const legacyMatches = new Map<string, LegacyVoiceConstellationMatch>()

  newestFirst.forEach((record, index) => {
    if (record.twin === null || record.twin === '') return
    const state = index === 0 ? 'current' : 'past'

    if (LEGEND_BY_NAME.has(record.twin)) {
      if (!catalogueMatches.has(record.twin)) {
        catalogueMatches.set(record.twin, {
          state,
          matchedAt: record.takenAt,
        })
      }
      return
    }

    if (!legacyMatches.has(record.twin)) {
      legacyMatches.set(record.twin, {
        name: record.twin,
        state,
        matchedAt: record.takenAt,
      })
    }
  })

  return {
    currentVoiceprint,
    currentTwin: currentVoiceprint?.twin ?? null,
    legends: VOICE_LEGENDS.map((legend) =>
      constellationLegend(legend, catalogueMatches.get(legend.name)),
    ),
    legacyMatches: [...legacyMatches.values()],
  }
}

function constellationLegend(
  legend: VoiceLegend,
  match: PersistedMatch | undefined,
): VoiceConstellationLegend {
  if (match === undefined) {
    // Construct this branch explicitly: imageSrc must be absent, not merely
    // undefined, so a mystery card cannot accidentally receive a portrait URL.
    return {
      id: legend.id,
      name: legend.name,
      band: legend.band,
      state: 'unmatched',
    }
  }

  return {
    id: legend.id,
    name: legend.name,
    band: legend.band,
    state: match.state,
    imageSrc: legend.imageSrc,
    matchedAt: match.matchedAt,
  }
}
