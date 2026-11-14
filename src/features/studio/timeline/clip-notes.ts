// ============================================================
// Studio clip notes — a MIDI clip's notes drawn in its lane's canvas, over its waveform faded back, as glass bars in the lane's hue
// ============================================================
//
// Drawn into the clip's own canvas by StudioWaveform's draw, never as a
// node per note, and only when what it draws changes: the playhead never
// redraws a clip. The notes come from the preview kept per sequence and
// window (lib/studio/midi/preview.ts), so a draw walks only the notes its
// span shows. Each note is a bar from its start to its end at its real
// time, as bright as it was played: the faintest at half strength. The
// bars share a few paths (one glow, one fill per strength, one highlight),
// so ten thousand notes cost a handful of fills, not ten thousand.
import { studioNotePreview, studioPreviewFirst, } from '@/lib/studio/midi/preview'
import type { StudioMidiSoundKind } from '@/lib/studio/midi/render-key'
import { studioClipTickWindow, studioFramesToTicks, studioTicksToFrames, } from '@/lib/studio/midi/time'
import type { StudioClip, StudioSequence } from '@/lib/studio/model/types'
import { STUDIO_PPQ } from '@/lib/studio/model/types'

/** What a MIDI clip draws over its waveform: its sequence, and what its lane sounds as. */
export interface StudioClipNotes {
  readonly sequence: StudioSequence
  readonly sound: StudioMidiSoundKind
}

/** One draw of a clip's canvas: the source frames it spans and its size in CSS pixels. */
export interface StudioClipNotesFrame {
  readonly clip: Pick<StudioClip, 'sourceInFrame' | 'sourceOutFrame'>
  readonly sourceInFrame: number
  readonly sourceOutFrame: number
  readonly width: number
  readonly height: number
}

/** How strongly a MIDI clip's waveform shows behind its notes. */
export const STUDIO_MIDI_WAVE_ALPHA = 0.3

/** Notes drawn at five strengths, from the softest at 0.6 to the loudest at 1. */
const STRENGTHS = 5
/** Room above and below the rows, in CSS pixels. */
const PAD = 2
/** A drum hit is drawn a sixteenth note wide. */
const HIT_TICKS = STUDIO_PPQ / 4

interface Bar {
  x: number
  y: number
  width: number
  height: number
}

type Context = Pick<
  CanvasRenderingContext2D,
  | 'beginPath'
  | 'rect'
  | 'fill'
  | 'fillStyle'
  | 'globalAlpha'
  | 'shadowBlur'
  | 'shadowColor'
> &
  Partial<Pick<CanvasRenderingContext2D, 'roundRect'>>

function addBar(context: Context, bar: Bar): void {
  const radius = Math.min(bar.height / 2, bar.width / 2, 3)
  if (radius >= 1 && typeof context.roundRect === 'function')
    context.roundRect(bar.x, bar.y, bar.width, bar.height, radius)
  else context.rect(bar.x, bar.y, bar.width, bar.height)
}

function fillBars(context: Context, bars: readonly Bar[]): void {
  if (bars.length === 0) return
  context.beginPath()
  for (const bar of bars) addBar(context, bar)
  context.fill()
}

/**
 * The notes a draw walks, by their place in the clip's preview: from the
 * first that can still sound at the span's start to the last that starts
 * before its end. A span of a long clip walks its own notes, not the clip's.
 */
export function studioClipNoteRange(
  notes: StudioClipNotes,
  frame: StudioClipNotesFrame,
): { readonly first: number; readonly end: number } {
  const { sequence } = notes
  const preview = studioNotePreview(
    sequence,
    studioClipTickWindow(frame.clip, sequence),
    notes.sound,
  )
  const last = studioFramesToTicks(frame.sourceOutFrame, sequence.tempoBpm)
  const first = studioPreviewFirst(
    preview,
    studioFramesToTicks(frame.sourceInFrame, sequence.tempoBpm) - 1,
  )
  let end = first
  while (end < preview.notes.length && preview.notes[end].start <= last) end++
  return { first, end }
}

/** The bars a draw shows, by strength, each where its note sounds. */
function layBars(notes: StudioClipNotes, frame: StudioClipNotesFrame): Bar[][] {
  const { sequence } = notes
  const window = studioClipTickWindow(frame.clip, sequence)
  const preview = studioNotePreview(sequence, window, notes.sound)
  const span = frame.sourceOutFrame - frame.sourceInFrame
  const strengths: Bar[][] = Array.from({ length: STRENGTHS }, () => [])
  if (span <= 0 || preview.notes.length === 0) return strengths
  const scale = frame.width / span
  const x = (tick: number) =>
    (studioTicksToFrames(tick, sequence.tempoBpm) - frame.sourceInFrame) * scale
  const rowHeight = (frame.height - PAD * 2) / preview.rows
  const height =
    notes.sound === 'drums'
      ? Math.max(1.5, rowHeight - 2)
      : Math.max(2, rowHeight - Math.max(0.5, rowHeight * 0.14))
  const range = studioClipNoteRange(notes, frame)
  for (let index = range.first; index < range.end; index++) {
    const note = preview.notes[index]
    const end = notes.sound === 'drums' ? note.start + HIT_TICKS : note.end
    const left = x(note.start)
    const right = x(end) - 1
    if (right < 0 || left > frame.width) continue
    const strength = Math.min(
      STRENGTHS - 1,
      Math.max(0, Math.ceil(note.velocity * STRENGTHS) - 1),
    )
    strengths[strength].push({
      x: left,
      y: PAD + note.row * rowHeight + (rowHeight - height) / 2,
      width: Math.max(1.5, right - left),
      height,
    })
  }
  return strengths
}

/**
 * Draw a MIDI clip's notes in `color`, the lane's waveform colour, into a
 * canvas already sized and scaled for the frame. Returns how many notes it
 * drew.
 */
export function drawStudioClipNotes(
  context: Context,
  notes: StudioClipNotes,
  frame: StudioClipNotesFrame,
  color: string,
): number {
  const strengths = layBars(notes, frame)
  const all = strengths.flat()
  if (all.length === 0) return 0
  context.fillStyle = color
  // A soft glow under every bar, one blur for the whole clip.
  context.shadowColor = color
  context.shadowBlur = 6
  context.globalAlpha = 0.35
  fillBars(context, all)
  context.shadowBlur = 0
  strengths.forEach((bars, strength) => {
    context.globalAlpha = 0.6 + (0.4 * strength) / (STRENGTHS - 1)
    fillBars(context, bars)
  })
  // A glass edge along the top of every bar tall enough to show one.
  context.fillStyle = '#ffffff'
  context.globalAlpha = 0.34
  fillBars(
    context,
    all.filter((bar) => bar.height >= 3).map((bar) => ({ ...bar, height: 1 })),
  )
  context.globalAlpha = 1
  return all.length
}
