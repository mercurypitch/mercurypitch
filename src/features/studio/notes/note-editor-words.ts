// ============================================================
// Studio note editor words — what the editor says of a clip's notes: the roll's text alternative, the status line, and the bars the clip spans
// ============================================================
//
// A canvas says nothing to assistive tech, so the roll carries these words
// as its label: how many notes the clip plays, from which note to which (on
// a kit, on how many drums), and over which of the song's bars. Bars count
// from the song's bar 1 (time.ts, studioSongBeats), as the ruler does.
import type { StudioMidiSoundKind } from '@/lib/studio/midi/render-key'
import type { StudioTickWindow } from '@/lib/studio/midi/time'
import type { StudioNote } from '@/lib/studio/model/types'
import { studioNoteName } from './note-names'
import type { StudioRollMeter } from './note-roll-draw'

/** The song's bar tick `tick` falls in, counted from 1. */
export function studioBarAt(meter: StudioRollMeter, tick: number): number {
  const barTicks = meter.beatTicks * meter.beatsPerBar
  if (!(barTicks > 0)) return 1
  return Math.floor((tick - meter.originTick) / barTicks) + 1
}

/** The bars the window spans, first and last. */
export function studioWindowBars(
  meter: StudioRollMeter,
  window: StudioTickWindow,
): { readonly first: number; readonly last: number } {
  const first = studioBarAt(meter, window.startTick)
  return {
    first,
    last: Math.max(first, studioBarAt(meter, window.endTick - 1)),
  }
}

/** The notes the window plays. */
function played(
  notes: readonly StudioNote[],
  window: StudioTickWindow,
): StudioNote[] {
  return notes.filter(
    (note) =>
      note.startTick >= window.startTick && note.startTick < window.endTick,
  )
}

/** "41 notes" or "1 hit". */
export function studioNoteCountWords(
  count: number,
  sound: StudioMidiSoundKind,
): string {
  const noun = sound === 'drums' ? 'hit' : 'note'
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

/** What the notes span: "from C3 to G5", "on C4", or on a kit "on 3 drums". */
function spanWords(
  notes: readonly StudioNote[],
  sound: StudioMidiSoundKind,
): string {
  const pitches = new Set(notes.map((note) => note.pitch))
  if (sound === 'drums')
    return pitches.size === 1 ? 'on 1 drum' : `on ${pitches.size} drums`
  const low = Math.min(...pitches)
  const high = Math.max(...pitches)
  return low === high
    ? `on ${studioNoteName(low)}`
    : `from ${studioNoteName(low)} to ${studioNoteName(high)}`
}

/** The roll's text alternative: "41 notes from C3 to G5, bars 3 to 6". */
export function studioRollWords(options: {
  readonly notes: readonly StudioNote[]
  readonly window: StudioTickWindow
  readonly meter: StudioRollMeter
  readonly sound: StudioMidiSoundKind
}): string {
  const notes = played(options.notes, options.window)
  const bars = studioWindowBars(options.meter, options.window)
  const where =
    bars.first === bars.last
      ? `bar ${bars.first}`
      : `bars ${bars.first} to ${bars.last}`
  if (notes.length === 0)
    return `No ${options.sound === 'drums' ? 'hits' : 'notes'}, ${where}`
  const count = studioNoteCountWords(notes.length, options.sound)
  return `${count} ${spanWords(notes, options.sound)}, ${where}`
}

/** The status line: "41 notes · Bars 3–6". */
export function studioNoteStatusWords(options: {
  readonly notes: readonly StudioNote[]
  readonly window: StudioTickWindow
  readonly meter: StudioRollMeter
  readonly sound: StudioMidiSoundKind
}): string {
  const count = played(options.notes, options.window).length
  const bars = studioWindowBars(options.meter, options.window)
  const where =
    bars.first === bars.last
      ? `Bar ${bars.first}`
      : `Bars ${bars.first}–${bars.last}`
  return `${studioNoteCountWords(count, options.sound)} · ${where}`
}
