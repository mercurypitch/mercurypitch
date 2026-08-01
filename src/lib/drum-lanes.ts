// ============================================================
// Drum Lanes — GM percussion rows for the compose drum kit
// ============================================================
//
// Maps General MIDI percussion numbers to synthesized drum voices plus the
// labels and 24x24 filled single-path icons the piano roll renders per lane.

import type { ScaleDegree } from '@/types'
import type { DrumVoiceId } from './drum-voices'
import { midiToFreq, midiToNote } from './scale-data'

export interface DrumLane {
  /** GM percussion note number */
  midi: number
  voice: DrumVoiceId
  label: string
  shortLabel: string
  /** 24x24 single-path SVG path data (Path2D-compatible filled silhouette) */
  iconPath: string
}

/** Lanes in strictly descending MIDI order (renders top to bottom). */
export const DRUM_LANES: DrumLane[] = [
  {
    midi: 51,
    voice: 'ride',
    label: 'Ride',
    shortLabel: 'RD',
    iconPath:
      'M12 2a10 10 0 1 1 0 20 10 10 0 1 1 0-20Z M12 5a7 7 0 1 0 0 14 7 7 0 1 0 0-14Z M12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 1 1 0-5Z',
  },
  {
    midi: 50,
    voice: 'tom-high',
    label: 'High Tom',
    shortLabel: 'T1',
    iconPath: 'M8 8a4 4 0 0 1 8 0v12H8Z',
  },
  {
    midi: 49,
    voice: 'crash',
    label: 'Crash',
    shortLabel: 'CR',
    iconPath:
      'M12 12L22 10.6 22 13.4Z M12 12L20 18.6 18.6 20Z M12 12L13.4 22 10.6 22Z M12 12L5.4 20 4 18.6Z M12 12L2 13.4 2 10.6Z M12 12L4 5.4 5.4 4Z M12 12L10.6 2 13.4 2Z M12 12L18.6 4 20 5.4Z',
  },
  {
    midi: 47,
    voice: 'tom-mid',
    label: 'Mid Tom',
    shortLabel: 'T2',
    iconPath: 'M6 8a6 6 0 0 1 12 0v12H6Z',
  },
  {
    midi: 46,
    voice: 'hh-open',
    label: 'Open Hat',
    shortLabel: 'OH',
    iconPath: 'M3 9.5L21 5v2L3 11.5Z M3 12.5L21 17v2L3 14.5Z',
  },
  {
    midi: 45,
    voice: 'tom-low',
    label: 'Low Tom',
    shortLabel: 'T3',
    iconPath: 'M4 9a8 5.5 0 0 1 16 0v11H4Z',
  },
  {
    midi: 44,
    voice: 'hh-pedal',
    label: 'Pedal Hat',
    shortLabel: 'PH',
    iconPath: 'M3 7h18v2H3Z M3 10.5h18v2H3Z M12 14.5l4.5 6.5h-9Z',
  },
  {
    midi: 42,
    voice: 'hh-closed',
    label: 'Closed Hat',
    shortLabel: 'HH',
    iconPath: 'M3 10h18v2H3Z M3 13.5h18v2H3Z',
  },
  {
    midi: 39,
    voice: 'clap',
    label: 'Clap',
    shortLabel: 'CP',
    iconPath:
      'M8.5 9.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 1 0 0-9Z M15.5 5.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 1 0 0-9Z',
  },
  {
    midi: 38,
    voice: 'snare',
    label: 'Snare',
    shortLabel: 'SN',
    iconPath:
      'M4 9h16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2Z',
  },
  {
    midi: 37,
    voice: 'sidestick',
    label: 'Sidestick',
    shortLabel: 'SS',
    iconPath:
      'M18.6 3l2.4 2.4-8 8-2.4-2.4Z M4 14h16a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2Z',
  },
  {
    midi: 36,
    voice: 'kick',
    label: 'Kick',
    shortLabel: 'BD',
    iconPath: 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18Z',
  },
]

/** The lanes as ScaleDegree rows (real GM note names, e.g. 36 = C2). */
export const DRUM_LANE_SCALE: ScaleDegree[] = DRUM_LANES.map((lane) => {
  const { name, octave } = midiToNote(lane.midi)
  return {
    midi: lane.midi,
    name,
    octave,
    freq: midiToFreq(lane.midi),
    semitone: lane.midi % 12,
  }
})

export const DRUM_LANE_BY_MIDI: ReadonlyMap<number, DrumLane> = new Map(
  DRUM_LANES.map((lane) => [lane.midi, lane]),
)

export function drumVoiceForMidi(midi: number): DrumVoiceId | null {
  return DRUM_LANE_BY_MIDI.get(midi)?.voice ?? null
}
