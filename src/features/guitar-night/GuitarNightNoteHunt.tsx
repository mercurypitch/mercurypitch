// Guitar Night Note Hunt is a stage-first, exact-position fretboard lesson.
// ============================================================
//
// The neck is the primary action. Listening is optional pitch evidence and
// never marks a physical location on the player's behalf.

import type { Accessor } from 'solid-js'
import { createEffect, createMemo, onCleanup, Show } from 'solid-js'
import type { NoteHuntState } from '@/features/guitar/activities/note-hunt'
import { createGuitarRoomBand } from '@/features/guitar/backing/guitar-room-band'
import type { GuitarPerformanceStageSource } from '@/features/guitar/runtime/guitar-performance-contract'
import type { InstrumentTuning } from '@/lib/guitar/instrument-tuning'
import styles from './GuitarNightApp.module.css'
import { GuitarNightInputError } from './GuitarNightInputError'
import { GuitarNightLearnActivityShell } from './GuitarNightLearnActivity'
import { GuitarNightLearnListeningControls } from './GuitarNightLearnListeningControls'
import { GuitarNightStage } from './GuitarNightStage'
import { useGuitarListeningController } from './useGuitarListeningController'
import { useGuitarNightNoteHuntController } from './useGuitarNightNoteHuntController'

interface GuitarNightNoteHuntProps {
  tuning: Accessor<InstrumentTuning>
  active: Accessor<boolean>
  initialState?: NoteHuntState | null
  initialCompletedRoundCount?: number
  headingRef?(element: HTMLHeadingElement): void
  onState?(state: NoteHuntState, completedRoundCount: number): void
  onBack(): void
}

const NOTE_HUNT_STAGE: GuitarPerformanceStageSource = {
  title: () => 'Note Hunt',
  notes: () => [],
  timeline: {
    positionSeconds: () => 0,
    durationSeconds: () => 0,
    playheadBeat: () => null,
    tempoBpm: () => null,
  },
}

export function GuitarNightNoteHunt(props: GuitarNightNoteHuntProps) {
  let room!: HTMLElement
  let listeningAction: HTMLButtonElement | undefined
  const band = createGuitarRoomBand()
  const listening = useGuitarListeningController({
    activateAudio: async () => (await band.activate()) !== null,
    getAudioGraph: band.getAudioGraph,
  })
  const hunt = useGuitarNightNoteHuntController({
    tuning: () => props.tuning(),
    events: listening.events,
    pitchRevision: listening.pitchRevision,
    initialState: props.initialState,
    initialCompletedRoundCount: props.initialCompletedRoundCount,
    onState: (state, completedRoundCount) =>
      props.onState?.(state, completedRoundCount),
  })
  const isListening = createMemo(
    () =>
      listening.status() === 'requesting' || listening.status() === 'listening',
  )
  const leave = (): void => {
    listening.stop()
    props.onBack()
  }

  const startNextRound = (): void => {
    hunt.startNextRound()
    queueMicrotask(() => {
      room.querySelector<HTMLElement>('[data-interactive="true"]')?.scrollTo({
        top: 0,
      })
      listeningAction?.focus({ preventScroll: true })
    })
  }

  createEffect(() => {
    if (props.active()) return
    listening.stop()
  })

  onCleanup(() => {
    listening.stop()
    void band.dispose()
  })

  return (
    <GuitarNightLearnActivityShell
      testId="guitar-night-note-hunt"
      name="Note Hunt"
      title={`Find every ${hunt.round().targetNoteName}.`}
      progress={`${hunt.foundCount()} of ${hunt.round().targetPositions.length} marked`}
      roomRef={(element) => {
        room = element
      }}
      headingRef={props.headingRef}
      onBack={leave}
    >
      <GuitarNightStage
        source={NOTE_HUNT_STAGE}
        active={props.active}
        tuning={props.tuning}
        initialMode="neck"
        availableViews={() => ['neck']}
        showHeader={() => false}
        neckLabel={() =>
          `Find every ${hunt.round().targetNoteName} between frets ${hunt.round().fretRange.firstFret} and ${hunt.round().fretRange.lastFret}. ${hunt.foundCount()} of ${hunt.round().targetPositions.length} positions marked.`
        }
        listening={isListening}
        heardNote={listening.currentNote}
        heardClarity={listening.clarity}
        idleStatus={() => ({
          label: 'Note Hunt',
          detail: `${hunt.foundCount()} of ${hunt.round().targetPositions.length} positions marked`,
        })}
        neckInteraction={{
          frets: () => {
            const range = hunt.round().fretRange
            return Array.from(
              { length: range.lastFret - range.firstFret + 1 },
              (_, index) => range.firstFret + index,
            )
          },
          cellState: (position) =>
            hunt.cellState(position.stringIndex, position.fret),
          onSelect: (position) =>
            hunt.markPosition(position.stringIndex, position.fret),
        }}
      />

      <div class={styles.noteHuntDeck}>
        <div class={styles.noteHuntProgress}>
          <strong data-testid="guitar-night-note-hunt-progress">
            {hunt.foundCount()} of {hunt.round().targetPositions.length} marked
            {' · '}Frets {hunt.round().fretRange.firstFret}–
            {hunt.round().fretRange.lastFret}
          </strong>
          <p role="status" aria-live="polite">
            {hunt.feedback()}
          </p>
        </div>

        <div class={styles.noteHuntControls}>
          <Show
            when={hunt.complete()}
            fallback={
              <GuitarNightLearnListeningControls
                controller={listening}
                hint="Pitch only · tap marks the position"
                actionRef={(element) => {
                  listeningAction = element
                }}
              />
            }
          >
            <button
              type="button"
              class={styles.noteHuntNext}
              onClick={startNextRound}
            >
              <strong>Find another note</strong>
              <small>New target, same small fret window</small>
            </button>
          </Show>
        </div>
      </div>

      <GuitarNightInputError
        message={listening.error}
        canTakeOver={listening.canTakeOverInput}
        takeoverPending={listening.inputTakeoverPending}
        onTakeOver={() => void listening.useInputHere()}
      />
    </GuitarNightLearnActivityShell>
  )
}
