import type { Component } from 'solid-js'
import { createEffect, createSignal, onCleanup, onMount, untrack, } from 'solid-js'
import { IconLock } from '@/components/exercise-icons'
import { NoteDial } from '@/components/NoteDial'
import { updateDifficultyFromEma } from '@/features/practice-intelligence/difficulty-store'
import { launchGuidedPractice, launchTargetNote, } from '@/features/practice-intelligence/launch-override'
import type { AudioEngine } from '@/lib/audio-engine'
import { midiToNoteName, noteToMidi } from '@/lib/frequency-to-note'
import { PITCH_CENTRE_PILOT_THRESHOLDS_V1 } from '@/lib/guided-voice'
import type { PracticeEngine } from '@/lib/practice-engine'
import { getDefaultNote, getNoteOptions } from '@/lib/vocal-range'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import { vocalRangePreset } from '@/stores/settings-store'
import { ExerciseShell } from '../ExerciseShell'
import type { GuidedPracticeLaunchConfig } from '../types'
import { EXERCISE_PITCH_HOLD } from '../types'
import { useBaseExercise } from '../use-base-exercise'
import { usePitchHoldController } from './use-pitch-hold-controller'

interface PitchHoldExerciseProps {
  audioEngine: AudioEngine
  practiceEngine: PracticeEngine
  onBack: () => void
  autoStart?: boolean
}

export function isSupportedGuidedPitchHoldLaunch(
  launch: GuidedPracticeLaunchConfig | undefined,
): launch is GuidedPracticeLaunchConfig {
  return (
    launch?.exercise.exerciseId === EXERCISE_PITCH_HOLD &&
    launch.exercise.exerciseVersion === '1.0.0' &&
    launch.exercise.configuration.configurationId ===
      'pitch-hold.guided-pitch-centre' &&
    launch.exercise.configuration.configurationVersion === '1.0.0' &&
    launch.dose.durationMilliseconds === 5_000 &&
    launch.dose.repetitions === 3 &&
    launch.dose.sets === 1 &&
    launch.dose.comfortableRangeMidiCents === null &&
    launch.dose.demand === 'same' &&
    launch.stopRuleId === 'guided.stop-on-discomfort-v1' &&
    launch.assessmentRunId.trim().length > 0 &&
    Number.isSafeInteger(launch.targetMidiCents) &&
    launch.targetMidiCents % 100 === 0 &&
    launch.toleranceCents ===
      PITCH_CENTRE_PILOT_THRESHOLDS_V1.measurement.settleToleranceCents
  )
}

export function shouldRecordOrdinaryPitchHoldProgress(
  launch: GuidedPracticeLaunchConfig | undefined,
): boolean {
  return launch === undefined
}

const PitchHoldExercise: Component<PitchHoldExerciseProps> = (props) => {
  const noteOptions = getNoteOptions(vocalRangePreset())
  const requestedGuidedPractice = launchGuidedPractice(EXERCISE_PITCH_HOLD)
  const guidedPractice = isSupportedGuidedPitchHoldLaunch(
    requestedGuidedPractice,
  )
    ? requestedGuidedPractice
    : undefined
  const requestedTarget = launchTargetNote(EXERCISE_PITCH_HOLD)
  const guidedTarget =
    guidedPractice === undefined
      ? undefined
      : midiToNoteName(guidedPractice.targetMidiCents / 100)
  const [targetNote, setTargetNote] = createSignal(
    guidedTarget ??
      (requestedTarget !== undefined && noteOptions.includes(requestedTarget)
        ? requestedTarget
        : getDefaultNote(vocalRangePreset())),
  )
  const audioEngine = untrack(() => props.audioEngine)

  const practiceEngine = untrack(() => props.practiceEngine)
  const base = useBaseExercise({
    audioEngine,
    practiceEngine,
    config: () => ({ type: 'pitch-hold', targetNote: targetNote() }),
  })

  const controller = usePitchHoldController(base, {
    fixedZoneCents: guidedPractice?.toleranceCents,
    fixedTargetDurationSeconds:
      guidedPractice?.dose.durationMilliseconds === null ||
      guidedPractice?.dose.durationMilliseconds === undefined
        ? undefined
        : guidedPractice.dose.durationMilliseconds / 1000,
  })

  const handleStart = async () => {
    controller.setTarget(noteToMidi(untrack(() => targetNote())))
    if (!(await base.start())) return
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

  createEffect(() => {
    const r = base.result()
    if (
      r &&
      r.type === 'pitch-hold' &&
      shouldRecordOrdinaryPitchHoldProgress(guidedPractice)
    ) {
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

  const elapsed = () => base.state().elapsedMs / 1000

  // Derived from signals for reactivity
  const pitch = () => base.currentPitch()
  const currentCents = () => {
    const p = pitch()
    if (!p || p.freq <= 0) return 0
    const midi = 12 * Math.log2(p.freq / 440) + 69
    const targetMidi = noteToMidi(targetNote())
    return (midi - targetMidi) * 100
  }
  const zoneRadius = () => base.state().metrics.zoneRadius ?? 50
  const posY = () => 50 - (currentCents() / 100) * 50
  const zoneTop = () => 50 - (zoneRadius() / 100) * 50
  const zoneBottom = () => 50 + (zoneRadius() / 100) * 50
  const inZone = () => Math.abs(currentCents()) <= zoneRadius()

  return (
    <ExerciseShell
      type={EXERCISE_PITCH_HOLD}
      title="Pitch Hold"
      status={() => base.state().status}
      currentScore={() => base.state().currentScore}
      resultScore={() => base.result()?.score ?? null}
      voiceCapture={base.voiceCapture}
      error={() => base.error()}
      onBack={() => props.onBack?.()}
      icon={<IconLock size={20} />}
      guidedPractice={guidedPractice}
      guidedCompletionReady={controller.hasSufficientVoicedEvidence}
      idlePlaceholder={
        <div class="exercise-idle-placeholder">
          <p>
            {guidedPractice === undefined
              ? 'Keep your pitch locked inside the target zone as it shrinks over time.'
              : `Meet ${targetNote()} gently, then keep it centred for each short hold.`}
          </p>
        </div>
      }
      idleSettings={
        guidedPractice === undefined ? (
          <NoteDial
            label="Target"
            notes={noteOptions}
            selected={targetNote()}
            onChange={setTargetNote}
          />
        ) : undefined
      }
      startLabel={guidedPractice === undefined ? undefined : 'Begin first hold'}
      onStart={() => void handleStart()}
      stopLabel={guidedPractice === undefined ? 'Stop & Score' : 'Stop now'}
      onStop={handleStop}
      autoTimer={{ onElapse: handleStop }}
      tracker={{
        pitchHistory: base.pitchHistory,
        targetNoteMidi: () => noteToMidi(targetNote()),
      }}
      activeContent={
        <>
          <div class="pitch-hold-header">
            <span class="target">{targetNote()}</span>
            <span class="zone-label">Zone: ±{Math.round(zoneRadius())}¢</span>
            <span class="timer">{elapsed().toFixed(1)}s</span>
          </div>

          <div class="pitch-hold-viz exercise-tall-viz">
            <div
              class="pitch-hold-zone"
              style={`top:${zoneTop()}%;height:${zoneBottom() - zoneTop()}%`}
            />
            <div class="pitch-hold-center-line" />
            <div
              class="pitch-hold-dot"
              classList={{
                'pitch-hold-dot-in': inZone(),
                'pitch-hold-dot-out': !inZone() && (pitch()?.freq ?? 0) > 0,
              }}
              style={`top:${Math.max(2, Math.min(98, posY()))}%`}
            />
            <div class="pitch-hold-target-label">{targetNote()}</div>
          </div>
        </>
      }
      activeFooter={
        <div class="pitch-hold-metrics">
          <div class="pitch-hold-metric">
            <span class="pitch-hold-metric-label">In Zone</span>
            <span class="pitch-hold-metric-value">
              {base.state().metrics.zonePct != null
                ? `${base.state().metrics.zonePct}%`
                : '—'}
            </span>
          </div>
          <div class="pitch-hold-metric">
            <span class="pitch-hold-metric-label">Zone Size</span>
            <span class="pitch-hold-metric-value">
              {zoneRadius() != null ? `±${Math.round(zoneRadius())}¢` : '—'}
            </span>
          </div>
        </div>
      }
      resultSummary={
        <>
          In Zone: {base.result()?.metrics.zonePct}% · Survived:{' '}
          {base.result()?.metrics.survivedSec}s
        </>
      }
      onTryAgain={() => {
        base.reset()
        void handleStart()
      }}
      onChangeTarget={() => base.reset()}
      changeTargetLabel="Change Note"
    />
  )
}

export default PitchHoldExercise
