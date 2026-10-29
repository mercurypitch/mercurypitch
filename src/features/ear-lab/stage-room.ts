// ============================================================
// The native room's seam into the stage (EAR_LAB_WITH_MERC).
//
// On a phone build with the switch on, EarStage hands its props to the
// room (features/ear-lab/merc, a lazy chunk) instead of drawing the
// web's stage. The room draws its own chrome: a header, the run line,
// the world and Merc's console. What it needs beyond the stage's props
// the views pass as `room`, built only behind the switch, so the web and
// the store build carry none of it. The console's parts (the pads, the
// lead pads, the tap pad, the plate, the answer-mode toggle) are still
// the drills' own: under the room, each asks the skin below for the
// room's version of itself.
//
// Types only, plus the one-shot start request a station row or Today's
// button leaves for the drill it opens: the runtime is the room's. The
// skin's contract is EarStage.tsx's, beside the parts it names.
// ============================================================

import { createSignal } from 'solid-js'
import type { ReplayRun } from './replay-policy'

/** Where the question is, for Merc's pose, the pads and the pinned row. */
export type RoomBeat = 'idle' | 'listen' | 'answer' | 'reveal' | 'done'

/** An identification run's phase (use-identification-controller.ts,
 *  spelled out here so this file imports no engine) as the room's beat:
 *  the prompt sounding is the room listening. */
export function identificationBeat(
  phase: 'idle' | 'playing' | 'answer' | 'reveal' | 'done',
): RoomBeat {
  return phase === 'playing' ? 'listen' : phase
}

/** One verdict on a staircase, for the run line's trace. */
export interface TracePoint {
  level: number
  /** The verdict turned the staircase round. */
  turn: boolean
}

/** The live line under the room's header. Never a rating, never a
 *  verdict's colour: it counts, and the plate judges. */
export type RoomRunLine =
  | {
      kind: 'threshold'
      /** "Gap 12.0¢": the caption and the level, formatted. */
      level: string
      left: number
      trace: readonly TracePoint[]
      /** Turns so far, for Close's question. */
      turns: number
    }
  | {
      kind: 'calibration'
      /** 1-based. */
      track: number
      tracks: number
      left: number
      /** Questions answered so far. */
      answered: number
    }
  | {
      kind: 'rounds'
      /** "Round", "Call". */
      noun?: string
      /** 1-based: the round sounding or answered. */
      round: number
      total: number
      /** Answered so far: the dots fill as rounds pass. */
      answered: number
      /** Said after the count: "100 BPM". */
      extra?: string
    }

/** A threshold run's plate, in numbers: the room words it. */
export interface ThresholdPlate {
  kind: 'threshold'
  /** The reading, or null when the run stopped before one. */
  value: number | null
  /** A reading as the drill prints it, without its unit. */
  format: (value: number) => string
  /** "cents", under the number. */
  unit: string
  /** "¢", inline. */
  unitShort: string
  /** Hairline's cents fall as the ear sharpens; Span's notes climb. */
  lowerIsBetter: boolean
  /** The newest reading before this run, or null for a first. */
  previous: number | null
  /** A sealed calibration's run, marked or stopped short. */
  calibration: boolean
  /** The Index the seal marked. */
  markedIndex?: number
  /** Each track's own reading, a seal's three in track order: null for
   *  a track that found no threshold. */
  tracks?: ReadonlyArray<number | null>
  provisional: boolean
  /** The shipped note under the number: what it means for the glass. */
  note: string
  trials: number
  turns: number
  replays: number
}

/** One of a run's slips, as a count: "4 Fa" heard as "5 Sol", twice. */
export interface PlateSlip {
  expected: string
  answered: string
  count: number
  /** Start a pair practice on the two (pair-practice.ts). Absent where
   *  the answer was not an item of the drill: a tapped-back line, a
   *  direction. */
  practise?: () => void
}

/** A rated run's plate. */
export interface RatingPlate {
  kind: 'rating'
  rating: number
  /** The rating before this run, for "Up 12 from 1240". */
  before: number
  /** "Home rating": where the number lives. */
  source: string
  /** Answers still settling the rating, or null once settled. */
  settling: number | null
  /** What the settling counts: "answers" unless the drill says "calls". */
  settlingNoun?: string
  rounds: number
  /** Named, met, tapped clean: the rounds got right. */
  right: number
  /** "named", "tapped clean". */
  rightWord?: string
  outcomes: ReadonlyArray<{
    correct: boolean
    skipped?: boolean
    title: string
  }>
  /** This run's slips, as counts: "4 Fa" heard as "5 Sol", twice. */
  slips: readonly PlateSlip[]
  /** Further shipped lines: the round trip, ear against voice. */
  lines?: readonly string[]
}

/** A pair practice's plate: the rounds named right, and the rating it
 *  left alone. */
export interface PracticePlate {
  kind: 'practice'
  /** The two items, as the drill names them. */
  against: readonly [string, string]
  /** The drill's rating, untouched by the run, and where it lives. */
  rating: number
  source: string
  rounds: number
  right: number
  rightWord?: string
  outcomes: RatingPlate['outcomes']
  slips: readonly PlateSlip[]
}

export type RoomPlate = ThresholdPlate | RatingPlate | PracticePlate

/** What a view tells the native room beyond the stage's own props. */
export interface StageRoom {
  /** The honesty rules the run is under. */
  run: () => ReplayRun
  /** A Today's short run: the mode line and the plate say so. */
  short?: () => boolean
  /** The sealed protocol's own room (Calibration from the bench). */
  ritual?: boolean
  beat: () => RoomBeat
  /** A test sound is playing: the question's, a replay's, a miss's. */
  sounding: () => boolean
  /** The task in full, for Merc's first bubble. */
  prompt: string
  line: () => RoomRunLine | null
  /** What the pinned row says while nothing is due: "Playing 2 of 2",
   *  "Beat 3 of 4". Null for the room's own words. */
  pinned?: () => string | null
  /** Hear it again. Absent when the drill cannot replay faithfully. */
  replay?: {
    allowed: () => boolean
    play: () => void
    /** Replays still open before this answer, where they are counted. */
    left?: () => number | null
  }
  /** The verdict waits for Next. */
  parked: () => boolean
  next: () => void
  /** A hold counting down waits for Next instead (a touch on the
   *  instrument, a replay). */
  pause?: () => void
  /** The sound was taken away: the question in flight is void. */
  hold?: () => void
  /** The voided question waits for resume. */
  held?: () => boolean
  /** Sound the voided question again from its start. */
  resume?: () => void
  /** Leave mid-run keeping nothing. */
  abandon: () => void
  /** "sung answers": said after the mode in the header. */
  modeNote?: () => string | null
  /** A pair practice's two items, as the drill names them, for Merc's
   *  first line; null for any other run. */
  practising?: () => readonly [string, string] | null
  plate?: () => RoomPlate | null
  again?: () => void
  /** A sealed calibration of this drill, offered on a practice plate. */
  calibrate?: () => void
}

// ── A run that starts as its room opens ─────────────────────────

/** A station row or Today's button asked for a run, not a room to look
 *  at: the drill starts it as it mounts. */
export interface RoomStartRequest {
  /** The drill's store id ('the-grid', 'hairline'). */
  drillId: string
}

const [startRequest, setStartRequest] = createSignal<RoomStartRequest | null>(
  null,
)

export function requestRoomStart(request: RoomStartRequest): void {
  setStartRequest(request)
}

/** The request for this drill, consumed; null when there is none. */
export function takeRoomStart(drillId: string): RoomStartRequest | null {
  const request = startRequest()
  if (request === null || request.drillId !== drillId) return null
  setStartRequest(null)
  return request
}
