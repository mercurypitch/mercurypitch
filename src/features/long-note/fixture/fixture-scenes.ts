// ============================================================
// Long note's fixtures: the room's states, pinned
// ============================================================
//
// As Echo's, Ng's and Lip roll's fixtures: a fixed picture of the room,
// nothing moving, so an art measure or a screenshot compares the room and
// not the timing of a take. Every number is a state the room itself
// reaches and every line is one of Merc's own (merc-lines.ts, by id); none
// is measured off the storyboard (01-long-note), whose three screens are
// intro, mid-take and result here.
//
//   intro     the empty lantern, A3 to hold, Merc beside it
//   rest      the same after a quiet minute: the mic is off again
//   mid-take  8.4 s on the note, the light a little under halfway, Merc
//             floating in it, the voice along the line
//   demo-off  the voice drifting sharp of the band, the light stalled low
//             (the demo's first take does this)
//   result    full to the brim, the seconds and the steadiness, Merc out
//             of the glass to cheer

import type { MercPlace } from '@/components/room-kit/merc-moves'
import type { MercState } from '@/lib/merc/constants'
import { fillLevel } from '../lantern-geometry'
import type { LongNoteRunSummary } from '../long-note-controller-types'
import type { LongNotePhase } from '../long-note-machine'
import type { LongNoteMoment } from '../merc-lines'
import { fillNote, MERC_LINES } from '../merc-lines'
import type { TraceSample } from '../voice-trace-buffer'

/** The note every fixture holds: A3. */
export const FIXTURE_NOTE = 57

/** What the voice is doing at the frame, if it sings at all. */
export type FixtureVoice = 'silent' | 'on' | 'sharp'

export interface LongNoteFixtureScene {
  readonly phase: LongNotePhase
  /** Merc's line in his bubble ('' for none). */
  readonly line: string
  readonly chip: string | null
  readonly mercState: MercState
  readonly mercPlace: MercPlace
  readonly voice: FixtureVoice
  /** The lantern's fill, 0 to 1. */
  readonly level: number
  /** 1 while the note is in the band, else the room's 0.25. */
  readonly glow: number
  /** 0, 0.5 from the goal, 1 at the brim. */
  readonly shine: number
  /** The timer's seconds in the hold. */
  readonly inBandSeconds: number
  /** The take's clock, s: the trace's newest point is drawn at it. */
  readonly now: number
  readonly trace: readonly TraceSample[]
  readonly summary: LongNoteRunSummary | null
}

/** One of Merc's own lines, by its id, for the fixture's note. */
export function mercLine(moment: LongNoteMoment, id: string): string {
  const line = MERC_LINES[moment].find((each) => each.id === id)
  if (line === undefined) throw new Error(`no line ${moment}/${id}`)
  return fillNote(line.text, 'A3')
}

/** The trace's frames, one every 1/60 s. */
const FRAME_S = 1 / 60

/**
 * The last four seconds of a voice up to `now`: `cents(t)` from the line,
 * in the band (`filling`) while within `band` cents of it.
 */
function voiceUpTo(
  now: number,
  cents: (t: number) => number,
  band: number,
): TraceSample[] {
  const out: TraceSample[] = []
  for (let t = Math.max(0, now - 4.2); t <= now; t += FRAME_S) {
    const at = cents(t)
    out.push({ t, cents: at, filling: Math.abs(at) <= band })
  }
  return out
}

/** A practised singer's vibrato: 5.5 Hz, 12 cents either side. */
const onLine = (t: number): number => 12 * Math.sin(2 * Math.PI * 5.5 * t)

/** Rising sharp from the line: 60 cents over a little under three seconds. */
const drifting = (t: number): number =>
  Math.min(60, Math.max(0, (t - 2.6) * 22)) + onLine(t) * 0.5

/** The Singer level's band, cents either side (LANTERN_LEVELS.singer). */
const BAND = 30

/** The goal fills the lantern halfway at 12 s on the note. */
const GOAL_SECONDS = 12

const MID_SECONDS = 8.4
const MID_NOW = 9.1

export const FIXTURE_SCENES = {
  intro: {
    phase: 'intro',
    line: mercLine('intro', 'intro-breathe'),
    chip: null,
    mercState: 'idle',
    mercPlace: 'beside',
    voice: 'silent',
    level: 0,
    glow: 0.25,
    shine: 0,
    inBandSeconds: 0,
    now: 0,
    trace: [],
    summary: null,
  },
  rest: {
    phase: 'intro',
    line: mercLine('rest', 'rest-quiet'),
    chip: null,
    mercState: 'idle',
    mercPlace: 'beside',
    voice: 'silent',
    level: 0,
    glow: 0.25,
    shine: 0,
    inBandSeconds: 0,
    now: 0,
    trace: [],
    summary: null,
  },
  'mid-take': {
    phase: 'hold',
    line: '',
    chip: mercLine('steady', 'steady-keep'),
    mercState: 'lock',
    mercPlace: 'inside',
    voice: 'on',
    level: fillLevel(MID_SECONDS / GOAL_SECONDS, 0),
    glow: 1,
    shine: 0,
    inBandSeconds: MID_SECONDS,
    now: MID_NOW,
    trace: voiceUpTo(MID_NOW, onLine, BAND),
    summary: null,
  },
  'demo-off': {
    phase: 'hold',
    line: '',
    chip: mercLine('driftSharp', 'sharp-touch'),
    mercState: 'sing',
    mercPlace: 'inside',
    voice: 'sharp',
    level: fillLevel(2.1 / GOAL_SECONDS, 0),
    glow: 0.25,
    shine: 0,
    inBandSeconds: 2.1,
    now: 5.4,
    trace: voiceUpTo(5.4, drifting, BAND),
    summary: null,
  },
  result: {
    phase: 'result',
    line: mercLine('resultBrim', 'result-brim-on'),
    chip: null,
    mercState: 'celebrate',
    mercPlace: 'beside',
    voice: 'silent',
    level: fillLevel(1, 1),
    glow: 0.25,
    shine: 1,
    inBandSeconds: 24.6,
    now: 26.2,
    trace: voiceUpTo(26.2, onLine, BAND),
    summary: {
      inBandSeconds: 24.6,
      steadiness: 82,
      locked: true,
      improved: false,
      full: true,
      brim: true,
    },
  },
} satisfies Record<string, LongNoteFixtureScene>

export type LongNoteFixtureName = keyof typeof FIXTURE_SCENES
