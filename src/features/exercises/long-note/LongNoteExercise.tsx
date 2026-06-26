import type { Component } from 'solid-js'
import { createEffect, createSignal, onCleanup, onMount, untrack, } from 'solid-js'
import { IconTarget } from '@/components/exercise-icons'
import { ExercisePitchTracker } from '@/components/ExercisePitchTracker'
import { NotePillSelector } from '@/components/NotePillSelector'
import { updateDifficultyFromEma } from '@/features/practice-intelligence/difficulty-store'
import { launchTargetNote } from '@/features/practice-intelligence/launch-override'
import type { AudioEngine } from '@/lib/audio-engine'
import { noteToMidi } from '@/lib/frequency-to-note'
import type { PracticeEngine } from '@/lib/practice-engine'
import { getDefaultNote, getNoteOptions } from '@/lib/vocal-range'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import { vocalRangePreset } from '@/stores/settings-store'
import { ExerciseShell } from '../ExerciseShell'
import { EXERCISE_LONG_NOTE } from '../types'
import { useBaseExercise } from '../use-base-exercise'
import { useLongNoteController } from './use-long-note-controller'

interface LongNoteExerciseProps {
  audioEngine: AudioEngine
  practiceEngine: PracticeEngine
  onBack: () => void
  autoStart?: boolean
}

const LongNoteExercise: Component<LongNoteExerciseProps> = (props) => {
  const [targetNote, setTargetNote] = createSignal(
    untrack(() => {
      // A weak-pitch drill can request a specific note to focus on.
      const requested = launchTargetNote(EXERCISE_LONG_NOTE)
      const preset = vocalRangePreset()
      return requested !== undefined &&
        getNoteOptions(preset).includes(requested)
        ? requested
        : getDefaultNote(preset)
    }),
  )

  const audioEngine = untrack(() => props.audioEngine)
  const practiceEngine = untrack(() => props.practiceEngine)

  const base = useBaseExercise({
    audioEngine,
    practiceEngine,
    config: {
      type: 'long-note',
      targetNote: untrack(() => untrack(() => targetNote())),
    },
  })

  const controller = useLongNoteController(base)

  const targetMidi = () => noteToMidi(targetNote())

  const handleStart = async () => {
    controller.setTarget(untrack(() => targetMidi()))
    await base.start()
    controller.startLoop()
  }

  const handleStop = () => {
    controller.stopAndCompute()
  }

  onCleanup(() => base.reset())

  onMount(() => {
    if (props.autoStart === true && base.state().status === 'idle') {
      void handleStart()
    }
  })

  // Trigger celebration modal when result changes
  createEffect(() => {
    const r = base.result()
    if (r && r.type === 'long-note') {
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

  const isActive = () => base.state().status === 'active'
  const elapsed = () => base.state().elapsedMs / 1000

  const fillClass = (value: number, thresholds: [number, number]) =>
    value >= thresholds[0] ? 'good' : value >= thresholds[1] ? 'ok' : 'poor'

  return (
    <ExerciseShell
      type={EXERCISE_LONG_NOTE}
      title="Long Note Practice"
      status={() => base.state().status}
      currentScore={() => base.state().currentScore}
      resultScore={() => base.result()?.score ?? null}
      error={() => base.error()}
      onBack={() => props.onBack?.()}
      idlePlaceholder={
        <div class="exercise-idle-placeholder">
          <IconTarget size={48} />
          <p>Hold a steady pitch. The longer and steadier, the better.</p>
          <p class="exercise-idle-target-note">
            Target: <strong>{targetNote()}</strong>
          </p>
        </div>
      }
      idleSettings={
        <NotePillSelector
          label="Target"
          notes={getNoteOptions(vocalRangePreset())}
          selected={targetNote()}
          onChange={setTargetNote}
        />
      }
      onStart={() => void handleStart()}
      stopLabel="Stop & Score"
      onStop={handleStop}
      autoTimer={{ presets: [5, 15, 30], onElapse: handleStop }}
      activeContent={
        <>
          <div class="long-note-target-display">
            Target: <strong>{targetNote()}</strong>
          </div>
          <ExercisePitchTracker
            pitchHistory={base.pitchHistory}
            isActive={isActive}
            targetNoteMidi={targetMidi}
          />
          <div class="long-note-timer">{elapsed().toFixed(1)}s</div>
          <div class="long-note-metrics">
            <div class="long-note-metric">
              <span class="long-note-metric-label">Stability</span>
              <span class="long-note-metric-value">
                {base.state().metrics.pitchStabilityCents != null
                  ? `${base.state().metrics.pitchStabilityCents}¢`
                  : '—'}
              </span>
              <div class="long-note-metric-bar">
                <div
                  class="long-note-metric-fill good"
                  style={`width:${Math.max(0, 100 - (base.state().metrics.pitchStabilityCents || 0) * 2)}%`}
                />
              </div>
            </div>
            <div class="long-note-metric">
              <span class="long-note-metric-label">Steady Zone</span>
              <span class="long-note-metric-value">
                {base.state().metrics.steadyZonePct != null
                  ? `${base.state().metrics.steadyZonePct}%`
                  : '—'}
              </span>
              <div class="long-note-metric-bar">
                <div
                  class={`long-note-metric-fill ${fillClass(base.state().metrics.steadyZonePct || 0, [80, 50])}`}
                  style={`width:${base.state().metrics.steadyZonePct || 0}%`}
                />
              </div>
            </div>
          </div>
        </>
      }
      resultSummary={
        <>
          Duration: {base.result()?.metrics.durationSec}s · Stability:{' '}
          {base.result()?.metrics.pitchStabilityCents}¢
        </>
      }
      onTryAgain={() => {
        base.reset()
        void handleStart()
      }}
      onChangeTarget={() => base.reset()}
      changeTargetLabel="Change Target"
    />
  )
}

export default LongNoteExercise
