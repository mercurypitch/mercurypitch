// ============================================================
// Rebuilding a card from summary numbers alone
// ============================================================
//
// Two callers need the same thing: a voiceprint that exists only as
// stored numbers — no MirrorResult, no glide frames — drawn as the card
// it would have been. A take saved in settings, and a take that arrived
// in someone else's share link.
//
// `renderTwinFaceCard` was already widened to accept that structural
// slice; this is the mapping onto it, in one place, so the two surfaces
// cannot drift into drawing different cards from the same numbers.

import { voiceTypeHint } from '@/lib/mirror/metrics'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import type { VoiceprintShareData } from '@/lib/share-codec'
import { renderTwinFaceCard } from './card-renderer'
import { legendArt } from './LegendCaricature'

/** The numbers a card can be rebuilt from, however they were stored. */
export interface CardSummary {
  lowMidi?: number | null
  highMidi?: number | null
  semitones?: number | null
  accuracy?: number | null
  steadiness?: number | null
}

function loadPortrait(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('portrait failed to load'))
    img.src = src
  })
}

/**
 * Draw the twin face card for a summary. `'face'` is the plain portrait;
 * `'stats'` overlays the range, accuracy and steadiness.
 *
 * Null when there is no twin, no portrait for it, or the portrait will not
 * load — every one of which means the caller should show its own layout
 * rather than a broken frame.
 */
export async function renderSummaryCard(
  summary: CardSummary,
  twin: string | null | undefined,
  variant: 'face' | 'stats',
): Promise<HTMLCanvasElement | null> {
  if (twin == null || twin === '') return null
  const art = legendArt(twin)
  if (art.imageSrc == null || art.imageSrc === '') return null

  let portrait: HTMLImageElement
  try {
    portrait = await loadPortrait(art.imageSrc)
  } catch {
    return null
  }

  const low = summary.lowMidi
  const high = summary.highMidi
  const hasRange = low != null && high != null

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
                  lowNote: midiToNoteNameOctave(low),
                  highNote: midiToNoteNameOctave(high),
                  semitones: summary.semitones ?? high - low,
                  voiceHint: voiceTypeHint(low, high),
                }
              : null,
            accuracy:
              summary.accuracy != null
                ? { score: Math.round(summary.accuracy) }
                : null,
            steadiness:
              summary.steadiness != null ? { score: summary.steadiness } : null,
          }
        : undefined,
  })
}

/** The same card, for a voiceprint that arrived in a share link. */
export function renderSharedVoiceprintCard(
  data: VoiceprintShareData,
): Promise<HTMLCanvasElement | null> {
  return renderSummaryCard(
    {
      lowMidi: data.lo,
      highMidi: data.hi,
      semitones: data.st,
      accuracy: data.ac,
      steadiness: data.sd,
    },
    data.tw,
    'stats',
  )
}
