// ============================================================
// Voice Constellation state — saved history read once, shared by every host.
// ============================================================
//
// The web route (VoiceConstellationSurface) and the native app's own page
// (apps/mercurypitch/src/shell/progress/ConstellationScreen.tsx) draw the
// same map from the same read. Saved voiceprints are the only source of a
// reveal: while the read is loading or failed, nothing is revealed, and a
// refresh for a new identity hides the last account's portraits rather than
// showing them until the new list lands.

import type { Accessor, Resource } from 'solid-js'
import { createEffect, createMemo, createResource, createSignal, } from 'solid-js'
import { authVersion } from '@/db/services/user-service'
import type { VoiceprintRecord } from '@/db/services/voiceprint-service'
import { listVoiceprints } from '@/db/services/voiceprint-service'
import type { VoiceTypeBand } from '@/lib/mirror/legend-catalog'
import { VOICE_TYPE_BANDS } from '@/lib/mirror/legend-catalog'
import type { VoiceConstellation, VoiceConstellationLegend, } from '@/lib/mirror/voice-constellation'
import { buildVoiceConstellation } from '@/lib/mirror/voice-constellation'
import { midiToNoteNameOctave } from '@/lib/note-utils'

export type HistoryMode = 'ready' | 'loading' | 'error'

export interface BandGroup {
  band: VoiceTypeBand
  legends: VoiceConstellationLegend[]
}

export interface VoiceConstellationController {
  prints: Resource<VoiceprintRecord[]>
  refetch: () => void
  mode: Accessor<HistoryMode>
  records: Accessor<VoiceprintRecord[]>
  constellation: Accessor<VoiceConstellation>
  revealedLegends: Accessor<VoiceConstellationLegend[]>
  savedMatchCount: Accessor<number>
  bandGroups: Accessor<BandGroup[]>
  rangeStory: Accessor<string>
  selectedLegend: Accessor<VoiceConstellationLegend | undefined>
  /** 1-based place of the open portrait among the revealed ones; 0 if none. */
  selectedPosition: Accessor<number>
  openLegend: (legend: VoiceConstellationLegend) => void
  closeLegend: () => void
  stepSelectedLegend: (offset: -1 | 1) => void
}

export function joinLabels(labels: readonly string[]): string {
  return new Intl.ListFormat(undefined, {
    style: 'long',
    type: 'conjunction',
  }).format(labels)
}

export function useVoiceConstellation(): VoiceConstellationController {
  const [prints, { refetch }] = createResource(authVersion, listVoiceprints)
  const [selectedLegendId, setSelectedLegendId] = createSignal<string | null>(
    null,
  )

  createEffect(() => {
    if (prints.loading) setSelectedLegendId(null)
  })

  const mode = (): HistoryMode => {
    if (prints.error !== undefined) return 'error'
    // Hide any previous resource value during an identity-key refresh. Solid
    // keeps stale data while refreshing by default; showing it here could
    // briefly expose the last account's revealed portraits after sign-out.
    if (prints.loading) return 'loading'
    return 'ready'
  }

  const records = () => (mode() === 'ready' ? (prints() ?? []) : [])
  const constellation = createMemo(() => buildVoiceConstellation(records()))
  const revealedLegends = createMemo(() =>
    constellation().legends.filter((legend) => legend.state !== 'unmatched'),
  )
  const savedMatchCount = () =>
    revealedLegends().length + constellation().legacyMatches.length
  const selectedLegend = createMemo(() =>
    revealedLegends().find((legend) => legend.id === selectedLegendId()),
  )
  const selectedPosition = (): number => {
    const selected = selectedLegend()
    if (selected === undefined) return 0
    return (
      revealedLegends().findIndex((legend) => legend.id === selected.id) + 1
    )
  }

  const stepSelectedLegend = (offset: -1 | 1): void => {
    const legends = revealedLegends()
    if (legends.length < 2) return
    const selected = selectedLegend()
    if (selected === undefined) return
    const index = legends.findIndex((legend) => legend.id === selected.id)
    const nextIndex = (index + offset + legends.length) % legends.length
    setSelectedLegendId(legends[nextIndex]?.id ?? null)
  }

  const bandGroups = createMemo(() =>
    VOICE_TYPE_BANDS.map((band) => ({
      band,
      legends: constellation().legends.filter(
        (legend) => legend.band === band.id,
      ),
    })),
  )

  const measuredRange = (): string | null => {
    const summary = constellation().currentVoiceprint?.summary
    if (summary?.lowMidi == null || summary.highMidi == null) return null
    return `${midiToNoteNameOctave(summary.lowMidi)}–${midiToNoteNameOctave(
      summary.highMidi,
    )}`
  }

  const overlappingBands = (): readonly VoiceTypeBand[] => {
    const summary = constellation().currentVoiceprint?.summary
    if (summary?.lowMidi == null || summary.highMidi == null) return []
    return VOICE_TYPE_BANDS.filter(
      (band) =>
        band.lowMidi <= (summary.highMidi as number) &&
        band.highMidi >= (summary.lowMidi as number),
    )
  }

  const rangeStory = (): string => {
    const range = measuredRange()
    const bands = overlappingBands()
    if (range === null || bands.length === 0) {
      return 'The voice types below are broad discovery guides, not a diagnosis or a ranking.'
    }
    return `Your latest measured range, ${range}, overlaps the broad ${joinLabels(
      bands.map((band) => band.label),
    )} voice types. They are discovery guides, not a diagnosis or a ranking.`
  }

  return {
    prints,
    refetch: () => void refetch(),
    mode,
    records,
    constellation,
    revealedLegends,
    savedMatchCount,
    bandGroups,
    rangeStory,
    selectedLegend,
    selectedPosition,
    openLegend: (legend) => setSelectedLegendId(legend.id),
    closeLegend: () => setSelectedLegendId(null),
    stepSelectedLegend,
  }
}
