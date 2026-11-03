// ============================================================
// A First note turn's ears: the voice heard against the singer's note
// ============================================================
//
// What useFirstNoteController keeps for each round, from its lead-in to its
// outcome: the sequence engine and the one note it hears (the song's
// first, first-note-ears.ts), the frames followed so far, the voice's trail
// and its readings off the note, from which the singer's entry is taken.
// Each event the engine reaches is marked for the demo; once the note is
// decided, the round's outcome goes back to the room.
//
// A round's ears are reset as its lead-in starts (`reset`), opened where
// the band stops (`open`), and its frames followed as they come, a run's
// from the mic or the demo's from its take.

import { levelFromRms } from '@/components/room-kit/voice-level'
import type { TrailPoint } from '@/components/room-kit/voice-trail'
import { trailPoint } from '@/components/room-kit/voice-trail'
import type { PitchPoint } from '@/lib/hold/hold-reading'
import { offTarget } from '@/lib/hold/hold-reading'
import type { MercVoice } from '@/lib/merc/sim'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { NoteOutcome, Phrase, SequenceEvent, SequenceState, } from '@/lib/sequence/sequence-engine'
import { createSequenceState, tickSequence, } from '@/lib/sequence/sequence-engine'
import { entryHeardIn, entryPhrase } from './first-note-ears'
import type { EntryHeard, RoundOutcome } from './first-note-machine'
import type { FirstNoteLevel } from './first-note-rules'
import type { FirstNoteRound } from './first-note-songs'
import { entryPitch } from './first-note-songs'
import type { FirstNoteDemoMark } from './scripted-take'

/** What the turn asks of the room as it hears. */
export interface TurnHost {
  /** The singer's turn is on: its frames count. */
  readonly singing: () => boolean
  /** The room still listens: an outcome stops it mid-batch. */
  readonly listening: () => boolean
  /** The singer's entry, once taken; null before. */
  readonly entry: () => EntryHeard | null
  /** The singer has come in: their first steady note. */
  readonly entered: (entry: EntryHeard) => void
  /**
   * The voice as heard now, for Merc's face, and whether it is in the
   * note's band: null for no voice in this frame.
   */
  readonly heard: (voice: MercVoice | null, inBand: boolean) => void
  /** The band was heard again before the round was decided. */
  readonly heardAgain: () => boolean
  readonly mark: (moment: FirstNoteDemoMark) => void
  /** The round's note is decided: its outcome. */
  readonly decided: (outcome: RoundOutcome) => void
}

export interface FirstTurn {
  /** A round's lead-in: nothing heard or followed yet, the engine shut. */
  reset: (round: FirstNoteRound, rules: FirstNoteLevel) => void
  /** The band has stopped: the engine hears from `responseStart`, frames' clock. */
  open: (responseStart: number) => void
  /** The window's frames so far: those not yet heard are heard now. */
  follow: (frames: readonly PitchFrame[]) => void
  /** The voice's trail so far. */
  points: () => readonly TrailPoint[]
  /** When the engine starts hearing, frames' clock: never before the turn. */
  responseStart: () => number
  /** No round, no trail, nothing heard: the room at rest. */
  clear: () => void
}

/** The round's outcome, from its note's as the engine decided it. */
function outcomeOf(
  note: NoteOutcome,
  round: FirstNoteRound,
  entry: EntryHeard | null,
  responseStart: number,
  heardAgain: boolean,
): RoundOutcome {
  if (!note.landed) {
    return {
      round,
      entry,
      landed: false,
      seconds: null,
      voiced: note.voiced,
      heardAgain,
    }
  }
  return {
    round,
    // A voice that landed before its entry was taken came in on it.
    entry: entry ?? { cents: note.cents, onNote: true },
    landed: true,
    seconds: Math.max(0, note.onset - responseStart),
    voiced: true,
    heardAgain,
  }
}

interface Heard {
  readonly round: FirstNoteRound
  readonly rules: FirstNoteLevel
  readonly phrase: Phrase
  /** The note, MIDI: the song's first, as the band plays it. */
  readonly target: number
}

export function createFirstTurn(host: TurnHost): FirstTurn {
  let opened: Heard | null = null
  let engine: SequenceState = createSequenceState(Number.POSITIVE_INFINITY)
  let processed = 0
  let points: TrailPoint[] = []
  /** The turn's readings off the note, as sung: the entry's ears. */
  let heard: PitchPoint[] = []

  /** The singer's voice against the note: the trail, the band, Merc's face. */
  const hear = (frame: PitchFrame, turn: Heard): void => {
    const point = trailPoint(frame, turn.target)
    points.push(point)
    const off = offTarget(frame, turn.target)
    if (off !== null) heard.push({ t: frame.t, cents: off })
    if (point.cents === null) {
      host.heard(null, false)
      return
    }
    const tol = turn.rules.tolCents
    host.heard(
      {
        voiced: true,
        cents: point.cents,
        level: levelFromRms(frame.rms),
        steady: 1 - Math.min(1, Math.abs(point.cents) / tol),
        midi: turn.target + point.cents / 100,
      },
      Math.abs(point.cents) <= tol,
    )
  }

  /** The singer's first steady note: where they came in. */
  const listenForEntry = (turn: Heard): void => {
    if (host.entry() !== null) return
    const entry = entryHeardIn(heard, turn.round, turn.rules)
    if (entry !== null) host.entered(entry)
  }

  const onEvent = (event: SequenceEvent, turn: Heard): void => {
    if (event.type === 'phraseEnd') {
      host.mark('phraseEnd')
      return
    }
    host.mark(`${event.type}:${event.index}`)
    const note = engine.outcomes[event.index]
    if (note === undefined) return
    host.decided(
      outcomeOf(
        note,
        turn.round,
        host.entry(),
        engine.responseStart,
        host.heardAgain(),
      ),
    )
  }

  const clear = (): void => {
    opened = null
    engine = createSequenceState(Number.POSITIVE_INFINITY)
    processed = 0
    points = []
    heard = []
  }

  return {
    reset: (round, rules) => {
      clear()
      const target = entryPitch(round.entry)
      opened = { round, rules, phrase: entryPhrase(round), target }
    },
    open: (responseStart) => {
      engine = createSequenceState(responseStart)
    },
    follow: (frames) => {
      const from = processed
      processed = frames.length
      const turn = opened
      if (turn === null) return
      for (let i = from; i < frames.length && host.listening(); i++) {
        const frame = frames[i]
        if (!host.singing() || frame.t < engine.responseStart) continue
        hear(frame, turn)
        listenForEntry(turn)
        engine = tickSequence(engine, frame, turn.phrase, turn.rules)
        for (const event of engine.events) {
          onEvent(event, turn)
          if (!host.singing()) return
        }
      }
    },
    points: () => points,
    responseStart: () => engine.responseStart,
    clear,
  }
}
