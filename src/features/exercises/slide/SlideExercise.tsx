import type { Component } from 'solid-js'
import { createEffect, createSignal, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { IconSlide } from '@/components/exercise-icons'
import { ExercisePitchTracker } from '@/components/ExercisePitchTracker'
import { NotePillSelector } from '@/components/NotePillSelector'
import { updateDifficultyFromEma } from '@/features/practice-intelligence/difficulty-store'
import type { AudioEngine } from '@/lib/audio-engine'
import { midiToNoteName, noteToMidi } from '@/lib/frequency-to-note'
import type { PracticeEngine } from '@/lib/practice-engine'
import { getDefaultNote, getNoteOptions } from '@/lib/vocal-range'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import { vocalRangePreset } from '@/stores/settings-store'
import { freqToExactMidi } from '../exercise-scoring-utils'
import { ExerciseShell } from '../ExerciseShell'
import { EXERCISE_SLIDE } from '../types'
import { useBaseExercise } from '../use-base-exercise'
import { useSlideController } from './use-slide-controller'

interface SlideExerciseProps {
  audioEngine: AudioEngine
  practiceEngine: PracticeEngine
  onBack: () => void
  autoStart?: boolean
}

const CLASSIFICATION_LABELS: Record<number, string> = {
  '-1': 'No slide detected',
  0: 'Wobble',
  1: 'Scoop',
  2: 'Overshoot',
  3: 'Clean',
}

const SlideExercise: Component<SlideExerciseProps> = (props) => {
  // Default to two distinct, in-range notes a few semitones apart for the
  // user's voice type (getNoteOptions is chromatic, so index == semitones).
  const slideDefaults = untrack(() => {
    const preset = vocalRangePreset()
    const opts = getNoteOptions(preset)
    const from = getDefaultNote(preset)
    const fromIdx = Math.max(0, opts.indexOf(from))
    let toIdx = fromIdx + 3
    if (toIdx > opts.length - 1) toIdx = fromIdx - 3
    toIdx = Math.max(0, Math.min(opts.length - 1, toIdx))
    return { from: opts[fromIdx] ?? from, to: opts[toIdx] ?? from }
  })
  const [fromNote, setFromNoteRaw] = createSignal(slideDefaults.from)
  const [toNote, setToNote] = createSignal(slideDefaults.to)

  // 'from' and 'to' must differ: moving 'from' onto the current 'to' bumps
  // 'to' to an adjacent in-range note instead.
  const setFromNote = (note: string): void => {
    setFromNoteRaw(note)
    if (note === untrack(toNote)) {
      const opts = getNoteOptions(untrack(vocalRangePreset))
      const i = opts.indexOf(note)
      setToNote(opts[i + 1] ?? opts[i - 1] ?? note)
    }
  }
  const audioEngine = untrack(() => props.audioEngine)

  const practiceEngine = untrack(() => props.practiceEngine)
  const base = useBaseExercise({
    audioEngine,
    practiceEngine,
    config: {
      type: 'slide',
      targetNotes: [untrack(() => fromNote()), untrack(() => toNote())],
    },
  })

  const controller = useSlideController(base)

  const handleStart = async () => {
    // Guard: a slide needs two different notes.
    if (fromNote() === toNote()) return
    controller.setTargets(noteToMidi(fromNote()), noteToMidi(toNote()))
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
    if (r && r.type === 'slide') {
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

  // A looping guide that glides from the start note to the end note and back
  // so the singer can follow a vertically-moving dot on the pitch tracker.
  const SLIDE_GUIDE_PERIOD_MS = 3000
  const movingTarget = (): number | null => {
    if (!isActive()) return null
    const from = noteToMidi(fromNote())
    const to = noteToMidi(toNote())
    const phase =
      (base.state().elapsedMs % SLIDE_GUIDE_PERIOD_MS) / SLIDE_GUIDE_PERIOD_MS
    // Triangle wave 0 → 1 → 0 over the period.
    const tri = phase < 0.5 ? phase * 2 : (1 - phase) * 2
    const midi = from + (to - from) * tri
    return 440 * 2 ** ((midi - 69) / 12)
  }

  const currentMidi = () => {
    const p = base.currentPitch()
    if (!p || p.freq <= 0) return 0
    return freqToExactMidi(p.freq)
  }

  const fromMidi = () => noteToMidi(fromNote())
  const toMidi = () => noteToMidi(toNote())

  // Vertical position (% from the top) for a midi value on the slide ladder:
  // the lower note sits near the bottom, the higher note near the top, so the
  // user's pitch dot travels up/down as they glide.
  const topPctFor = (midi: number): number => {
    const lo = Math.min(fromMidi(), toMidi())
    const hi = Math.max(fromMidi(), toMidi())
    const span = hi - lo || 1
    const fromBottom = ((midi - lo) / span) * 80 + 10 // 10..90 from bottom
    return 100 - Math.max(2, Math.min(98, fromBottom))
  }

  return (
    <ExerciseShell
      type={EXERCISE_SLIDE}
      title="Slide Practice"
      status={() => base.state().status}
      currentScore={() => base.state().currentScore}
      resultScore={() => base.result()?.score ?? null}
      error={() => base.error()}
      onBack={() => props.onBack?.()}
      idlePlaceholder={
        <div class="exercise-idle-placeholder">
          <IconSlide size={48} />
          <p>
            Slide cleanly from one note to another. No scooping, no overshoot.
          </p>
        </div>
      }
      idleSettings={
        <>
          <NotePillSelector
            label="From"
            notes={getNoteOptions(vocalRangePreset())}
            selected={fromNote()}
            onChange={setFromNote}
          />
          <NotePillSelector
            label="To"
            notes={getNoteOptions(vocalRangePreset())}
            selected={toNote()}
            onChange={setToNote}
            disabledNotes={[fromNote()]}
          />
        </>
      }
      onStart={() => void handleStart()}
      stopLabel="Stop & Score"
      onStop={handleStop}
      activeContent={
        <>
          <ExercisePitchTracker
            pitchHistory={base.pitchHistory}
            isActive={isActive}
            movingTarget={movingTarget}
          />
          <div class="slide-note-display">
            <span>{fromNote()}</span>
            <span style="color:var(--text-secondary)">→</span>
            <span>{toNote()}</span>
          </div>
          <div class="slide-viz">
            <div
              class="slide-target slide-target-start"
              style={`top:${topPctFor(fromMidi())}%`}
            >
              <span class="slide-target-label">{fromNote()}</span>
            </div>
            <div
              class="slide-target slide-target-end"
              style={`top:${topPctFor(toMidi())}%`}
            >
              <span class="slide-target-label">{toNote()}</span>
            </div>
            <Show when={currentMidi() > 0}>
              <div
                class="slide-pitch-dot"
                style={`top:${topPctFor(currentMidi())}%`}
              >
                <span class="slide-pitch-label">
                  {midiToNoteName(Math.round(currentMidi()))}
                </span>
              </div>
            </Show>
          </div>
          <div class="slide-metrics">
            <div class="slide-metric">
              <span class="slide-metric-label">Smoothness</span>
              <span class="slide-metric-value">
                {base.state().metrics.smoothness != null
                  ? `${base.state().metrics.smoothness}%`
                  : '—'}
              </span>
            </div>
            <div class="slide-metric">
              <span class="slide-metric-label">Accuracy</span>
              <span class="slide-metric-value">
                {base.state().metrics.arrivalAccuracy != null
                  ? `${base.state().metrics.arrivalAccuracy}%`
                  : '—'}
              </span>
            </div>
            <div class="slide-metric">
              <span class="slide-metric-label">Time</span>
              <span class="slide-metric-value">
                {base.state().metrics.slideTimeMs != null
                  ? `${base.state().metrics.slideTimeMs}ms`
                  : '—'}
              </span>
            </div>
            <div class="slide-metric">
              <span class="slide-metric-label">Rating</span>
              <span class="slide-metric-value" style="font-size:0.78rem">
                {base.state().metrics.classification != null
                  ? CLASSIFICATION_LABELS[
                      base.state().metrics.classification
                    ] || '...'
                  : '—'}
              </span>
            </div>
          </div>
        </>
      }
      resultSummary={
        <>
          Smoothness: {base.result()?.metrics.smoothness}% · Accuracy:{' '}
          {base.result()?.metrics.arrivalAccuracy}%
        </>
      }
      onTryAgain={() => {
        base.reset()
        void handleStart()
      }}
      onChangeTarget={() => base.reset()}
      changeTargetLabel="Change Notes"
    />
  )
}

export default SlideExercise
