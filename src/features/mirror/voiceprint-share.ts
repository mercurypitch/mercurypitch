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
import type { ShareableVoiceprint } from '@/lib/mirror/shared-voiceprint'
import { linkNamesCard, newOgCardId, uploadOgCard, voiceprintShareUrl, } from '@/lib/mirror/shared-voiceprint'
import type { ShareOutcome } from './card-renderer'
import { cardToPngBlob, cardToUnfurlBlob, copyText, datedFilename, shareCard, twinShareText, } from './card-renderer'
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
): Promise<ShareOutcome | 'unavailable'> {
  const canvas = await renderVoiceprintCard(record, variant)
  if (canvas === null) return 'unavailable'

  const [blob, unfurl] = await Promise.all([
    cardToPngBlob(canvas),
    cardToUnfurlBlob(canvas),
  ])
  const ogCardId = newOgCardId()
  const link = voiceprintShareUrl(record.summary, record.twin, null, ogCardId)
  return shareCard(blob, datedFilename('voiceprint'), {
    title: 'My voiceprint',
    text: twinShareText(record.twin ?? 'My twin', link),
    link,
    // Only when the link is really on its way out: a card stored for a link
    // nobody was given is a card sent off the device for nothing. (The twin
    // card is square, so it is already the picture an unfurl wants.)
    onLinkLeaving: () => {
      if (unfurl !== null && linkNamesCard(link, ogCardId)) {
        uploadOgCard(ogCardId, unfurl)
      }
    },
  })
}

/**
 * Put a voiceprint's link on the clipboard: the share for wherever a link
 * is what is wanted — a desktop with no share sheet, a chat that drops the
 * text beside a picture, or someone who simply prefers to paste.
 *
 * The write begins before anything is awaited, because Safari only honours
 * a clipboard write that starts inside the tap; the id is picked here for
 * the same reason the share path picks it. The card is drawn and stored
 * only once the link is safely copied, so a refused clipboard uploads
 * nothing. `drawCard` may give null: the link still opens on the right
 * take, it just unfurls with the stock picture.
 */
export async function copyVoiceprintLink(
  summary: ShareableVoiceprint | null | undefined,
  twin: string | null | undefined,
  drawCard: () => HTMLCanvasElement | null | Promise<HTMLCanvasElement | null>,
): Promise<'copied' | 'failed'> {
  const ogCardId = newOgCardId()
  const link = voiceprintShareUrl(summary, twin, null, ogCardId)
  if (!(await copyText(link))) return 'failed'

  if (linkNamesCard(link, ogCardId)) {
    // Beside the copy, never in its way: the link is already theirs.
    void Promise.resolve()
      .then(drawCard)
      .then((canvas) => (canvas === null ? null : cardToUnfurlBlob(canvas)))
      .then((unfurl) => {
        if (unfurl !== null) uploadOgCard(ogCardId, unfurl)
      })
      .catch(() => {
        // A card that would not draw costs only a stock unfurl.
      })
  }
  return 'copied'
}

/** Copy the link of a stored voiceprint, unfurling as its numbers card. */
export function copyVoiceprintRecordLink(
  record: VoiceprintRecord,
): Promise<'copied' | 'failed'> {
  return copyVoiceprintLink(record.summary, record.twin, () =>
    renderVoiceprintCard(record, 'stats'),
  )
}
