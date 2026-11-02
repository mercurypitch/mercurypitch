// ============================================================
// A Harmony turn's ears: the voice heard against the line
// ============================================================
//
// What useHarmonyController keeps for each line, from its call to its
// outcome: the sequence engine and the phrase it hears, the frames heard
// so far, the voice's trail along the lamps and the hold on the note the
// voice is on. Taking turns, that note is the engine's; together, it is
// the one Merc sings under it on his clock (harmony-ear.ts). Each event the
// engine reaches lights or misses a lamp and is marked for the demo; once
// every note is decided, the line's outcome goes back to the room.
//
// A line is opened once per call (`open`), its turn started as the call
// ends at the speaker (`start`), and its frames followed as they come, a
// run's from the mic or the demo's from its take.

import type { MercVoice } from '@/lib/merc/sim'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { Phrase, SequenceEvent, SequenceState, } from '@/lib/sequence/sequence-engine'
import { createSequenceState, tickSequence, } from '@/lib/sequence/sequence-engine'
import type { HarmonyLampState } from './harmony-controller-contract'
import type { HarmonyTrailPoint } from './harmony-ear'
import { readHarmonyVoice, togetherIndex, togetherPos, turnPos, } from './harmony-ear'
import type { HarmonyLine } from './harmony-line'
import type { LineOutcome } from './harmony-machine'
import { harmonyPhrase, lineOutcome } from './harmony-phrase'
import type { HarmonyLevel } from './harmony-rules'
import { MERC_GAP_SECONDS } from './harmony-rules'
import type { HarmonyDemoMark } from './scripted-take'

/** What the turn asks of the room as it hears. */
export interface TurnHost {
  /** The singer sings now: the turn's frames count. */
  readonly singing: () => boolean
  /** Sung together: the note is the one Merc sings on his clock. */
  readonly together: () => boolean
  /** The room still listens: an outcome stops it mid-batch. */
  readonly listening: () => boolean
  /** Merc was heard again before the line was decided. */
  readonly heardAgain: () => boolean
  readonly lamp: (index: number, state: HarmonyLampState) => void
  readonly mark: (moment: HarmonyDemoMark) => void
  /** Taking turns, Merc's face follows the voice: null for no voice heard. */
  readonly face: (voice: MercVoice | null) => void
  /** Every note is decided: the line's outcome. */
  readonly decided: (outcome: LineOutcome) => void
}

/** How a line is heard: the line, its rules, and when the voice may come in. */
export interface TurnOpening {
  readonly line: HarmonyLine
  /** The level's rules: the band, the hold and Merc's pace. */
  readonly rules: HarmonyLevel
  /** What the engine hears by: the level's rules, or its rules together. */
  readonly heardBy: HarmonyLevel
  /** Nothing is heard before this, frames' clock. */
  readonly responseStart: number
  /** The singer's turn begins, frames' clock. */
  readonly turnAt: number
}

/** The voice's trail along the lamps, its head and the hold on its note. */
export interface TurnTrail {
  readonly points: readonly HarmonyTrailPoint[]
  readonly head: HarmonyTrailPoint | null
  readonly hold: number
}

export interface HarmonyTurn {
  open: (opening: TurnOpening) => void
  /** The turn begins: the first note, from the turn's start. */
  start: () => void
  /** The window's frames so far: those not yet heard are heard now. */
  follow: (frames: readonly PitchFrame[]) => void
  /** The trail so far and the hold at `now`, frames' clock. */
  trail: (now: number) => TurnTrail
  /** No trail, no hold, nothing heard yet. */
  clear: () => void
  readonly turnAt: () => number
  readonly responseStart: () => number
}

export function createHarmonyTurn(host: TurnHost): HarmonyTurn {
  let opened: TurnOpening | null = null
  let engine: SequenceState = createSequenceState(0)
  let phrase: Phrase = { notes: [] }
  let processed = 0
  let points: HarmonyTrailPoint[] = []
  let voiced = false
  /** When the voice entered the band of its note, frames' clock; null outside. */
  let bandSince: number | null = null
  /** The harmony note the voice is on, and since when (frames' clock). */
  let onNote = 0
  let onNoteSince = 0

  const clear = (): void => {
    processed = 0
    points = []
    voiced = false
    bandSince = null
    onNote = 0
  }

  /** Merc's pace: from one of his notes to the next, s. */
  const step = (rules: HarmonyLevel): number =>
    rules.noteSeconds + MERC_GAP_SECONDS

  /** The note the voice is on now: the engine's, or Merc's clock's together. */
  const noteAt = (t: number, turn: TurnOpening): number => {
    const notes = turn.line.harmony.length
    return host.together()
      ? togetherIndex(t, turn.turnAt, step(turn.rules), notes)
      : Math.min(notes - 1, engine.current)
  }

  /** The singer's voice against its note: the trail, Merc's face, the band. */
  const hear = (frame: PitchFrame, turn: TurnOpening): void => {
    const note = noteAt(frame.t, turn)
    if (note !== onNote) {
      onNote = note
      onNoteSince = frame.t
      bandSince = null
    }
    const together = host.together()
    const notes = turn.line.harmony.length
    const pos = together
      ? togetherPos(frame.t, turn.turnAt, step(turn.rules), notes)
      : turnPos(note, onNoteSince, frame.t)
    const read = readHarmonyVoice(
      frame,
      turn.line.harmony[note],
      turn.rules.tolCents,
      pos,
    )
    points.push(read.point)
    if (read.voice !== null) voiced = true
    if (!together) host.face(read.voice)
    bandSince = read.inBand ? (bandSince ?? frame.t) : null
  }

  /** A note of the harmony landed or missed: its lamp says so. */
  const onEvent = (event: SequenceEvent): void => {
    if (event.type === 'phraseEnd') {
      host.mark('phraseEnd')
      return
    }
    host.lamp(event.index, event.type === 'land' ? 'lit' : 'missed')
    host.mark(`${event.type}:${event.index}`)
  }

  return {
    open: (opening) => {
      clear()
      opened = opening
      phrase = harmonyPhrase(opening.line, opening.rules)
      engine = createSequenceState(opening.responseStart)
    },
    start: () => {
      onNote = 0
      onNoteSince = opened?.turnAt ?? 0
    },
    follow: (frames) => {
      const turn = opened
      const from = processed
      processed = frames.length
      if (turn === null) return
      for (let i = from; i < frames.length && host.listening(); i++) {
        const frame = frames[i]
        if (!host.singing() || frame.t < engine.responseStart) continue
        hear(frame, turn)
        engine = tickSequence(engine, frame, phrase, turn.heardBy)
        for (const event of engine.events) onEvent(event)
        const outcome = lineOutcome(engine, turn.line, {
          voiced,
          heardAgain: host.heardAgain(),
        })
        if (outcome !== null) {
          host.decided(outcome)
          return
        }
      }
    },
    trail: (now) => {
      const last = points.length === 0 ? null : points[points.length - 1]
      const landMs = opened?.rules.landMs ?? 1
      const hold =
        bandSince === null
          ? 0
          : Math.min(1, Math.max(0, ((now - bandSince) * 1000) / landMs))
      return {
        points,
        head: last === null || last.midi === null ? null : last,
        hold,
      }
    },
    clear,
    turnAt: () => opened?.turnAt ?? 0,
    responseStart: () => engine.responseStart,
  }
}
