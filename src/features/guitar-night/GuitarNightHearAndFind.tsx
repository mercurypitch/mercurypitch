// Guitar Night Hear & Find turns one requested reference note into a bounded neck search.
// ============================================================

import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, Show, untrack, } from 'solid-js'
import type { HearFindLevelId, HearFindState, } from '@/features/guitar/activities/learn-activities'
import { createHearFindRound, createHearFindState, HEAR_FIND_LEVELS, reduceHearFind, } from '@/features/guitar/activities/learn-activities'
import { createNoteHuntPitchEvidenceAdapter } from '@/features/guitar/activities/note-hunt'
import { createGuitarRoomBand } from '@/features/guitar/backing/guitar-room-band'
import type { GuitarPerformanceStageSource } from '@/features/guitar/runtime/guitar-performance-contract'
import type { InstrumentTuning } from '@/lib/guitar/instrument-tuning'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import { playGuitarNightLearnGuide } from './guitar-night-learn-audio'
import styles from './GuitarNightApp.module.css'
import { GuitarNightInputError } from './GuitarNightInputError'
import { GuitarNightLearnActivityShell, guitarNightLearnTuningLabel, } from './GuitarNightLearnActivity'
import { GuitarNightLearnListeningControls } from './GuitarNightLearnListeningControls'
import { GuitarNightStage } from './GuitarNightStage'
import { useGuitarListeningController } from './useGuitarListeningController'

interface GuitarNightHearAndFindProps {
  tuning: Accessor<InstrumentTuning>
  active: Accessor<boolean>
  onBack(): void
}

const HEAR_FIND_STAGE: GuitarPerformanceStageSource = {
  title: () => 'Hear & Find',
  notes: () => [],
  timeline: {
    positionSeconds: () => 0,
    durationSeconds: () => 0,
    playheadBeat: () => null,
    tempoBpm: () => null,
  },
}

export function GuitarNightHearAndFind(props: GuitarNightHearAndFindProps) {
  const band = createGuitarRoomBand()
  const listening = useGuitarListeningController({
    activateAudio: async () => (await band.activate()) !== null,
    getAudioGraph: band.getAudioGraph,
  })
  const evidence = createNoteHuntPitchEvidenceAdapter()
  const [level, setLevel] = createSignal<HearFindLevelId>('near-nut')
  const [roundIndex, setRoundIndex] = createSignal(0)
  const [state, setState] = createSignal<HearFindState>(
    untrack(() => createHearFindState(createHearFindRound(props.tuning()))),
  )
  const [playingReference, setPlayingReference] = createSignal(false)
  const [audioError, setAudioError] = createSignal<string | null>(null)
  const isListening = createMemo(
    () =>
      listening.status() === 'requesting' || listening.status() === 'listening',
  )

  const resetRound = (nextLevel = level(), nextIndex = roundIndex()): void => {
    band.stop()
    listening.stop()
    evidence.reset()
    setPlayingReference(false)
    setAudioError(null)
    setState(
      createHearFindState(
        createHearFindRound(props.tuning(), nextLevel, nextIndex),
      ),
    )
  }

  const playReference = async (): Promise<void> => {
    listening.stop()
    setAudioError(null)
    setPlayingReference(true)
    const started = await playGuitarNightLearnGuide(
      band,
      [state().round.targetMidi],
      {
        variant: props.tuning().instrument === 'bass' ? 'bass' : 'electric',
        noteBeats: 1.2,
        onComplete: () => {
          setPlayingReference(false)
          setState((current) =>
            reduceHearFind(current, { type: 'reference-played' }),
          )
        },
      },
    )
    if (!started) {
      setPlayingReference(false)
      setAudioError(
        'The reference note could not play. Allow audio for this site, then try again.',
      )
      return
    }
  }

  const answerPosition = (
    stringIndex: number,
    fret: number,
    midi: number,
  ): void => {
    setState((current) =>
      reduceHearFind(current, {
        type: 'answer',
        heardMidi: midi,
        positionId: `${stringIndex}:${fret}`,
      }),
    )
  }

  const nextRound = (): void => {
    const nextIndex = roundIndex() + 1
    setRoundIndex(nextIndex)
    resetRound(level(), nextIndex)
  }

  const feedback = createMemo(() => {
    const current = state()
    if (current.phase === 'complete') {
      const places = current.round.acceptedPositionIds.size
      return `${current.round.targetNoteName} found${places > 1 ? ` in ${places} places` : ''}. Same pitch, same answer.`
    }
    if (current.lastAttempt?.outcome === 'hear-first') {
      return 'Hear the reference first, then answer on the neck.'
    }
    if (current.lastAttempt?.outcome === 'wrong') {
      return `${midiToNoteNameOctave(current.lastAttempt.heardMidi)} is not the reference. Hear it again or try another place.`
    }
    if (current.phase === 'answering') {
      return 'Tap where that exact pitch lives. A matching unison is also correct.'
    }
    return 'The room stays quiet until you ask for the note.'
  })

  createEffect(() => {
    listening.pitchRevision()
    if (state().phase !== 'answering') return
    const latest = evidence.consume(listening.events()).at(-1)
    if (latest === undefined) return
    setState((current) =>
      reduceHearFind(current, { type: 'answer', heardMidi: latest.midi }),
    )
  })

  createEffect(() => {
    if (props.active()) return
    listening.stop()
    band.stop()
    setPlayingReference(false)
  })

  onCleanup(() => {
    listening.stop()
    void band.dispose()
  })

  return (
    <GuitarNightLearnActivityShell
      testId="guitar-night-hear-find"
      name="Hear & Find"
      title={
        state().phase === 'complete'
          ? `That was ${state().round.targetNoteName}.`
          : 'Find that sound.'
      }
      progress={`${HEAR_FIND_LEVELS.findIndex((candidate) => candidate.id === level()) + 1} of ${HEAR_FIND_LEVELS.length} · ${guitarNightLearnTuningLabel(props.tuning())}`}
      onBack={props.onBack}
    >
      <GuitarNightStage
        source={HEAR_FIND_STAGE}
        active={props.active}
        tuning={props.tuning}
        initialMode="neck"
        availableViews={() => ['neck']}
        showHeader={() => false}
        neckLabel={() =>
          `Hear and find between frets ${state().round.range.firstFret} and ${state().round.range.lastFret}. ${feedback()}`
        }
        listening={isListening}
        heardNote={listening.currentNote}
        heardClarity={listening.clarity}
        idleStatus={() => ({
          label: 'Hear & Find',
          detail: feedback(),
        })}
        neckInteraction={{
          frets: () => {
            const range = state().round.range
            return Array.from(
              { length: range.lastFret - range.firstFret + 1 },
              (_, index) => range.firstFret + index,
            )
          },
          cellState: (position) => {
            const current = state()
            if (
              current.phase === 'complete' &&
              current.round.acceptedPositionIds.has(
                `${position.stringIndex}:${position.fret}`,
              )
            ) {
              return 'found'
            }
            return current.lastAttempt?.positionId ===
              `${position.stringIndex}:${position.fret}` &&
              current.lastAttempt.outcome === 'wrong'
              ? 'miss'
              : 'idle'
          },
          onSelect: (position) =>
            answerPosition(position.stringIndex, position.fret, position.midi),
        }}
      />

      <div class={styles.noteHuntDeck}>
        <div class={styles.noteHuntProgress}>
          <Show
            when={state().phase === 'ready'}
            fallback={
              <strong>
                {
                  HEAR_FIND_LEVELS.find((candidate) => candidate.id === level())
                    ?.label
                }
                {' · '}Frets {state().round.range.firstFret}–
                {state().round.range.lastFret}
              </strong>
            }
          >
            <label class={styles.learnRangeControl}>
              <span>Fret window</span>
              <select
                value={level()}
                onChange={(event) => {
                  const nextLevel = event.currentTarget.value as HearFindLevelId
                  setLevel(nextLevel)
                  setRoundIndex(0)
                  resetRound(nextLevel, 0)
                }}
              >
                <For each={HEAR_FIND_LEVELS}>
                  {(candidate) => (
                    <option value={candidate.id}>
                      {candidate.label} · {candidate.detail}
                    </option>
                  )}
                </For>
              </select>
            </label>
          </Show>
          <p role="status" aria-live="polite">
            {feedback()}
          </p>
        </div>

        <div class={styles.noteHuntControls}>
          <Show
            when={state().phase === 'complete'}
            fallback={
              <button
                type="button"
                class={styles.noteHuntNext}
                disabled={playingReference()}
                onClick={() => void playReference()}
              >
                <strong>
                  {playingReference()
                    ? 'Playing…'
                    : state().phase === 'ready'
                      ? 'Hear the note'
                      : 'Hear it again'}
                </strong>
                <small>One clean reference · no count-in</small>
              </button>
            }
          >
            <button
              type="button"
              class={styles.noteHuntNext}
              onClick={nextRound}
            >
              <strong>Another note</strong>
              <small>Stay in this fret window</small>
            </button>
          </Show>
          <Show when={state().phase === 'answering'}>
            <GuitarNightLearnListeningControls
              controller={listening}
              hint="Optional · exact pitch only"
              disabled={playingReference()}
            />
          </Show>
        </div>
      </div>

      <GuitarNightInputError
        message={() => audioError() ?? listening.error()}
        canTakeOver={listening.canTakeOverInput}
        takeoverPending={listening.inputTakeoverPending}
        onTakeOver={() => void listening.useInputHere()}
      />
    </GuitarNightLearnActivityShell>
  )
}
