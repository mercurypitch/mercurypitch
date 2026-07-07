// ============================================================
// GuitarRiffTracker — record, review & score guitar riffs.
//
// Free-form mic recording of riffs with note detection, a simple
// timeline display, and scoring against a target melody.
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import type { RiffTrackerState } from '@/features/guitar-practice/RiffTrackerState'
import styles from './GuitarRiffTracker.module.css'

// ── Types ──────────────────────────────────────────────────────

interface GuitarRiffTrackerProps {
  /** Riff tracker state (owned by the page/context). */
  state: RiffTrackerState
}

// ── Constants ──────────────────────────────────────────────────

const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
]

function midiToNoteName(midi: number): string {
  const name = NOTE_NAMES[midi % 12]
  const octave = Math.floor(midi / 12) - 1
  return `${name}${octave}`
}

// ── Component ──────────────────────────────────────────────────

export const GuitarRiffTracker: Component<GuitarRiffTrackerProps> = ({
  state,
}) => {
  const [targetInput, setTargetInput] = createSignal('')

  const formatTime = (ms: number) => {
    const secs = ms / 1000
    return `${secs.toFixed(1)}s`
  }

  const handleTargetSubmit = () => {
    const raw = targetInput().trim()
    if (!raw) return

    // Parse comma-separated MIDI numbers or note names
    const parts = raw.split(/[, ]+/)
    const midis: number[] = []
    for (const part of parts) {
      const num = Number(part)
      if (!isNaN(num) && num >= 0 && num <= 127) {
        midis.push(num)
      } else {
        // Try to parse as note name (e.g. "E4", "G#3")
        const match = part.match(/^([A-G]#?)(\d)$/i)
        if (match) {
          const noteIdx = NOTE_NAMES.indexOf(
            match[1].charAt(0).toUpperCase() + (match[1].length > 1 ? '#' : ''),
          )
          const octave = parseInt(match[2])
          if (noteIdx >= 0) {
            midis.push((octave + 1) * 12 + noteIdx)
          }
        }
      }
    }

    if (midis.length > 0) {
      state.setTargetMelody(midis)
    }
  }

  const scorePercent = () => {
    const targets = state.targetNotes()
    if (targets.length === 0) return 0
    const correct = state.noteResults().filter((r) => r === 'correct').length
    return Math.round((correct / targets.length) * 100)
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <div class={styles.panel} data-testid="guitar-riff-tracker">
      {/* Header */}
      <div class={styles.header}>
        <span class={styles.title}>Riff Tracker</span>
        <span class={styles.phase}>
          {state.phase() === 'idle' && 'Ready'}
          {state.phase() === 'recording' && '● Recording...'}
          {state.phase() === 'reviewing' && 'Review'}
          {state.phase() === 'scoring' && 'Score'}
        </span>
      </div>

      {/* Controls */}
      <div class={styles.controls}>
        <Show when={state.phase() === 'idle'}>
          <button
            class={`${styles.btn} ${styles.btnRecord}`}
            onClick={() => state.startRecording()}
            aria-label="Start recording riff"
          >
            ● Record
          </button>
        </Show>

        <Show when={state.phase() === 'recording'}>
          <button
            class={`${styles.btn} ${styles.btnStop}`}
            onClick={() => state.stopRecording()}
            aria-label="Stop recording"
          >
            ■ Stop
          </button>
          <span class={styles.recordingTimer}>
            {formatTime(state.recordingDuration())}
          </span>
        </Show>

        <Show
          when={state.phase() === 'reviewing' || state.phase() === 'scoring'}
        >
          <button
            class={`${styles.btn} ${styles.btnRecord}`}
            onClick={() => state.startRecording()}
            aria-label="Record new riff"
          >
            ● Re-record
          </button>
          <button
            class={`${styles.btn} ${styles.btnScore}`}
            onClick={() => state.scoreRiff()}
            aria-label="Score riff"
            disabled={state.targetNotes().length === 0}
          >
            Score
          </button>
          <button
            class={`${styles.btn} ${styles.btnReset}`}
            onClick={() => state.reset()}
            aria-label="Clear"
          >
            Clear
          </button>
        </Show>
      </div>

      {/* Target melody input */}
      <Show
        when={
          state.phase() === 'idle' ||
          state.phase() === 'reviewing' ||
          state.phase() === 'scoring'
        }
      >
        <div class={styles.targetSection}>
          <label class={styles.targetLabel}>
            Target melody (notes or MIDI):
          </label>
          <div class={styles.targetRow}>
            <input
              class={styles.targetInput}
              type="text"
              placeholder="e.g. E4, G4, A4 or 64, 67, 69"
              value={targetInput()}
              onInput={(e) => setTargetInput(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTargetSubmit()
              }}
              aria-label="Target melody notes"
            />
            <button
              class={`${styles.btn} ${styles.btnSet}`}
              onClick={handleTargetSubmit}
              aria-label="Set target melody"
            >
              Set
            </button>
          </div>
          <Show when={state.targetNotes().length > 0}>
            <div class={styles.targetChips}>
              <For each={state.targetNotes()}>
                {(midi) => (
                  <span class={styles.targetChip}>{midiToNoteName(midi)}</span>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>

      {/* Recorded notes timeline */}
      <Show when={state.recordedNotes().length > 0}>
        <div class={styles.timelineSection}>
          <span class={styles.timelineLabel}>
            Recorded ({state.recordedNotes().length} notes)
            <Show when={state.recordingDuration() > 0}>
              {' · '}
              {formatTime(state.recordingDuration())}
            </Show>
          </span>
          <div class={styles.timeline}>
            <For each={state.recordedNotes()}>
              {(note) => {
                // Determine if this note was scored
                const isScored = state.phase() === 'scoring'
                let scoreClass = ''
                if (isScored) {
                  const results = state.noteResults()
                  // Map recorded note to result (greedy, same as scoring logic)
                  const targets = state.targetNotes()
                  let bestDist = Infinity
                  let bestResultIdx = -1
                  for (let i = 0; i < targets.length; i++) {
                    const dist = Math.min(
                      Math.abs((note.midi % 12) - (targets[i] % 12)),
                      12 - Math.abs((note.midi % 12) - (targets[i] % 12)),
                    )
                    if (dist < bestDist) {
                      bestDist = dist
                      bestResultIdx = i
                    }
                  }
                  if (
                    bestResultIdx >= 0 &&
                    results[bestResultIdx] &&
                    bestDist <= 1
                  ) {
                    scoreClass =
                      results[bestResultIdx] === 'correct'
                        ? styles.timelineNoteCorrect
                        : styles.timelineNoteWrong
                  }
                }

                return (
                  <div
                    class={`${styles.timelineNote} ${scoreClass}`}
                    style={{
                      left: `${(note.timeMs / Math.max(state.recordingDuration(), 1)) * 100}%`,
                    }}
                    title={`${note.noteName} · ${note.frequency.toFixed(1)}Hz · ${formatTime(note.timeMs)}`}
                  >
                    <span class={styles.timelineNoteName}>{note.noteName}</span>
                  </div>
                )
              }}
            </For>
          </div>
        </div>
      </Show>

      {/* Score display */}
      <Show when={state.phase() === 'scoring'}>
        <div class={styles.scoreSection}>
          <div class={styles.scoreRow}>
            <span class={styles.scoreLabel}>Score</span>
            <span class={styles.scoreValue}>{state.score()} pts</span>
            <span class={styles.scorePercent}>{scorePercent()}%</span>
          </div>
          <div class={styles.scoreBar}>
            <div
              class={styles.scoreBarFill}
              style={{ width: `${scorePercent()}%` }}
            />
          </div>
          <div class={styles.scoreDetail}>
            <For each={state.noteResults()}>
              {(result, idx) => (
                <span
                  class={
                    result === 'correct'
                      ? styles.scoreNoteCorrect
                      : styles.scoreNoteWrong
                  }
                >
                  {(() => {
                    const midi = state.targetNotes()[idx()]
                    return midi !== undefined ? midiToNoteName(midi) : '?'
                  })()}
                </span>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Empty state */}
      <Show
        when={state.phase() === 'idle' && state.recordedNotes().length === 0}
      >
        <div class={styles.emptyState}>
          Record a riff — play your guitar into the mic, then score it against a
          target melody.
        </div>
      </Show>
    </div>
  )
}
