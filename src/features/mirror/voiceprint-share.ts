// ============================================================
// Voiceprint sharing — a stored record becomes a share card
// ============================================================
//
// The Mirror renders its cards live from a MirrorResult; a voiceprint in
// settings (or at the end of onboarding) only has the stored record:
// summary numbers + the twin's name. This adapter rebuilds the twin face
// card from that — loading the portrait by name and mapping the summary
// onto the structural slice the renderer needs — so every surface shares
// through the same renderer and the same Web Share / download fallback.

import type { VoiceprintRecord } from '@/db/services/voiceprint-service'
import { voiceprintShareUrl } from '@/lib/mirror/shared-voiceprint'
import { cardToPngBlob, datedFilename, shareCard, twinShareText, } from './card-renderer'
import { renderSummaryCard } from './shared-voiceprint-card'

/**
 * Rebuild a stored voiceprint's card as a canvas. `'face'` is the plain
 * twin portrait card; `'stats'` overlays the record's range/accuracy/
 * steadiness. Null when the record has no twin portrait to build from.
 * Shared by the share paths below and the flip side of the settings
 * card, so what you flip to is exactly what you'd export — and, through
 * `renderSummaryCard`, exactly what a share link's recipient sees.
 */
export function renderVoiceprintCard(
  record: VoiceprintRecord,
  variant: 'face' | 'stats',
): Promise<HTMLCanvasElement | null> {
  return renderSummaryCard(record.summary, record.twin, variant)
}

/**
 * Share a stored voiceprint as a PNG card. Returns how it left the
 * device, or `'unavailable'` when no card could be built.
 */
export async function shareVoiceprintRecord(
  record: VoiceprintRecord,
  variant: 'face' | 'stats',
): Promise<'shared' | 'downloaded' | 'dismissed' | 'unavailable'> {
  const canvas = await renderVoiceprintCard(record, variant)
  if (canvas === null) return 'unavailable'

  const blob = await cardToPngBlob(canvas)
  return shareCard(blob, datedFilename('voiceprint'), {
    title: 'My voiceprint',
    text: twinShareText(
      record.twin ?? 'My twin',
      voiceprintShareUrl(record.summary, record.twin),
    ),
  })
}
