// ============================================================
// Piano Night prepared project — one truthful first-party score for silent entry
// ============================================================
//
// The bundled study is canonical PianoProject data rather than decorative
// preview state. Every standalone lens projects these same note events.

import type { PianoProject, PianoProjectChannelEvent, } from '@/features/piano-project/piano-project'
import { validatePianoProject } from '@/features/piano-project/piano-project'

const TICKS_PER_QUARTER = 480
const TOTAL_BEATS = 64

interface PreparedNote {
  startBeat: number
  duration: number
  midi: number
  velocity: number
}

type PreparedTrackEvent =
  | (Omit<
      Extract<PianoProjectChannelEvent, { type: 'program-change' }>,
      'order'
    > & { sortKind: number })
  | (Omit<
      Extract<PianoProjectChannelEvent, { type: 'note-on' | 'note-off' }>,
      'order'
    > & { sortKind: number })

const HARMONIES = [
  { bass: 44, chord: [55, 60, 63], melody: [67, 68, 70, 67] },
  { bass: 41, chord: [53, 56, 60], melody: [65, 67, 68, 72] },
  { bass: 48, chord: [55, 60, 64], melody: [67, 72, 70, 67] },
  { bass: 46, chord: [53, 58, 62], melody: [65, 67, 63, 62] },
] as const

function buildPreparedNotes(): PreparedNote[] {
  const notes: PreparedNote[] = []
  for (let bar = 0; bar < 16; bar += 1) {
    const harmony = HARMONIES[bar % HARMONIES.length]
    const barStart = bar * 4
    notes.push({
      startBeat: barStart,
      duration: 3.7,
      midi: harmony.bass,
      velocity: bar % 4 === 0 ? 92 : 78,
    })
    for (const [index, midi] of harmony.chord.entries()) {
      notes.push({
        startBeat: barStart + index * 0.5,
        duration: 2.9 - index * 0.35,
        midi,
        velocity: 58 + index * 6,
      })
    }
    for (const [index, midi] of harmony.melody.entries()) {
      notes.push({
        startBeat: barStart + index,
        duration: index === 3 ? 0.9 : 0.78,
        midi: midi + (bar >= 8 ? 12 : 0),
        velocity: 72 + ((bar + index) % 4) * 5,
      })
    }
  }
  return notes
}

function buildTrackEvents(
  notes: readonly PreparedNote[],
): PianoProjectChannelEvent[] {
  const events: PreparedTrackEvent[] = [
    {
      type: 'program-change',
      sourceTrackIndex: 0,
      channel: 0,
      tick: 0,
      program: 0,
      sortKind: 0,
    },
  ]

  for (const note of notes) {
    events.push({
      type: 'note-on',
      sourceTrackIndex: 0,
      channel: 0,
      tick: Math.round(note.startBeat * TICKS_PER_QUARTER),
      note: note.midi,
      velocity: note.velocity,
      sortKind: 2,
    })
    events.push({
      type: 'note-off',
      sourceTrackIndex: 0,
      channel: 0,
      tick: Math.round((note.startBeat + note.duration) * TICKS_PER_QUARTER),
      note: note.midi,
      velocity: 42,
      sortKind: 1,
    })
  }

  return events
    .sort(
      (left, right) =>
        left.tick - right.tick ||
        left.sortKind - right.sortKind ||
        ('note' in left && 'note' in right ? left.note - right.note : 0),
    )
    .map(({ sortKind: _sortKind, ...event }, order) => ({
      ...event,
      order,
    }))
}

const createdAt = '2026-08-10T00:00:00.000Z'

export const PIANO_NIGHT_DEMO_PROJECT = validatePianoProject({
  schemaVersion: 1,
  id: 'piano-night-afterglow-study-v1',
  name: 'Afterglow Study in E-flat',
  createdAt,
  updatedAt: createdAt,
  source: {
    kind: 'bundled',
    catalogId: 'piano-night-afterglow-study',
    revision: 1,
    contentHash:
      '8a3447f02a3dfcd4fbba32d14c44575eaedd96d851ebff3fc68e3468e678f646',
    ticksPerQuarter: TICKS_PER_QUARTER,
  },
  durationTicks: TOTAL_BEATS * TICKS_PER_QUARTER,
  tempoMap: [
    {
      sourceTrackIndex: 0,
      order: 0,
      tick: 0,
      microsecondsPerQuarter: 769_231,
    },
  ],
  timeSignatures: [
    {
      sourceTrackIndex: 0,
      order: 1,
      tick: 0,
      numerator: 4,
      denominator: 4,
      clocksPerClick: 24,
      notatedThirtySecondsPerQuarter: 8,
    },
  ],
  keySignatures: [
    {
      sourceTrackIndex: 0,
      order: 2,
      tick: 0,
      sharpsFlats: -3,
      mode: 0,
    },
  ],
  tracks: [
    {
      id: 'afterglow-grand',
      sourceTrackIndex: 0,
      channel: 0,
      isPercussion: false,
      name: 'Afterglow Grand',
      instrumentName: 'Acoustic Grand Piano',
      events: buildTrackEvents(buildPreparedNotes()),
    },
  ],
  scoreTrackId: 'afterglow-grand',
  backingTrackIds: [],
  metaEvents: [],
  systemEvents: [],
}) satisfies PianoProject

export interface PianoNightPhrase {
  startBeat: number
  endBeat: number
  range: string
  guidance: string
  focus: string
}

export const PIANO_NIGHT_PHRASES: readonly PianoNightPhrase[] = [
  {
    startBeat: 0,
    endBeat: 16,
    range: 'bars 1–4',
    guidance: 'Settle the bass before the upper line enters.',
    focus: 'Left-hand pulse',
  },
  {
    startBeat: 16,
    endBeat: 32,
    range: 'bars 5–8',
    guidance: 'Keep the inner notes close and unhurried.',
    focus: 'Quiet inner voice',
  },
  {
    startBeat: 32,
    endBeat: 48,
    range: 'bars 9–12',
    guidance: 'Shape the octave lift without hardening the tone.',
    focus: 'Right-hand melody',
  },
  {
    startBeat: 48,
    endBeat: 64,
    range: 'bars 13–16',
    guidance: 'Let the final bass release the room.',
    focus: 'Pedal release',
  },
]
