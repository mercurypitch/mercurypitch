import type { Component } from 'solid-js'
import { createEffect, createSignal, For, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { IconExpand, IconMic, IconMusic } from '@/components/exercise-icons'
import { ExercisePitchTracker } from '@/components/ExercisePitchTracker'
import { NoteDial } from '@/components/NoteDial'
import { updateDifficultyFromEma } from '@/features/practice-intelligence/difficulty-store'
import { launchTargetNote } from '@/features/practice-intelligence/launch-override'
import type { AudioEngine } from '@/lib/audio-engine'
import { midiToNoteName, noteToMidi } from '@/lib/frequency-to-note'
import type { PracticeEngine } from '@/lib/practice-engine'
import { getDefaultNote, getNoteOptions } from '@/lib/vocal-range'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import { vocalRangePreset } from '@/stores/settings-store'
import { ExerciseShell } from '../ExerciseShell'
import { EXERCISE_DYNAMIC_SWELL } from '../types'
import { useBaseExercise } from '../use-base-exercise'
import { dynamicRangeDb, levelFraction, rangeVerdict, rmsToDb, targetFraction, } from './swell-dynamics'
import { useDynamicSwellController } from './use-dynamic-swell-controller'

interface DynamicSwellExerciseProps {
  audioEngine: AudioEngine
  practiceEngine: PracticeEngine
  onBack: () => void
  autoStart?: boolean
}

const DynamicSwellExercise: Component<DynamicSwellExerciseProps> = (props) => {
  const [startNote, setStartNote] = createSignal(
    untrack(() => {
      // A challenge drill can request a starting note for this exercise.
      const requested = launchTargetNote('dynamic-swell')
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
    config: { type: 'dynamic-swell', targetNote: untrack(() => startNote()) },
  })

  /* eslint-disable solid/reactivity */
  const controller = useDynamicSwellController(base, props.audioEngine)
  /* eslint-enable solid/reactivity */

  const handleStart = async () => {
    controller.setBase(noteToMidi(startNote()))
    if (!(await base.start())) return
    controller.startRounds()
  }

  const handleStop = () => {
    controller.stopRounds()
  }

  onCleanup(() => base.reset())

  onMount(() => {
    if (props.autoStart === true && base.state().status === 'idle') {
      void handleStart()
    }
  })

  createEffect(() => {
    const r = base.result()
    if (r && r.type === 'dynamic-swell') {
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
  const phase = () => base.state().metrics.phase ?? 0
  const currentMidi = () => base.state().metrics.currentMidi ?? 0
  const roundsCompleted = () => base.state().metrics.roundsCompleted ?? 0
  const totalRounds = () => base.state().metrics.totalRounds ?? 4
  const lastRoundScore = () => base.state().metrics.lastRoundScore ?? 0

  /** Hue for a completed round's dot, from THAT round's own score. */
  const roundHue = (index: number): number => {
    const own = base.state().metrics[`round${index + 1}Score`]
    // Rounds recorded before per-round scores existed fall back to the
    // average rather than to red, which would misreport them.
    const score = own ?? lastRoundScore()
    return Math.max(0, score * 1.2)
  }

  // ── Live dynamics ────────────────────────────────────────────
  const recentFrames = () => base.pitchHistory()

  const liveLevel = () => {
    const h = recentFrames()
    const last = h[h.length - 1]
    return last === undefined ? 0 : levelFraction(rmsToDb(last.rms ?? 0))
  }

  /** The arch the swell is asking for, positioned through the hold. */
  const targetLevel = () => {
    const holdMs = base.state().metrics.holdMs ?? 0
    if (holdMs <= 0) return 0
    // The hold length is difficulty-scaled, so both ends come from the
    // controller rather than a constant the view guesses at.
    const startMs = base.state().metrics.holdStartMs ?? 0
    const through = (base.state().elapsedMs - startMs) / holdMs
    return targetFraction(phase(), through)
  }

  const rangeDb = () => dynamicRangeDb(recentFrames())

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
      type={EXERCISE_DYNAMIC_SWELL}
      title="Dynamic Swell"
      status={() => base.state().status}
      currentScore={() => base.state().currentScore}
      resultScore={() => base.result()?.score ?? null}
      error={() => base.error()}
      onBack={() => props.onBack?.()}
      idlePlaceholder={
        <div class="exercise-idle-placeholder">
          <IconExpand size={48} />
          <p>
            Hold a note and swell your volume from soft to loud and back. Master
            pitch stability under dynamic change.
          </p>
          <span class="idle-hint">
            4 rounds · 8-second holds · Varying pitches
          </span>
        </div>
      }
      idleSettings={
        <NoteDial
          label="Starting Note"
          notes={getNoteOptions(vocalRangePreset())}
          selected={startNote()}
          onChange={setStartNote}
        />
      }
      onStart={() => void handleStart()}
      stopLabel="Stop"
      onStop={handleStop}
      activeContent={
        <>
          <ExercisePitchTracker
            pitchHistory={base.pitchHistory}
            isActive={isActive}
            targetNoteMidi={() => base.state().metrics.currentMidi || undefined}
          />
          <div class="mirror-melody-phase">
            <span classList={{ listen: phase() === 1, sing: phase() === 2 }}>
              {phase() === 1 ? (
                <>
                  <IconMusic size={16} /> Listen to{' '}
                  {midiToNoteName(currentMidi())}...
                </>
              ) : (
                <>
                  <IconMic size={16} /> Hold {midiToNoteName(currentMidi())} —
                  swell!
                </>
              )}
            </span>
          </div>

          <div class="mirror-melody-progress">
            <For each={Array.from({ length: totalRounds() })}>
              {(_, i) => (
                <div
                  class="mirror-melody-dot-progress"
                  classList={{
                    active: i() === roundsCompleted(),
                    done: i() < roundsCompleted(),
                  }}
                  style={
                    i() < roundsCompleted()
                      ? {
                          // That round's OWN score. This used to read
                          // lastRoundScore() for every dot, so one weak
                          // final round turned rounds that went well red
                          // after the fact.
                          background: `hsl(${roundHue(i())}, 70%, 50%)`,
                          'border-color': `hsl(${roundHue(i())}, 70%, 50%)`,
                        }
                      : undefined
                  }
                />
              )}
            </For>
          </div>

          <div class="mirror-melody-viz">
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

          {/* The loudness the score is already measuring. 35% of a swell
              result is dynamic range in dB, and none of it was on screen
              — the only moving thing was a pitch dot, which is about
              something else. */}
          <div class="swell-dynamics">
            <div class="swell-meter" aria-hidden="true">
              <div
                class="swell-meter-fill"
                style={{ width: `${(liveLevel() * 100).toFixed(1)}%` }}
              />
              <Show when={phase() === 2}>
                <div
                  class="swell-meter-target"
                  style={{ left: `${(targetLevel() * 100).toFixed(1)}%` }}
                />
              </Show>
            </div>
            <div class="swell-dynamics-read">
              <span class="swell-range">{rangeDb().toFixed(1)} dB range</span>
              <span class="swell-verdict">{rangeVerdict(rangeDb())}</span>
            </div>
          </div>

          {roundsCompleted() > 0 && lastRoundScore() > 0 && (
            <div class="mirror-melody-note-feedback">
              Last hold: <span>{lastRoundScore()}%</span>
            </div>
          )}
        </>
      }
      resultSummary={
        <>
          Avg Accuracy: {base.result()?.metrics.avgAccuracy}% · Best Round:{' '}
          {base.result()?.metrics.bestRound}% · Rounds:{' '}
          {base.result()?.metrics.roundsCompleted}
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

export default DynamicSwellExercise
