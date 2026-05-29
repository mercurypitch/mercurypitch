// ============================================================
// Note display utilities — shared between StemMixer and PitchTestingTab
// ============================================================

import type { MelodyItem } from '@/types'
import type { MergedNote } from './midi-generator'

/**
 * Convert beat-based MelodyItem[] to time-based MergedNote[]
 * so alignPitchToWords can be reused without modification.
 */
export function melodyItemsToMergedNotes(
  items: MelodyItem[],
  bpm: number,
): MergedNote[] {
  const beatsPerSecond = bpm / 60
  return items.map((item) => ({
    midi: item.note.midi,
    noteName: `${item.note.name}${item.note.octave}`,
    startSec: item.startBeat / beatsPerSecond,
    endSec: (item.startBeat + item.duration) / beatsPerSecond,
  }))
}

/**
 * Draw a note name label on a canvas block/pill.
 * Shared between StemMixer pitch canvas and OfflinePitchCanvas.
 */
export function drawNoteLabelOnBlock(
  ctx: CanvasRenderingContext2D,
  noteName: string,
  x: number,
  y: number,
  blockWidth: number,
  blockHeight: number,
  fontSize = 9,
): void {
  if (blockWidth < 24) return

  ctx.save()
  ctx.fillStyle = '#fff'
  ctx.font = `bold ${fontSize}px monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(noteName, x + blockWidth / 2, y + blockHeight / 2)
  ctx.restore()
}
