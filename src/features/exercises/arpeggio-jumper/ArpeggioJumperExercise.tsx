import type { Component } from 'solid-js'
import { createEffect, createSignal, onCleanup, onMount, untrack, } from 'solid-js'
import { For, Show } from 'solid-js'
import { IconLayers, IconMic, IconMusic } from '@/components/exercise-icons'
import { NoteDial } from '@/components/NoteDial'
import { updateDifficultyFromEma } from '@/features/practice-intelligence/difficulty-store'
import { launchTargetNote } from '@/features/practice-intelligence/launch-override'
import type { AudioEngine } from '@/lib/audio-engine'
import { midiToNoteName, noteToMidi } from '@/lib/frequency-to-note'
import type { PracticeEngine } from '@/lib/practice-engine'
import { getDefaultNote, getNoteOptions } from '@/lib/vocal-range'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import { micLatencyMs } from '@/stores/mic-latency-store'
import { vocalRangePreset } from '@/stores/settings-store'
import { ExerciseFeedback } from '../ExerciseFeedback'
import { ExerciseShell } from '../ExerciseShell'
import { EXERCISE_ARPEGGIO_JUMPER } from '../types'
import { useBaseExercise } from '../use-base-exercise'
import type { ArpeggioMode } from './use-arpeggio-jumper-controller'
import { arpeggioRunHeard, arpeggioRunStopped, octaveLine, useArpeggioJumperController, } from './use-arpeggio-jumper-controller'

interface ArpeggioJumperExerciseProps {
  audioEngine: AudioEngine
  practiceEngine: PracticeEngine
  onBack: () => void
  autoStart?: boolean
}

type ArpeggioType = 'major' | 'minor' | 'diminished' | 'augmented'

const ARPEGGIO_TYPES: { value: ArpeggioType; label: string }[] = [
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
  { value: 'diminished', label: 'Diminished' },
  { value: 'augmented', label: 'Augmented' },
]

const ArpeggioJumperExercise: Component<ArpeggioJumperExerciseProps> = (
  props,
) => {
  const [startNote, setStartNote] = createSignal(
    untrack(() => {
      // A challenge drill can request a starting note for this exercise.
      const requested = launchTargetNote('arpeggio-jumper')
      const preset = vocalRangePreset()
      return requested !== undefined &&
        getNoteOptions(preset).includes(requested)
        ? requested
        : getDefaultNote(preset)
    }),
  )
  const [arpeggioType, setArpeggioType] = createSignal<ArpeggioType>('major')
  const [direction, setDirection] = createSignal<'up' | 'down'>('up')
  const [mode, setMode] = createSignal<ArpeggioMode>('steps')
  const audioEngine = untrack(() => props.audioEngine)

  const practiceEngine = untrack(() => props.practiceEngine)
  const base = useBaseExercise({
    audioEngine,
    practiceEngine,
    config: () => ({
      type: 'arpeggio-jumper',
      targetNote: startNote(),
    }),
  })

  /* eslint-disable solid/reactivity */
  const controller = useArpeggioJumperController(base, props.audioEngine, {
    // Frames arrive one measured round trip after they were sung.
    micLatencyMs,
  })
  /* eslint-enable solid/reactivity */

  const handleStart = async () => {
    controller.setArpeggio(
      noteToMidi(startNote()),
      arpeggioType(),
      direction(),
      mode(),
    )
    if (!(await base.start())) return
    controller.startArpeggio()
  }

  const handleStop = () => {
    controller.stopArpeggio()
  }

  onCleanup(() => base.reset())

  onMount(() => {
    if (props.autoStart === true && base.state().status === 'idle') {
      void handleStart()
    }
  })

  // A run in which no note was voiced is no result, not a low one, and nor
  // is a run stopped before its end (REQ-GVC-031): neither is recorded or
  // moves the level, and no grade is shown for it.
  const scoredRun = () => {
    const r = base.result()
    return r !== null &&
      arpeggioRunHeard(r.metrics) &&
      !arpeggioRunStopped(r.metrics)
      ? r
      : null
  }
  const unscoredRun = () =>
    base.state().status === 'complete' &&
    base.result() !== null &&
    scoredRun() === null

  createEffect(() => {
    const r = scoredRun()
    if (r && r.type === 'arpeggio-jumper') {
      untrack(() => {
        recordExerciseResult({
          type: r.type,
          score: r.score,
          metrics: r.metrics,
          completedAt: r.completedAt,
        })
        updateDifficultyFromEma(r.type)
      })
    }
  })

  const phase = () => base.state().metrics.phase ?? 0
  const isEcho = () => (base.state().metrics.echo ?? 0) === 1
  const currentMidi = () => base.state().metrics.currentMidi ?? 0
  const noteIndex = () => base.state().metrics.noteIndex ?? 0
  const arpeggioLength = () => base.state().metrics.arpeggioLength ?? 4
  const lastNoteScore = () => base.state().metrics.lastNoteScore ?? 0
  const resultMetric = (key: string) => base.result()?.metrics[key] ?? 0
  const notesNotSung = () =>
    resultMetric('notesTotal') - resultMetric('notesSung')

  const pitch = () => base.currentPitch()
  const currentCents = () => {
    const p = pitch()
    if (!p || p.freq <= 0 || currentMidi() === 0) return 0
    const midi = 12 * Math.log2(p.freq / 440) + 69
    return (midi - currentMidi()) * 100
  }

  const posY = () => 50 - (currentCents() / 100) * 50

  return (
    <ExerciseShell
      type={EXERCISE_ARPEGGIO_JUMPER}
      title="Arpeggio Jumper"
      status={() => base.state().status}
      currentScore={() => base.state().currentScore}
      resultScore={() => scoredRun()?.score ?? null}
      voiceCapture={base.voiceCapture}
      error={() => base.error()}
      onBack={() => props.onBack?.()}
      icon={<IconLayers size={20} />}
      idlePlaceholder={
        <div class="exercise-idle-placeholder">
          <Show when={unscoredRun()}>
            <p class="arpeggio-not-scored" role="status">
              {arpeggioRunStopped(base.result()?.metrics)
                ? 'You stopped before the end, so this run was not scored.'
                : "We didn't hear any singing, so this run was not scored. Check the microphone, then try again."}
            </p>
          </Show>
          <p>
            {mode() === 'echo'
              ? 'Hear the whole arpeggio, then sing it back from memory — train your inner ear, not just your pitch.'
              : 'Sing chord tones one at a time. Master the leaps between root, third, fifth, and octave.'}
          </p>
          <span class="idle-hint">
            4 notes · {arpeggioType()} · {direction()} ·{' '}
            {mode() === 'echo' ? 'echo the phrase' : 'note by note'}
          </span>
        </div>
      }
      idleSettings={
        <>
          <NoteDial
            label="Root Note"
            notes={getNoteOptions(vocalRangePreset())}
            selected={startNote()}
            onChange={setStartNote}
          />
          <label class="exercise-target-selector">
            <span>Chord</span>
            <select
              value={arpeggioType()}
              onChange={(e) =>
                setArpeggioType(e.currentTarget.value as ArpeggioType)
              }
            >
              <For each={ARPEGGIO_TYPES}>
                {(s) => <option value={s.value}>{s.label}</option>}
              </For>
            </select>
          </label>
          <label class="exercise-target-selector">
            <span>Direction</span>
            <select
              value={direction()}
              onChange={(e) =>
                setDirection(e.currentTarget.value as 'up' | 'down')
              }
            >
              <option value="up">Ascending</option>
              <option value="down">Descending</option>
            </select>
          </label>
          <div
            class="exercise-timer-toggle"
            role="group"
            aria-label="Interaction mode"
          >
            <button
              type="button"
              class="exercise-timer-segment"
              classList={{ active: mode() === 'steps' }}
              onClick={() => setMode('steps')}
              title="One note plays, you sing it back, then the next"
            >
              Note by note
            </button>
            <button
              type="button"
              class="exercise-timer-segment"
              classList={{ active: mode() === 'echo' }}
              onClick={() => setMode('echo')}
              title="The whole arpeggio plays first, then you repeat it from memory"
            >
              Echo the phrase
            </button>
          </div>
        </>
      }
      onStart={() => void handleStart()}
      stopLabel="Stop"
      onStop={handleStop}
      tracker={{
        pitchHistory: base.pitchHistory,
        targetNoteMidi: () => base.state().metrics.currentMidi || undefined,
        upcomingTargets: () => controller.getUpcomingMidi(),
      }}
      activePhase={
        <div class="mirror-melody-phase">
          <span classList={{ listen: phase() === 1, sing: phase() === 2 }}>
            {phase() === 1 ? (
              <>
                <IconMusic size={16} />{' '}
                {isEcho()
                  ? 'Listen to the whole arpeggio...'
                  : 'Listen to the note...'}
              </>
            ) : phase() === 2 ? (
              <>
                <IconMic size={16} />{' '}
                {isEcho() ? 'Now sing it all back!' : 'Sing it back!'}
              </>
            ) : (
              '...'
            )}
          </span>
          {phase() === 2 && (
            <span class="mirror-melody-current-note">
              {midiToNoteName(currentMidi())}
            </span>
          )}
        </div>
      }
      activeContent={
        <>
          <ExerciseFeedback state={base.state} />

          <div class="mirror-melody-progress">
            <For each={Array.from({ length: arpeggioLength() })}>
              {(_, i) => (
                <div
                  class="mirror-melody-dot-progress"
                  classList={{
                    active: i() === noteIndex(),
                    done: i() < noteIndex(),
                  }}
                  style={
                    i() < noteIndex()
                      ? {
                          background: `hsl(${Math.max(0, lastNoteScore() * 1.2)}, 70%, 50%)`,
                          'border-color': `hsl(${Math.max(0, lastNoteScore() * 1.2)}, 70%, 50%)`,
                        }
                      : undefined
                  }
                />
              )}
            </For>
          </div>

          <div class="mirror-melody-viz exercise-tall-viz">
            <div class="mirror-melody-target-line" />
            <div
              class="mirror-melody-dot"
              classList={{
                'mirror-melody-dot-close': Math.abs(currentCents()) <= 25,
                'mirror-melody-dot-far':
                  Math.abs(currentCents()) > 25 && (pitch()?.freq ?? 0) > 0,
              }}
              style={`top:${Math.max(2, Math.min(98, posY()))}%`}
            />
            {phase() === 2 && (
              <div class="mirror-melody-target-label">
                {midiToNoteName(currentMidi())}
              </div>
            )}
          </div>

          {/* Per-note tier word + combo now come from ExerciseFeedback; the
              bare "Last note: N%" line it replaced was the audit's example
              of numeric-but-mute feedback. */}
        </>
      }
      resultSummary={
        <>
          {/* The grade is the note average, so it is not repeated here; the
              best note is praise, outside the grade. */}
          Best note: {resultMetric('bestNote')}% · Landed:{' '}
          {resultMetric('notesHit')} of {resultMetric('notesTotal')}
          <Show when={notesNotSung() > 0}> · Not sung: {notesNotSung()}</Show>
          <Show when={octaveLine(base.result()?.metrics.octaveOffset)}>
            {(line) => <span class="arpeggio-octave-line">{line()}</span>}
          </Show>
        </>
      }
      onTryAgain={() => {
        base.reset()
        void handleStart()
      }}
      onChangeTarget={() => base.reset()}
      changeTargetLabel="Change Settings"
    />
  )
}

export default ArpeggioJumperExercise
