// Studio MIDI roll — the note editor's piano roll in ticks: a sequence's notes as the roll draws them, a viewport over a clip's window, zoom and pan kept to it, and what is under a pointer.
//
// The geometry is the Lab's (lib/roll-geometry.ts), counted in a sequence's
// ticks. The editor shows a clip's window (time.ts): a zoom or a pan stays
// inside it, and only a note that starts inside it is picked, so the notes
// outside, drawn dimmed, are kept as they are (docs/plans/studio-midi.md,
// decision 9).
import type { RollScale, RollViewport, RollZone } from '@/lib/roll-geometry'
import { hitTest, panViewport, xToTime, yToMidi, zoomViewport, } from '@/lib/roll-geometry'
import type { StudioSequence } from '../model/types'
import { STUDIO_PPQ } from '../model/types'
import type { StudioTickWindow } from './time'

/** A note as the roll draws it: from its start to its end in ticks, on its pitch's row, by its id. */
export interface StudioRollNote {
  readonly id: number
  readonly start: number
  readonly end: number
  readonly midi: number
}

/**
 * A zoom closes in to a sixteenth note, and opens out to the clip's window
 * however short it is; an empty roll fitted with these shows a bar of four
 * beats.
 */
export const STUDIO_ROLL_SCALE: RollScale = {
  minSpan: STUDIO_PPQ / 4,
  emptySpan: STUDIO_PPQ * 4,
  minFitSpan: 1,
}

/** Semitones of air above and below the notes, and the rows an empty clip shows: the octaves around middle C. */
const AIR = 2
const EMPTY_ROWS = { minMidi: 48, maxMidi: 72 }

/** The sequence's notes as the roll draws them. */
export function studioRollNotes(
  sequence: Pick<StudioSequence, 'notes'>,
): StudioRollNote[] {
  return sequence.notes.map((note) => ({
    id: note.id,
    start: note.startTick,
    end: note.startTick + note.lengthTicks,
    midi: note.pitch,
  }))
}

/** The notes a clip plays: those starting inside its window. */
function inWindow(
  notes: readonly StudioRollNote[],
  window: StudioTickWindow,
): StudioRollNote[] {
  return notes.filter(
    (note) => note.start >= window.startTick && note.start < window.endTick,
  )
}

/** A viewport over the clip's whole window, its rows the pitches its notes span with air, kept on the keyboard. */
export function studioRollViewport(
  sequence: Pick<StudioSequence, 'notes'>,
  window: StudioTickWindow,
  width: number,
  height: number,
): RollViewport {
  const notes = inWindow(studioRollNotes(sequence), window)
  const pitches = notes.map((note) => note.midi)
  const rows =
    notes.length === 0
      ? EMPTY_ROWS
      : {
          minMidi: Math.max(0, Math.min(...pitches) - AIR),
          maxMidi: Math.min(127, Math.max(...pitches) + AIR),
        }
  return {
    start: window.startTick,
    end: Math.max(window.endTick, window.startTick + 1),
    ...rows,
    width,
    height,
  }
}

/** The viewport counted from the window's start, so the shared zoom and pan keep to it. */
function fromWindow(viewport: RollViewport, window: StudioTickWindow) {
  return {
    ...viewport,
    start: viewport.start - window.startTick,
    end: viewport.end - window.startTick,
  }
}

function toWindow(
  viewport: RollViewport,
  window: StudioTickWindow,
): RollViewport {
  return {
    ...viewport,
    start: viewport.start + window.startTick,
    end: viewport.end + window.startTick,
  }
}

/** Zoom about `anchorX` by `factor` (below 1 closes in), kept inside the clip's window. */
export function zoomStudioRoll(
  viewport: RollViewport,
  factor: number,
  anchorX: number,
  window: StudioTickWindow,
): RollViewport {
  return toWindow(
    zoomViewport(
      fromWindow(viewport, window),
      factor,
      anchorX,
      window.endTick - window.startTick,
      STUDIO_ROLL_SCALE,
    ),
    window,
  )
}

/** Slide the roll `deltaTicks` later, kept inside the clip's window. */
export function panStudioRoll(
  viewport: RollViewport,
  deltaTicks: number,
  window: StudioTickWindow,
): RollViewport {
  return toWindow(
    panViewport(
      fromWindow(viewport, window),
      deltaTicks,
      window.endTick - window.startTick,
    ),
    window,
  )
}

/** The note under a point, by id, and whether on its body or its right edge; only a note the clip plays is picked. */
export function studioRollHit(
  sequence: Pick<StudioSequence, 'notes'>,
  window: StudioTickWindow,
  viewport: RollViewport,
  x: number,
  y: number,
): { readonly id: number; readonly zone: RollZone } | null {
  const hit = hitTest(
    inWindow(studioRollNotes(sequence), window),
    viewport,
    x,
    y,
  )
  return hit === null ? null : { id: hit.note.id, zone: hit.zone }
}

/** The tick and pitch at a point, the tick whole: where a drawn note starts. */
export function studioRollPoint(
  viewport: RollViewport,
  x: number,
  y: number,
): { readonly tick: number; readonly pitch: number } {
  return {
    tick: Math.round(xToTime(x, viewport)),
    pitch: Math.min(127, Math.max(0, yToMidi(y, viewport))),
  }
}
