// ============================================================
// SightSingingExercise — Read notes from a staff, sing them
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createMemo, For, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { IconMusic } from '@/components/exercise-icons'
import { ExercisePitchTracker } from '@/components/ExercisePitchTracker'
import type { AudioEngine } from '@/lib/audio-engine'
import { midiToNoteName } from '@/lib/frequency-to-note'
import type { PracticeEngine } from '@/lib/practice-engine'
import { getComfortableMidiRange } from '@/lib/vocal-range'
import { keyName, scaleType } from '@/stores/app-store'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import { currentScale } from '@/stores/melody-store'
import { vocalRangePreset } from '@/stores/settings-store'
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

// ── Staff geometry (treble clef) ─────────────────────────────
// The 5 lines are, bottom→top, E4 G4 B4 D5 F5; the spaces are F4 A4 C5 E5.
// Notes are placed by diatonic step (letter), not by semitone, so sharps sit
// on their natural's line/space with a ♯ to the left — like real notation.

const STAFF_TOP = 56
const LINE_SPACING = 14
const HALF = LINE_SPACING / 2
const STAFF_LINES = [0, 1, 2, 3, 4]
const NOTE_RX = 8
const NOTE_RY = 6
const NOTE_SPACING = 60
const STAFF_LEFT = 70
const E4_STEP = 30 // diatonic step number of E4 (the bottom line)
const STAFF_BOTTOM_Y = STAFF_TOP + 4 * LINE_SPACING

// pitch-class → diatonic step within an octave (C=0,D=1,…,B=6); sharps share.
const PC_DIATONIC = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]
const PC_SHARP = [
  false,
  true,
  false,
  true,
  false,
  false,
  true,
  false,
  true,
  false,
  true,
  false,
]

const staffStepOf = (midi: number): number => {
  const pc = ((midi % 12) + 12) % 12
  const octave = Math.floor(midi / 12) - 1
  return octave * 7 + PC_DIATONIC[pc]!
}
const stepToY = (step: number): number =>
  STAFF_BOTTOM_Y - (step - E4_STEP) * HALF

/** Line positions (even steps) needed to connect a note outside the staff. */
const ledgerStepsFor = (step: number): number[] => {
  const out: number[] = []
  if (step < E4_STEP) for (let e = E4_STEP - 2; e >= step; e -= 2) out.push(e)
  else if (step > E4_STEP + 8)
    for (let e = E4_STEP + 10; e <= step; e += 2) out.push(e)
  return out
}

function StaffNote(p: {
  note: SightSingingNote
  isActive: boolean
  x: number
}) {
  /* eslint-disable solid/reactivity */
  const step = staffStepOf(p.note.midi)
  const y = stepToY(step)
  const ledgers = ledgerStepsFor(step)
  const isSharp = PC_SHARP[((p.note.midi % 12) + 12) % 12]
  /* eslint-enable solid/reactivity */

  return (
    <>
      <For each={ledgers}>
        {(e) => (
          <line
            x1={p.x - 13}
            y1={stepToY(e)}
            x2={p.x + 13}
            y2={stepToY(e)}
            stroke="var(--text-secondary)"
            stroke-width="1"
            opacity="0.5"
          />
        )}
      </For>
      <Show when={isSharp}>
        <text
          x={p.x - 16}
          y={y + 4}
          text-anchor="middle"
          font-size="15"
          fill={p.isActive ? 'var(--accent)' : 'var(--text-primary)'}
        >
          ♯
        </text>
      </Show>
      <ellipse
        cx={p.x}
        cy={y}
        rx={NOTE_RX}
        ry={NOTE_RY}
        fill={
          p.isActive ? 'var(--accent, #6366f1)' : 'var(--text-primary, #fff)'
        }
        opacity={p.isActive ? 1 : 0.7}
        transform={`rotate(-12, ${p.x}, ${y})`}
      />
      <text
        x={p.x}
        y={STAFF_BOTTOM_Y + 34}
        text-anchor="middle"
        font-size="10"
        fill={p.isActive ? 'var(--accent)' : 'var(--text-secondary)'}
        opacity={p.isActive ? 0.95 : 0.55}
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
    const range = getComfortableMidiRange(vocalRangePreset())
    controller.setScale(scale, range.min, range.max)
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
  const metrics = () => base.state().metrics
  const currentIdx = () => metrics().noteIndex ?? 0
  const holdPct = () => metrics().holdPct ?? 0
  const detectedMidi = () => metrics().detectedMidi ?? 0
  const centsOff = () => metrics().centsOff ?? 0
  const sequence = () => controller.getSequence()

  const targetMidi = createMemo(() => {
    const seq = sequence()
    const idx = currentIdx()
    if (seq.length === 0 || idx < 0 || idx >= seq.length) return undefined
    return seq[idx]!.midi
  })

  const svgWidth = () =>
    Math.max(320, (sequence().length || 6) * NOTE_SPACING + 60)
  const svgHeight = 180

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
          <p>
            Read each note on the staff and sing it — the cursor advances once
            you hold the right pitch. No audio preview.
          </p>
          <p class="exercise-idle-target-note">
            Key:{' '}
            <strong>
              {keyName()} {scaleType()}
            </strong>{' '}
            · in your range
          </p>
        </div>
      }
      onStart={() => void handleStart()}
      stopLabel="Stop & Score"
      onStop={handleStop}
      activeContent={
        <>
          <div class="sight-singing-staff-container">
            <svg
              width={svgWidth()}
              height={svgHeight}
              viewBox={`0 0 ${svgWidth()} ${svgHeight}`}
              class="sight-singing-staff"
            >
              <For each={STAFF_LINES}>
                {(line) => (
                  <line
                    x1={10}
                    y1={STAFF_TOP + line * LINE_SPACING}
                    x2={svgWidth() - 10}
                    y2={STAFF_TOP + line * LINE_SPACING}
                    stroke="var(--text-secondary, #888)"
                    stroke-width="1"
                    opacity="0.35"
                  />
                )}
              </For>
              {/* Treble clef */}
              <text
                x={18}
                y={STAFF_BOTTOM_Y + 6}
                font-size="62"
                fill="var(--text-secondary, #888)"
                opacity="0.55"
                font-family="serif"
              >
                𝄞
              </text>
              <For each={sequence()}>
                {(note, i) => (
                  <StaffNote
                    note={note}
                    isActive={i() === currentIdx()}
                    x={STAFF_LEFT + i() * NOTE_SPACING}
                  />
                )}
              </For>
            </svg>
          </div>

          {/* Hold-to-pass progress for the current note */}
          <div class="sight-singing-hold">
            <div class="sight-singing-hold-bar">
              <div
                class="sight-singing-hold-fill"
                style={{ width: `${holdPct()}%` }}
              />
            </div>
            <span class="sight-singing-hold-label">
              Hold {midiToNoteName(targetMidi() ?? 0)} to continue
            </span>
          </div>

          <ExercisePitchTracker
            pitchHistory={base.pitchHistory}
            isActive={isActive}
            targetNoteMidi={targetMidi}
          />

          {/* DEV-only pitch debug readout for testing recognition. */}
          <Show when={import.meta.env.DEV}>
            <div class="sight-singing-debug">
              detected:{' '}
              {detectedMidi() > 0
                ? `${midiToNoteName(Math.round(detectedMidi()))} (${centsOff() >= 0 ? '+' : ''}${centsOff()}¢)`
                : '—'}{' '}
              · target: {midiToNoteName(targetMidi() ?? 0)} · hold {holdPct()}%
            </div>
          </Show>

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
          {base.result()?.metrics.notesAttempted} notes hit · Best:{' '}
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
