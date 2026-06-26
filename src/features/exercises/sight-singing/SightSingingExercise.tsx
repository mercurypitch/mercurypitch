// ============================================================
// SightSingingExercise — Read notes from a staff, sing them
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createMemo, For, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { IconMusic } from '@/components/exercise-icons'
import { ExercisePitchTracker } from '@/components/ExercisePitchTracker'
import type { AudioEngine } from '@/lib/audio-engine'
import type { PracticeEngine } from '@/lib/practice-engine'
import { keyName, scaleType } from '@/stores/app-store'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import { currentScale } from '@/stores/melody-store'
import { showCelebration } from '@/stores/ui-store'
import { ExerciseShell } from '../ExerciseShell'
import { EXERCISE_SIGHT_SINGING } from '../types'
import { useBaseExercise } from '../use-base-exercise'
import type { SightSingingNote } from './use-sight-singing-controller'
import { useSightSingingController } from './use-sight-singing-controller'

interface Props {
  audioEngine: AudioEngine
  practiceEngine: PracticeEngine
  onBack: () => void
  autoStart?: boolean
}

// ── Staff rendering ──────────────────────────────────────────

const STAFF_TOP = 20
const LINE_SPACING = 10
const STAFF_LINES = [0, 1, 2, 3, 4]
const NOTE_RX = 9
const NOTE_RY = 7

/** MIDI → y offset from top staff line (C4 = middle C, one ledger line below) */
function midiToStaffY(midi: number): number {
  // MIDI 60 = C4 = middle C = 1 ledger line below the staff (treble clef)
  // Staff bottom line is E4 (MIDI 64) → y = STAFF_TOP + 4 * LINE_SPACING
  // Each semitone = LINE_SPACING / 2 pixels
  // C4 (60) is 4 semitones below E4 (64), so it's at y + 2 * LINE_SPACING
  const staffBottomY = STAFF_TOP + 4 * LINE_SPACING // E4
  const semitonesFromE4 = midi - 64
  return staffBottomY - (semitonesFromE4 * LINE_SPACING) / 2
}

function StaffNote(p: {
  note: SightSingingNote
  isActive: boolean
  x: number
}) {
  // eslint-disable-next-line solid/reactivity
  const y = midiToStaffY(p.note.midi)
  const needsLedgerLine = y > STAFF_TOP + 4 * LINE_SPACING + 2

  return (
    <>
      {/* Ledger line for middle C */}
      <Show when={needsLedgerLine}>
        <line
          x1={p.x - 12}
          y1={STAFF_TOP + 5 * LINE_SPACING}
          x2={p.x + 12}
          y2={STAFF_TOP + 5 * LINE_SPACING}
          stroke="currentColor"
          stroke-width="1"
          opacity="0.5"
        />
      </Show>
      {/* Note head */}
      <ellipse
        cx={p.x}
        cy={y}
        rx={NOTE_RX}
        ry={NOTE_RY}
        fill={
          p.isActive ? 'var(--accent, #6366f1)' : 'var(--text-primary, #fff)'
        }
        opacity={p.isActive ? 1 : 0.7}
        transform={`rotate(-10, ${p.x}, ${y})`}
      />
      {/* Note name label */}
      <text
        x={p.x}
        y={y + 28}
        text-anchor="middle"
        font-size="10"
        fill="var(--text-secondary)"
        opacity="0.6"
      >
        {p.note.name}
        {p.note.octave}
      </text>
    </>
  )
}

const SightSingingExercise: Component<Props> = (props) => {
  const audioEngine = untrack(() => props.audioEngine)
  const practiceEngine = untrack(() => props.practiceEngine)

  const base = useBaseExercise({
    audioEngine,
    practiceEngine,
    config: { type: 'sight-singing' },
  })

  const controller = useSightSingingController(base)

  const handleStart = async () => {
    const scale = currentScale()
    if (scale.length < 3) return
    controller.setScale(scale)
    await base.start()
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
    if (r && r.type === 'sight-singing') {
      showCelebration({
        score: r.score,
        exerciseType: r.type,
        metrics: r.metrics,
      })
      untrack(() =>
        recordExerciseResult({
          type: r.type,
          score: r.score,
          metrics: r.metrics,
          completedAt: r.completedAt,
        }),
      )
    }
  })

  const isActive = () => base.state().status === 'active'
  const currentIdx = () => controller.getCurrentIndex()
  const sequence = () => controller.getSequence()

  const targetMidi = createMemo(() => {
    const seq = sequence()
    const idx = currentIdx()
    if (seq.length === 0 || idx < 0 || idx >= seq.length) return undefined
    return seq[idx].midi
  })

  const svgWidth = () => Math.max(300, (sequence().length || 5) * 52 + 40)
  const svgHeight = 140

  return (
    <ExerciseShell
      type={EXERCISE_SIGHT_SINGING}
      title="Sight-Singing"
      status={() => base.state().status}
      currentScore={() => base.state().currentScore}
      resultScore={() => base.result()?.score ?? null}
      error={() => base.error()}
      onBack={() => props.onBack?.()}
      idlePlaceholder={
        <div class="exercise-idle-placeholder">
          <IconMusic size={48} />
          <p>Read the notes on the staff and sing them — no audio preview.</p>
          <p class="exercise-idle-target-note">
            Key:{' '}
            <strong>
              {keyName()} {scaleType()}
            </strong>
          </p>
        </div>
      }
      onStart={() => void handleStart()}
      stopLabel="Stop & Score"
      onStop={handleStop}
      activeContent={
        <>
          <div class="sight-singing-staff-container">
            {/* Musical staff */}
            <svg
              width={svgWidth()}
              height={svgHeight}
              viewBox={`0 0 ${svgWidth()} ${svgHeight}`}
              class="sight-singing-staff"
            >
              {/* Staff lines */}
              <For each={STAFF_LINES}>
                {(line) => (
                  <line
                    x1={10}
                    y1={STAFF_TOP + line * LINE_SPACING}
                    x2={svgWidth() - 10}
                    y2={STAFF_TOP + line * LINE_SPACING}
                    stroke="var(--text-secondary, #888)"
                    stroke-width="1"
                    opacity="0.3"
                  />
                )}
              </For>
              {/* Clef placeholder */}
              <text
                x={14}
                y={STAFF_TOP + 2.5 * LINE_SPACING}
                font-size="32"
                fill="var(--text-secondary, #888)"
                opacity="0.25"
                font-family="serif"
              >
                &
              </text>
              {/* Notes */}
              <For each={sequence()}>
                {(note, i) => (
                  <StaffNote
                    note={note}
                    isActive={i() === currentIdx()}
                    x={50 + i() * 52}
                  />
                )}
              </For>
            </svg>
          </div>

          <ExercisePitchTracker
            pitchHistory={base.pitchHistory}
            isActive={isActive}
            targetNoteMidi={targetMidi}
          />

          <div class="sight-singing-progress">
            <div class="sight-singing-progress-bar">
              <div
                class="sight-singing-progress-fill"
                style={{
                  width: `${((currentIdx() + 1) / (sequence().length || 1)) * 100}%`,
                }}
              />
            </div>
            <span class="sight-singing-progress-label">
              Note {currentIdx() + 1} of {sequence().length}
            </span>
          </div>
        </>
      }
      resultSummary={
        <>
          {base.result()?.metrics.notesScored} of{' '}
          {base.result()?.metrics.notesAttempted} notes scored · Best:{' '}
          {base.result()?.metrics.bestNote}%
        </>
      }
      onTryAgain={() => {
        base.reset()
        void handleStart()
      }}
      onChangeTarget={() => base.reset()}
      changeTargetLabel="Change"
    />
  )
}

export default SightSingingExercise
