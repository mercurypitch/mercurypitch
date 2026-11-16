// ============================================================
// Studio note roll end — the clip's end as a handle on the roll's ruler: the two bars the roll shows past it, where a drag puts it on the editor's grid, and how it is said
// ============================================================
//
// The note editor shows the clip's window and, dimmed, two bars past its
// end, so the End handle on the ruler has room to be taken and dragged
// (docs/plans/studio-midi-clips.md, 1.2). The roll's view keeps to that
// range; the notes the clip plays stay the window's, and a press past the
// end draws nothing, as before. Dragging End moves the clip's end, longer
// or shorter, onto the editor's grid, at least a step past the window's
// start and five minutes into the sequence at the most; let go, it is one
// 'trim-tail' (StudioNoteEditor.tsx), which grows the sequence when the
// end passes it (midi-window.ts).
import type { StudioTickWindow } from '@/lib/studio/midi/time'
import type { NoteGridLines } from './edit-snap'
import { lineAfter, snapNearest } from './edit-snap'
import type { StudioRollMeter } from './note-roll-geometry'

/** Bars the roll shows past the clip's end, dimmed, so the End handle has room. */
export const ROLL_END_ROOM_BARS = 2

/** The End handle's target, in CSS pixels across: a finger's. */
export const ROLL_END_TARGET = 44

/** The ticks the roll may show: the clip's window, its end at `endTick`, and two bars past it. */
export function studioRollRange(
  window: StudioTickWindow,
  meter: Pick<StudioRollMeter, 'beatTicks' | 'beatsPerBar'>,
  endTick = window.endTick,
): StudioTickWindow {
  const bar = meter.beatTicks * meter.beatsPerBar
  return {
    startTick: window.startTick,
    endTick: endTick + ROLL_END_ROOM_BARS * (bar > 0 ? bar : 0),
  }
}

/**
 * Where a drag of the End handle to tick `raw` puts the clip's end: on the
 * nearest line of the grid (any whole tick with Snap off), a line past the
 * window's start at the least, and `mostTick` at the most.
 */
export function rollEndTick(
  raw: number,
  grid: NoteGridLines | null,
  startTick: number,
  mostTick: number,
): number {
  const placed = grid === null ? Math.round(raw) : snapNearest(raw, grid)
  const least = grid === null ? startTick + 1 : lineAfter(startTick, grid)
  return Math.max(Math.min(least, mostTick), Math.min(mostTick, placed))
}

/** Tick `tick` in the song's bars, as a sentence says it: "bar 5", "bar 4, beat 3", or "bar 4, after beat 3". */
export function rollEndWords(
  tick: number,
  meter: Pick<StudioRollMeter, 'beatTicks' | 'beatsPerBar' | 'originTick'>,
): string {
  // Beats from the song's first, to a thousandth, so a line's float noise reads as the line.
  const beats =
    Math.round(((tick - meter.originTick) / meter.beatTicks) * 1000) / 1000
  const bar = Math.floor(beats / meter.beatsPerBar)
  const beat = beats - bar * meter.beatsPerBar
  if (beat === 0) return `bar ${bar + 1}`
  const on = Math.floor(beat) + 1
  return Number.isInteger(beat)
    ? `bar ${bar + 1}, beat ${on}`
    : `bar ${bar + 1}, after beat ${on}`
}
