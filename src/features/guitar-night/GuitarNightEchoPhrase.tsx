// Guitar Night Echo a Phrase makes a short requested melody answerable one note at a time.
// ============================================================

import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal, For, Match, onCleanup, Show, Switch, untrack, } from 'solid-js'
import type { EchoPhraseState } from '@/features/guitar/activities/learn-activities'
import { createEchoPhrase, createEchoPhraseState, reduceEchoPhrase, } from '@/features/guitar/activities/learn-activities'
import { createNoteHuntPitchEvidenceAdapter } from '@/features/guitar/activities/note-hunt'
import { createGuitarRoomBand } from '@/features/guitar/backing/guitar-room-band'
import type { GuitarPerformanceStageSource } from '@/features/guitar/runtime/guitar-performance-contract'
import type { InstrumentTuning } from '@/lib/guitar/instrument-tuning'
import { midiToNoteName } from '@/lib/note-utils'
import { playGuitarNightLearnGuide } from './guitar-night-learn-audio'
import styles from './GuitarNightApp.module.css'
import { GuitarNightInputError } from './GuitarNightInputError'
import { GuitarNightLearnActivityShell, guitarNightLearnTuningLabel, } from './GuitarNightLearnActivity'
import { GuitarNightLearnListeningControls } from './GuitarNightLearnListeningControls'
import { GuitarNightStage } from './GuitarNightStage'
import { useGuitarListeningController } from './useGuitarListeningController'

interface GuitarNightEchoPhraseProps {
  tuning: Accessor<InstrumentTuning>
  active: Accessor<boolean>
  onBack(): void
}

const ECHO_STAGE: GuitarPerformanceStageSource = {
  title: () => 'Echo a Phrase',
  notes: () => [],
  timeline: {
    positionSeconds: () => 0,
    durationSeconds: () => 0,
    playheadBeat: () => null,
    tempoBpm: () => null,
  },
}

const ROOTS = [
  { pitchClass: 0, label: 'C' },
  { pitchClass: 2, label: 'D' },
  { pitchClass: 4, label: 'E' },
  { pitchClass: 5, label: 'F' },
  { pitchClass: 7, label: 'G' },
  { pitchClass: 9, label: 'A' },
] as const

export function GuitarNightEchoPhrase(props: GuitarNightEchoPhraseProps) {
  const band = createGuitarRoomBand()
  const listening = useGuitarListeningController({
    activateAudio: async () => (await band.activate()) !== null,
    getAudioGraph: band.getAudioGraph,
  })
  const evidence = createNoteHuntPitchEvidenceAdapter()
  const [rootPitchClass, setRootPitchClass] = createSignal(7)
  const [phraseLength, setPhraseLength] = createSignal(3)
  const [phraseIndex, setPhraseIndex] = createSignal(0)
  const [state, setState] = createSignal<EchoPhraseState>(
    untrack(() => createEchoPhraseState(createEchoPhrase(props.tuning()))),
  )
  const [playingGuide, setPlayingGuide] = createSignal(false)
  const [audioError, setAudioError] = createSignal<string | null>(null)
  const isListening = createMemo(
    () =>
      listening.status() === 'requesting' || listening.status() === 'listening',
  )

  const resetPhrase = (
    nextRoot = rootPitchClass(),
    nextLength = phraseLength(),
    nextIndex = phraseIndex(),
  ): void => {
    band.stop()
    listening.stop()
    evidence.reset()
    setPlayingGuide(false)
    setAudioError(null)
    setState(
      createEchoPhraseState(
        createEchoPhrase(props.tuning(), {
          rootPitchClass: nextRoot,
          length: nextLength,
          phraseIndex: nextIndex,
        }),
      ),
    )
  }

  const playNotes = async (
    midi: readonly number[],
    onComplete: () => void,
  ): Promise<void> => {
    listening.stop()
    setAudioError(null)
    setPlayingGuide(true)
    const started = await playGuitarNightLearnGuide(band, midi, {
      tempoBpm: 76,
      variant: props.tuning().instrument === 'bass' ? 'bass' : 'electric',
      onComplete: () => {
        setPlayingGuide(false)
        onComplete()
      },
    })
    if (!started) {
      setPlayingGuide(false)
      setAudioError(
        'The phrase could not play. Allow audio for this site, then try again.',
      )
      return
    }
  }

  const playPhrase = (): void => {
    const current = state()
    void playNotes(
      current.phrase.notes.map((note) => note.midi),
      () =>
        setState((latest) =>
          reduceEchoPhrase(latest, {
            type: 'phrase-played',
            restart: current.phase === 'ready',
          }),
        ),
    )
  }

  const repairNote = (): void => {
    const current = state()
    const note = current.phrase.notes[current.currentIndex]
    if (note === undefined) return
    void playNotes([note.midi], () =>
      setState((latest) => reduceEchoPhrase(latest, { type: 'repair-played' })),
    )
  }

  const answer = (
    pitchClass: number,
    positionId?: `${number}:${number}`,
  ): void => {
    setState((current) =>
      reduceEchoPhrase(current, { type: 'answer', pitchClass, positionId }),
    )
  }

  const nextPhrase = (): void => {
    const nextIndex = phraseIndex() + 1
    setPhraseIndex(nextIndex)
    resetPhrase(rootPitchClass(), phraseLength(), nextIndex)
  }

  const feedback = createMemo(() => {
    const current = state()
    if (current.phase === 'ready') {
      return 'Hear the complete phrase first. Nothing listens until you ask.'
    }
    if (current.phase === 'complete') {
      return 'Phrase complete. Every note arrived in order.'
    }
    if (current.phase === 'repair') {
      const heard = current.lastAttempt?.pitchClass
      return `${heard === undefined ? 'That note' : midiToNoteName(heard)} changed the line. Hear just this note, then continue from the same place.`
    }
    return `Answer note ${current.currentIndex + 1} of ${current.phrase.notes.length} on the neck or with optional listening.`
  })

  createEffect(() => {
    listening.pitchRevision()
    if (state().phase !== 'answering') return
    const latest = evidence.consume(listening.events()).at(-1)
    if (latest === undefined) return
    answer(latest.pitchClass)
  })

  createEffect(() => {
    if (props.active()) return
    listening.stop()
    band.stop()
    setPlayingGuide(false)
  })

  onCleanup(() => {
    listening.stop()
    void band.dispose()
  })

  return (
    <GuitarNightLearnActivityShell
      testId="guitar-night-echo-phrase"
      name="Echo a Phrase"
      title={
        state().phase === 'complete'
          ? 'The phrase is yours.'
          : state().phase === 'repair'
            ? 'Repair one note.'
            : state().phase === 'answering'
              ? `Your turn · note ${state().currentIndex + 1}.`
              : `Echo ${state().phrase.notes.length} notes.`
      }
      progress={`${midiToNoteName(rootPitchClass())} major · ${guitarNightLearnTuningLabel(props.tuning())}`}
      onBack={props.onBack}
    >
      <GuitarNightStage
        source={ECHO_STAGE}
        active={props.active}
        tuning={props.tuning}
        initialMode="neck"
        availableViews={() => ['neck']}
        showHeader={() => false}
        neckLabel={() => `Echo the short phrase. ${feedback()}`}
        listening={isListening}
        heardNote={listening.currentNote}
        heardClarity={listening.clarity}
        idleStatus={() => ({ label: 'Echo a Phrase', detail: feedback() })}
        neckInteraction={{
          frets: () => {
            const range = state().phrase.range
            return Array.from(
              { length: range.lastFret - range.firstFret + 1 },
              (_, index) => range.firstFret + index,
            )
          },
          cellState: (position) => {
            const attempt = state().lastAttempt
            if (
              attempt?.positionId !== `${position.stringIndex}:${position.fret}`
            ) {
              return 'idle'
            }
            return attempt.outcome === 'correct' ? 'found' : 'miss'
          },
          onSelect: (position) =>
            answer(
              position.midi % 12,
              `${position.stringIndex}:${position.fret}`,
            ),
        }}
      />

      <div class={styles.noteHuntDeck}>
        <div class={styles.noteHuntProgress}>
          <div
            class={styles.echoPhraseRail}
            role="list"
            aria-label={`${state().phrase.notes.length}-note phrase progress`}
          >
            <For each={state().phrase.notes}>
              {(note, index) => {
                const completed = () => index() < state().currentIndex
                const current = () => index() === state().currentIndex
                return (
                  <span
                    role="listitem"
                    data-complete={completed() ? 'true' : undefined}
                    data-current={current() ? 'true' : undefined}
                    aria-label={`Note ${index() + 1}${completed() ? `, ${note.noteName}, complete` : current() && state().phase !== 'ready' ? ', current' : ''}`}
                  >
                    {completed() || state().phase === 'complete'
                      ? note.noteName
                      : index() + 1}
                  </span>
                )
              }}
            </For>
          </div>
          <p role="status" aria-live="polite">
            {feedback()}
          </p>
          <Show when={state().phase === 'ready'}>
            <div class={styles.learnPhraseSettings}>
              <label>
                <span>Key</span>
                <select
                  value={rootPitchClass()}
                  onChange={(event) => {
                    const nextRoot = Number(event.currentTarget.value)
                    setRootPitchClass(nextRoot)
                    setPhraseIndex(0)
                    resetPhrase(nextRoot, phraseLength(), 0)
                  }}
                >
                  <For each={ROOTS}>
                    {(root) => (
                      <option value={root.pitchClass}>
                        {root.label} major
                      </option>
                    )}
                  </For>
                </select>
              </label>
              <label>
                <span>Length</span>
                <select
                  value={phraseLength()}
                  onChange={(event) => {
                    const nextLength = Number(event.currentTarget.value)
                    setPhraseLength(nextLength)
                    setPhraseIndex(0)
                    resetPhrase(rootPitchClass(), nextLength, 0)
                  }}
                >
                  <option value="3">3 notes</option>
                  <option value="4">4 notes</option>
                  <option value="5">5 notes</option>
                </select>
              </label>
            </div>
          </Show>
        </div>

        <div class={styles.noteHuntControls}>
          <Switch>
            <Match when={state().phase === 'ready'}>
              <button
                type="button"
                class={styles.noteHuntNext}
                disabled={playingGuide()}
                onClick={playPhrase}
              >
                <strong>
                  {playingGuide() ? 'Playing…' : 'Hear the phrase'}
                </strong>
                <small>Short, clean, and without a count-in</small>
              </button>
            </Match>
            <Match when={state().phase === 'repair'}>
              <button
                type="button"
                class={styles.noteHuntNext}
                disabled={playingGuide()}
                onClick={repairNote}
              >
                <strong>
                  {playingGuide() ? 'Playing…' : 'Hear this note'}
                </strong>
                <small>Repair one step, then continue</small>
              </button>
            </Match>
            <Match when={state().phase === 'complete'}>
              <button
                type="button"
                class={styles.noteHuntNext}
                onClick={nextPhrase}
              >
                <strong>Another phrase</strong>
                <small>Same key and length</small>
              </button>
            </Match>
            <Match when={state().phase === 'answering'}>
              <button
                type="button"
                class={styles.learnQuietAction}
                disabled={playingGuide()}
                onClick={playPhrase}
              >
                Replay phrase
              </button>
              <GuitarNightLearnListeningControls
                controller={listening}
                hint="Optional · pitch order only"
                disabled={playingGuide()}
              />
            </Match>
          </Switch>
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
