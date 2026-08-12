// Guitar Night Note Hunt controller binds exact neck choices to optional pitch-only evidence.
// ============================================================
//
// Touch can identify a physical string and fret. Room mic, interface, and MIDI
// evidence can only identify pitch; the controller keeps those truths apart.

import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal } from 'solid-js'
import type { NoteHuntPitchEvidence, NoteHuntPosition, NoteHuntState, } from '@/features/guitar/activities/note-hunt'
import { createNoteHuntPitchEvidenceAdapter, createNoteHuntRound, createNoteHuntState, noteHuntEvidenceMatchesTarget, noteHuntPositionId, reduceNoteHunt, } from '@/features/guitar/activities/note-hunt'
import type { GuitarInputEvent } from '@/lib/guitar/input-events'
import type { InstrumentTuning } from '@/lib/guitar/instrument-tuning'
import { noteHuntTuningSignature } from './note-hunt-progress'

interface GuitarNightNoteHuntControllerOptions {
  tuning: Accessor<InstrumentTuning>
  events: Accessor<readonly GuitarInputEvent[]>
  pitchRevision: Accessor<number>
  initialState?: NoteHuntState | null
  initialCompletedRoundCount?: number
  onState?(state: NoteHuntState, completedRoundCount: number): void
}

const TARGET_SEQUENCE = [4, 7, 2, 9, 0, 5, 11, 6, 1, 8, 3, 10] as const

function nextTargetPitchClass(state: NoteHuntState): number {
  const currentIndex = TARGET_SEQUENCE.indexOf(
    state.round.targetPitchClass as (typeof TARGET_SEQUENCE)[number],
  )
  const playable = new Set(
    state.round.neckPositions.map((position) => position.pitchClass),
  )
  for (let offset = 1; offset <= TARGET_SEQUENCE.length; offset += 1) {
    const pitchClass =
      TARGET_SEQUENCE[
        (currentIndex + offset + TARGET_SEQUENCE.length) %
          TARGET_SEQUENCE.length
      ]
    if (pitchClass !== undefined && playable.has(pitchClass)) return pitchClass
  }
  return state.round.targetPitchClass
}

function targetPositionLabel(position: NoteHuntPosition): string {
  return position.fret === 0
    ? `string ${position.stringIndex + 1}, open`
    : `string ${position.stringIndex + 1}, fret ${position.fret}`
}

function initialRound(tuning: InstrumentTuning) {
  try {
    return createNoteHuntRound(tuning, { targetPitchClass: 4 })
  } catch {
    return createNoteHuntRound(tuning, { random: () => 0 })
  }
}

export function useGuitarNightNoteHuntController(
  options: GuitarNightNoteHuntControllerOptions,
) {
  const initial =
    options.initialState ?? createNoteHuntState(initialRound(options.tuning()))
  const [state, setState] = createSignal<NoteHuntState>(initial)
  const [completedRoundCount, setCompletedRoundCount] = createSignal(
    options.initialCompletedRoundCount ?? 0,
  )
  const [lastPitchEvidence, setLastPitchEvidence] =
    createSignal<NoteHuntPitchEvidence | null>(null)
  const evidenceAdapter = createNoteHuntPitchEvidenceAdapter()

  let tuningSignature = noteHuntTuningSignature(options.tuning())
  const publish = (
    next: NoteHuntState,
    roundCount = completedRoundCount(),
  ): void => {
    setState(next)
    setCompletedRoundCount(roundCount)
    options.onState?.(next, roundCount)
  }

  createEffect(() => {
    options.pitchRevision()
    const fresh = evidenceAdapter.consume(options.events())
    const latest = fresh.at(-1)
    if (latest === undefined) return
    setLastPitchEvidence(latest)
    const current = state()
    setState({
      ...current,
      marks: Object.fromEntries(
        Object.entries(current.marks).filter(([, mark]) => mark === 'correct'),
      ),
      lastAttempt: null,
    })
  })

  createEffect(() => {
    const nextSignature = noteHuntTuningSignature(options.tuning())
    if (nextSignature === tuningSignature) return
    tuningSignature = nextSignature
    setLastPitchEvidence(null)
    const round = createNoteHuntRound(options.tuning(), {
      fretRange: state().round.fretRange,
      random: () => 0,
    })
    publish(createNoteHuntState(round), 0)
  })

  const markPosition = (stringIndex: number, fret: number): void => {
    const current = state()
    const calmState: NoteHuntState = {
      ...current,
      marks: Object.fromEntries(
        Object.entries(current.marks).filter(([, mark]) => mark === 'correct'),
      ),
    }
    const next = reduceNoteHunt(calmState, {
      type: 'mark-position',
      stringIndex,
      fret,
    })
    const roundCount =
      current.phase === 'active' && next.phase === 'complete'
        ? completedRoundCount() + 1
        : completedRoundCount()
    publish(next, roundCount)
  }

  const startNextRound = (): void => {
    const current = state()
    const round = createNoteHuntRound(options.tuning(), {
      fretRange: current.round.fretRange,
      targetPitchClass: nextTargetPitchClass(current),
    })
    setLastPitchEvidence(null)
    publish(createNoteHuntState(round))
  }

  const feedback = createMemo(() => {
    const current = state()
    if (current.phase === 'complete') {
      return `Every ${current.round.targetNoteName} in this fret window is marked.`
    }
    const attempt = current.lastAttempt
    if (attempt?.outcome === 'correct') {
      const found = current.round.neckPositions.find(
        (position) => position.id === attempt.positionId,
      )
      return found === undefined
        ? 'Position marked.'
        : `${targetPositionLabel(found)} marked. Keep looking.`
    }
    if (attempt?.outcome === 'wrong') {
      return `That position is not ${current.round.targetNoteName}. Try another.`
    }
    if (attempt?.outcome === 'already-found') {
      return 'That position is already marked. Find another one.'
    }
    const heard = lastPitchEvidence()
    if (heard !== null && noteHuntEvidenceMatchesTarget(heard, current.round)) {
      return `${current.round.targetNoteName} heard. Tap the place where you played it.`
    }
    if (heard !== null) {
      return `${heard.noteName} heard. Keep looking for ${current.round.targetNoteName}.`
    }
    return `Tap every ${current.round.targetNoteName} you can find between frets ${current.round.fretRange.firstFret} and ${current.round.fretRange.lastFret}.`
  })

  const cellState = (
    stringIndex: number,
    fret: number,
  ): 'idle' | 'found' | 'miss' => {
    const mark = state().marks[noteHuntPositionId(stringIndex, fret)]
    if (mark === 'correct') return 'found'
    if (mark === 'wrong') return 'miss'
    return 'idle'
  }

  const round = createMemo(() => state().round)
  const foundCount = createMemo(() => state().foundCount)
  const complete = createMemo(() => state().phase === 'complete')

  return {
    state,
    round,
    foundCount,
    complete,
    completedRoundCount,
    lastPitchEvidence,
    feedback,
    cellState,
    markPosition,
    startNextRound,
  }
}

export type GuitarNightNoteHuntController = ReturnType<
  typeof useGuitarNightNoteHuntController
>
