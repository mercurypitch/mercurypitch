import type { Component } from 'solid-js'
import { createEffect, createSignal, onCleanup, onMount, Show, untrack, } from 'solid-js'
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
import { showCelebration } from '@/stores/ui-store'
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

  createEffect(() => {
    const r = base.result()
    if (r && r.type === 'pitch-hold') {
      showCelebration({
        score: r.score,
        exerciseType: r.type,
        metrics: r.metrics,
      })
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
  const isComplete = () => base.state().status === 'complete'
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
    <div class="exercise-runner">
      <div class="exercise-runner-header">
        <button class="back-btn" onClick={() => props.onBack?.()}>
          ← Back
        </button>
        <h2 class="exercise-title">Pitch Hold</h2>
        <span class="exercise-score-display">
          {base.state().status === 'idle'
            ? '—'
            : `${Math.round(base.state().currentScore)}%`}
        </span>
      </div>

      <div class="exercise-canvas-area">
        <Show when={base.state().status === 'idle'}>
          <div class="exercise-idle-placeholder">
            <IconLock size={48} />
            <p>
              Keep your pitch locked inside the target zone as it shrinks over
              time.
            </p>
          </div>
        </Show>

        <Show when={isActive()}>
          <>
            <ExercisePitchTracker
              pitchHistory={base.pitchHistory}
              isActive={isActive}
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
        </Show>

        <Show when={isComplete() && base.result()}>
          <div class="exercise-result-overlay">
            <div
              class="exercise-result-score"
              classList={{
                'exercise-result-score-good': base.result()!.score >= 80,
                'exercise-result-score-ok':
                  base.result()!.score >= 50 && base.result()!.score < 80,
                'exercise-result-score-poor': base.result()!.score < 50,
              }}
            >
              {base.result()!.score}%
            </div>
            <div class="exercise-result-label">
              In Zone: {base.result()!.metrics.zonePct}% · Survived:{' '}
              {base.result()!.metrics.survivedSec}s
            </div>
            <button
              class="exercise-btn exercise-btn-primary"
              onClick={() => {
                base.reset()
                void handleStart()
              }}
            >
              Try Again
            </button>
          </div>
        </Show>
      </div>

      <div class="exercise-controls">
        <Show when={base.state().status === 'idle'}>
          <>
            <NotePillSelector
              label="Target"
              notes={getNoteOptions(vocalRangePreset())}
              selected={targetNote()}
              onChange={setTargetNote}
            />
            <Show when={base.error() != null}>
              <div class="exercise-error">{base.error()}</div>
            </Show>
            <button
              class="exercise-btn exercise-btn-primary"
              onClick={() => void handleStart()}
            >
              Start
            </button>
          </>
        </Show>
        <Show when={isActive()}>
          <button
            class="exercise-btn exercise-btn-secondary"
            onClick={handleStop}
          >
            Stop & Score
          </button>
        </Show>
        <Show when={isComplete()}>
          <>
            <button
              class="exercise-btn exercise-btn-primary"
              onClick={() => {
                base.reset()
                void handleStart()
              }}
            >
              Try Again
            </button>
            <button
              class="exercise-btn exercise-btn-secondary"
              onClick={() => {
                base.reset()
              }}
            >
              Change Note
            </button>
          </>
        </Show>
      </div>
    </div>
  )
}

export default PitchHoldExercise
