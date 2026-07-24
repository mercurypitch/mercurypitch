export interface PitchCanvasScale {
  minMidi: number
  maxMidi: number
  rowCount: number
  octaveAware: boolean
}

export const PITCH_VISUAL_COLORS = {
  reference: '#f59e0b',
  referenceBright: '#ffc15a',
  referenceFill: 'rgba(245, 158, 11, 0.58)',
  singer: '#a78bfa',
  singerBright: '#c4b5fd',
  singerFill: 'rgba(167, 139, 250, 0.3)',
  selection: '#edf5ff',
  playhead: '#60a5fa',
} as const

const STANDARD_SCALE: PitchCanvasScale = {
  minMidi: 0,
  maxMidi: 11,
  rowCount: 12,
  octaveAware: false,
}

const DEFAULT_EDITOR_LOW_MIDI = 48
const DEFAULT_EDITOR_HIGH_MIDI = 72
const EDITOR_RANGE_PADDING = 2
const MIN_EDITOR_ROWS = 18

const clampMidi = (midi: number): number =>
  Math.max(0, Math.min(127, Math.round(midi)))

/**
 * Normal playback folds the display to the twelve pitch classes. Pitch Studio
 * needs a real piano-roll range so notes an octave apart remain distinct.
 */
export function createPitchCanvasScale(
  editor: boolean,
  midiValues: readonly number[],
): PitchCanvasScale {
  if (!editor) return STANDARD_SCALE

  const valid = midiValues
    .filter((midi) => Number.isFinite(midi) && midi >= 0 && midi <= 127)
    .map(clampMidi)

  let minMidi = valid.length > 0 ? Math.min(...valid) : DEFAULT_EDITOR_LOW_MIDI
  let maxMidi = valid.length > 0 ? Math.max(...valid) : DEFAULT_EDITOR_HIGH_MIDI

  minMidi = clampMidi(minMidi - EDITOR_RANGE_PADDING)
  maxMidi = clampMidi(maxMidi + EDITOR_RANGE_PADDING)

  const missingRows = MIN_EDITOR_ROWS - (maxMidi - minMidi + 1)
  if (missingRows > 0) {
    const below = Math.floor(missingRows / 2)
    const above = missingRows - below
    minMidi = clampMidi(minMidi - below)
    maxMidi = clampMidi(maxMidi + above)

    // A clamp at either MIDI boundary can still leave the range too short.
    const remaining = MIN_EDITOR_ROWS - (maxMidi - minMidi + 1)
    if (remaining > 0) {
      if (minMidi === 0) maxMidi = clampMidi(maxMidi + remaining)
      else minMidi = clampMidi(minMidi - remaining)
    }
  }

  return {
    minMidi,
    maxMidi,
    rowCount: maxMidi - minMidi + 1,
    octaveAware: true,
  }
}

export function midiToPitchCanvasRow(
  midi: number,
  scale: PitchCanvasScale,
): number {
  if (scale.octaveAware) {
    return scale.maxMidi - clampMidi(midi)
  }
  const pitchClass = ((Math.round(midi) % 12) + 12) % 12
  return 11 - pitchClass
}

export function pitchCanvasRowToMidi(
  row: number,
  scale: PitchCanvasScale,
): number {
  return clampMidi(scale.maxMidi - Math.round(row))
}
