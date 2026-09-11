// A scored pass uses the marked range or the remaining accepted score on its own clock.
// ============================================================
import type { LoopSpan } from '@/lib/guitar/loop-span'
import { normalizeLoopSpan, quantizeSpanToBeats } from '@/lib/guitar/loop-span'
import { nextScoreNoteStart } from './score-note-index'

export function scoreLiveRange(
  marked: LoopSpan | null,
  playheadBeat: number | null,
  durationBeats: number,
  noteStarts: readonly number[] = [],
): LoopSpan | null {
  if (!(durationBeats > 0)) return null
  if (marked !== null) {
    const quantized = quantizeSpanToBeats(marked)
    return normalizeLoopSpan(quantized.start, quantized.end, durationBeats)
  }
  const parked = Math.min(durationBeats, Math.max(0, playheadBeat ?? 0))
  const nextNote = nextScoreNoteStart(noteStarts, parked)
  const hasUpcomingTarget = nextNote !== undefined && nextNote < durationBeats
  const start =
    parked >= durationBeats || (noteStarts.length > 0 && !hasUpcomingTarget)
      ? 0
      : parked
  return normalizeLoopSpan(start, durationBeats, durationBeats)
}
