import type { Component } from 'solid-js'
import { createEffect, createSignal, onCleanup, onMount, untrack, } from 'solid-js'
import { IconLock } from '@/components/exercise-icons'
import { ExercisePitchTracker } from '@/components/ExercisePitchTracker'
import { NotePillSelector } from '@/components/NotePillSelector'
import { updateDifficultyFromEma } from '@/features/practice-intelligence/difficulty-store'
import type { AudioEngine } from '@/lib/audio-engine'
import { noteToMidi } from '@/lib/frequency-to-note'
import type { PracticeEngine } from '@/lib/practice-engine'
import { getDefaultNote, getNoteOptions } from '@/lib/vocal-range'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import { vocalRangePreset } from '@/stores/settings-store'
import { ExerciseShell } from '../ExerciseShell'
import { EXERCISE_PITCH_HOLD } from '../types'
import { useBaseExercise } from '../use-base-exercise'
import { usePitchHoldController } from './use-pitch-hold-controller'

interface PitchHoldExerciseProps {
  audioEngine: AudioEngine
  practiceEngine: PracticeEngine
  onBack: () => void
  autoStart?: boolean
}

const PitchHoldExercise: Component<PitchHoldExerciseProps> = (props) => {
  const [targetNote, setTargetNote] = createSignal(
    getDefaultNote(vocalRangePreset()),
  )
  const audioEngine = untrack(() => props.audioEngine)

  const practiceEngine = untrack(() => props.practiceEngine)
  const base = useBaseExercise({
    audioEngine,
    practiceEngine,
    config: { type: 'pitch-hold', targetNote: untrack(() => targetNote()) },
  })

  const controller = usePitchHoldController(base)

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
    if (r && r.type === 'pitch-hold') {
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
      error={() => base.error()}
      onBack={() => props.onBack?.()}
      idlePlaceholder={
        <div class="exercise-idle-placeholder">
          <IconLock size={48} />
          <p>
            Keep your pitch locked inside the target zone as it shrinks over
            time.
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
          <ExercisePitchTracker
            pitchHistory={base.pitchHistory}
            isActive={isActive}
            targetNoteMidi={() => noteToMidi(targetNote())}
          />
          <div class="pitch-hold-header">
            <span class="target">{targetNote()}</span>
            <span class="zone-label">Zone: ±{Math.round(zoneRadius())}¢</span>
            <span class="timer">{elapsed().toFixed(1)}s</span>
          </div>

          <div class="pitch-hold-viz">
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
        </>
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
