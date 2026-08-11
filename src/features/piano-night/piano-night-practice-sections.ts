// ============================================================
// Piano Night practice sections — honest navigation for unanalysed sources
// ============================================================
//
// Authored studies keep their authored phrases. Device music gets stable
// beat windows so Previous/Next and the score lens remain useful without
// inventing analysis, dynamics, pedal, or musical-form evidence.

import type { PianoNightPhrase } from './piano-night-demo-project'

const DEFAULT_SECTION_BEATS = 16

function formatBeat(beat: number): string {
  return Number.isInteger(beat) ? String(beat) : beat.toFixed(1)
}

export function createPianoNightPracticeSections(
  totalBeats: number,
  sectionBeats = DEFAULT_SECTION_BEATS,
): readonly PianoNightPhrase[] {
  const safeTotal = Number.isFinite(totalBeats) ? Math.max(0, totalBeats) : 0
  const safeWindow =
    Number.isFinite(sectionBeats) && sectionBeats > 0
      ? sectionBeats
      : DEFAULT_SECTION_BEATS
  const sectionCount = Math.max(1, Math.ceil(safeTotal / safeWindow))

  return Array.from({ length: sectionCount }, (_, index) => {
    const startBeat = index * safeWindow
    const endBeat = Math.max(
      startBeat + Number.EPSILON,
      Math.min(safeTotal, startBeat + safeWindow),
    )
    return Object.freeze({
      startBeat,
      endBeat,
      range:
        sectionCount === 1
          ? `full piece · beats 0–${formatBeat(safeTotal)}`
          : `beats ${formatBeat(startBeat)}–${formatBeat(endBeat)}`,
      guidance:
        'No authored coaching prompt exists for this source. Use this section as a neutral rehearsal boundary.',
      focus: 'Project section · not analysed',
    })
  })
}
