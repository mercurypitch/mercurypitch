// Guitar Night Note Hunt is a stage-first, exact-position fretboard lesson.
// ============================================================
//
// The neck is the primary action. Listening is optional pitch evidence and
// never marks a physical location on the player's behalf.

import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal, onCleanup, onMount, Show, } from 'solid-js'
import { ChevronLeft, Mic } from '@/components/icons'
import type { NoteHuntState } from '@/features/guitar/activities/note-hunt'
import { createGuitarRoomBand } from '@/features/guitar/backing/guitar-room-band'
import type { GuitarPerformanceStageSource } from '@/features/guitar/runtime/guitar-performance-contract'
import type { InstrumentTuning } from '@/lib/guitar/instrument-tuning'
import styles from './GuitarNightApp.module.css'
import { GuitarNightInputError } from './GuitarNightInputError'
import { GuitarNightInputPicker } from './GuitarNightInputPicker'
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
  let heading!: HTMLHeadingElement
  let listeningAction: HTMLButtonElement | undefined
  const [adjustOpen, setAdjustOpen] = createSignal(false)
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
  const listeningLabel = createMemo(() =>
    isListening() ? 'Stop listening' : 'Start listening',
  )

  const toggleListening = (): void => {
    if (isListening()) {
      listening.stop()
      return
    }
    void listening.start()
  }

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

  onMount(() => {
    props.headingRef?.(heading)
    heading.focus({ preventScroll: true })
  })
  onCleanup(() => {
    listening.stop()
    void band.dispose()
  })

  return (
    <section
      ref={room}
      class={styles.noteHuntRoom}
      data-testid="guitar-night-note-hunt"
      data-stage-scope="true"
    >
      <div class={styles.roomHeadingRow}>
        <div class={styles.roomIdentity}>
          <button
            class={styles.roomBack}
            type="button"
            aria-label="Back from Note Hunt"
            onClick={leave}
          >
            <ChevronLeft />
          </button>
          <div>
            <p class={styles.eyebrow}>Learn · Note Hunt</p>
            <h1 ref={heading} tabindex="-1">
              Find every {hunt.round().targetNoteName}.
            </h1>
          </div>
        </div>
        <span class={styles.noteHuntHeadingProgress}>
          {hunt.foundCount()} of {hunt.round().targetPositions.length} marked
        </span>
      </div>

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
              <button
                ref={listeningAction}
                type="button"
                class={styles.noteHuntListen}
                aria-pressed={isListening()}
                disabled={listening.status() === 'requesting'}
                onClick={toggleListening}
              >
                <span aria-hidden="true">
                  <Mic />
                </span>
                <span>
                  <strong>{listeningLabel()}</strong>
                  <small>Pitch only · tap marks the position</small>
                </span>
              </button>
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

          <details
            class={styles.noteHuntAdjust}
            onToggle={(event) => setAdjustOpen(event.currentTarget.open)}
          >
            <summary>Adjust input</summary>
            <Show when={adjustOpen()}>
              <div>
                <GuitarNightInputPicker
                  profile={listening.inputProfile}
                  profileLabel={listening.inputProfileLabel}
                  audioInputs={listening.audioInputs}
                  selectedAudioInputId={listening.selectedAudioInputId}
                  midiInputs={listening.midiInputs}
                  selectedMidiInputId={listening.selectedMidiInputId}
                  midiStatus={listening.midiConnectionStatus}
                  evidenceExportEnabled={listening.evidenceExportEnabled}
                  canExportEvidence={listening.canExportEvidence}
                  switching={() =>
                    listening.status() === 'requesting' ||
                    listening.inputTakeoverPending() ||
                    listening.midiConnectionStatus() === 'requesting'
                  }
                  onProfile={(kind) => void listening.selectInputProfile(kind)}
                  onAudioInput={(deviceId) =>
                    void listening.selectAudioInput(deviceId)
                  }
                  onMidiInput={(deviceId) =>
                    void listening.selectMidiInput(deviceId)
                  }
                  onRefreshAudio={() => void listening.refreshAudioInputs()}
                  onRefreshMidi={() => void listening.refreshMidiInputs()}
                  onExportEvidence={listening.exportEvidenceReport}
                />
              </div>
            </Show>
          </details>
        </div>
      </div>

      <GuitarNightInputError
        message={listening.error}
        canTakeOver={listening.canTakeOverInput}
        takeoverPending={listening.inputTakeoverPending}
        onTakeOver={() => void listening.useInputHere()}
      />
    </section>
  )
}
