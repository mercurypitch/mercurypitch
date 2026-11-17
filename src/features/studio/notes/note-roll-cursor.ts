// ============================================================
// Studio note roll cursor — the cursor over the note roll: what the editor's view asks for as CSS gives it, the eraser drawn as a cursor of its own, and a hand over the ruler
// ============================================================
//
// CSS has no eraser, so Erase, and a sweep with the right button, show one
// drawn here: the Erase tool's glyph (studio-icons.tsx, Eraser) with a
// white body, a coral tip and a dark rim, so it reads on the dark theme
// and the light one alike. Its hot spot is the tip's corner, where a press
// takes a note. A browser that cannot draw it falls back to the crosshair.
// Over the ruler the roll answers a press itself, so a mouse sees a hand
// there, and a resize over the playhead's head, which scrubs.
import type { NoteEditCursor } from './edit-view'
import type { NoteRollBand } from './note-roll-bands'

const ERASER = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">',
  '<g transform="rotate(-45 13 11)" stroke="#16181d" stroke-width="1.5" stroke-linejoin="round">',
  '<rect x="5.5" y="7.5" width="15" height="7" rx="1.6" fill="#fff"/>',
  '<path d="M7.1 7.5h3.4v7H7.1a1.6 1.6 0 0 1-1.6-1.6V9.1a1.6 1.6 0 0 1 1.6-1.6Z" fill="#f96f68"/>',
  '</g></svg>',
].join('')

/** The eraser as a CSS cursor, its hot spot on the tip's corner. */
export const NOTE_ERASER_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(ERASER)}") 10 19, crosshair`

/** What a mouse or a pen that is not pressed is over: a band of the roll, and whether it is the playhead's head on the ruler. */
export interface NoteRollOver {
  readonly band: NoteRollBand | null
  readonly head: boolean
}

/** The CSS cursor over the roll: a hand over the ruler, which seeks, and a resize over the playhead's head; elsewhere what the editor's view asks for. */
export function noteRollCursor(
  over: NoteRollOver | null,
  cursor: NoteEditCursor | undefined,
): string | undefined {
  if (over?.head === true) return 'ew-resize'
  if (over?.band === 'ruler') return 'pointer'
  return cursor === 'erase' ? NOTE_ERASER_CURSOR : cursor
}
