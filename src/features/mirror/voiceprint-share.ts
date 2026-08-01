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
import { voiceTypeHint } from '@/lib/mirror/metrics'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import { cardToPngBlob, datedFilename, renderTwinFaceCard, shareCard, } from './card-renderer'
import { legendArt } from './LegendCaricature'

function loadPortrait(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('portrait failed to load'))
    img.src = src
  })
}

/**
 * Rebuild a stored voiceprint's card as a canvas. `'face'` is the plain
 * twin portrait card; `'stats'` overlays the record's range/accuracy/
 * steadiness. Null when the record has no twin portrait to build from.
 * Shared by the share paths below and the flip side of the settings
 * card, so what you flip to is exactly what you'd export.
 */
export async function renderVoiceprintCard(
  record: VoiceprintRecord,
  variant: 'face' | 'stats',
): Promise<HTMLCanvasElement | null> {
  const twin = record.twin
  if (twin == null || twin === '') return null
  const art = legendArt(twin)
  if (art.imageSrc == null || art.imageSrc === '') return null

  let portrait: HTMLImageElement
  try {
    portrait = await loadPortrait(art.imageSrc)
  } catch {
    return null
  }

  const s = record.summary
  const hasRange = s.lowMidi != null && s.highMidi != null
  return renderTwinFaceCard({
    legend: twin,
    epithet: art.epithet,
    voiceType: null,
    legendImage: portrait,
    showData: variant === 'stats',
    result:
      variant === 'stats'
        ? {
            range: hasRange
              ? {
                  lowNote: midiToNoteNameOctave(s.lowMidi ?? 0),
                  highNote: midiToNoteNameOctave(s.highMidi ?? 0),
                  semitones:
                    s.semitones ?? (s.highMidi ?? 0) - (s.lowMidi ?? 0),
                  voiceHint: voiceTypeHint(s.lowMidi ?? 0, s.highMidi ?? 0),
                }
              : null,
            accuracy:
              s.accuracy != null ? { score: Math.round(s.accuracy) } : null,
            steadiness: s.steadiness != null ? { score: s.steadiness } : null,
          }
        : undefined,
  })
}

/**
 * Share a stored voiceprint as a PNG card. Returns how it left the
 * device, or `'unavailable'` when no card could be built.
 */
export async function shareVoiceprintRecord(
  record: VoiceprintRecord,
  variant: 'face' | 'stats',
): Promise<'shared' | 'downloaded' | 'unavailable'> {
  const canvas = await renderVoiceprintCard(record, variant)
  if (canvas === null) return 'unavailable'

  const blob = await cardToPngBlob(canvas)
  return shareCard(blob, datedFilename('voiceprint'), {
    title: 'My voiceprint',
    text: `${record.twin ?? 'My twin'} is my voice twin — mercurypitch.com/mirror`,
  })
}
