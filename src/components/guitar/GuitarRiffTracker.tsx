// ============================================================
// GuitarRiffTracker — record, review & score guitar riffs.
//
// Free-form mic recording of riffs with note detection, a simple
// timeline display, and scoring against a target melody.
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import type { RiffTrackerState } from '@/features/guitar-practice/RiffTrackerState'
import { midiToNoteName } from '@/lib/frequency-to-note'
import { NOTE_NAMES } from '@/lib/note-utils'
import styles from './GuitarRiffTracker.module.css'

// ── Types ──────────────────────────────────────────────────────

interface GuitarRiffTrackerProps {
  /** Riff tracker state (owned by the page/context). */
  state: RiffTrackerState
}

// ── Helpers ───────────────────────────────────────────────────

const formatTime = (ms: number) => `${(ms / 1000).toFixed(1)}s`

/**
 * Parse a comma/space-separated string of note names (e.g. "E4, G4, A4")
 * or MIDI numbers (e.g. "64, 67, 69") into an array of MIDI numbers.
 */
function parseTargetMelody(raw: string): number[] {
  const parts = raw.split(/[, ]+/)
  const midis: number[] = []
  for (const part of parts) {
    if (part === '') continue
    const num = Number(part)
    if (!isNaN(num) && num >= 0 && num <= 127) {
      midis.push(num)
    } else {
      // Try "E4", "G#3", etc. — NOTE_NAMES is from @/lib/note-utils
      const match = part.match(/^([A-G]#?)(\d)$/i)
      if (match) {
        const idx = NOTE_NAMES.indexOf(match[1].toUpperCase())
        if (idx >= 0) {
          const octave = parseInt(match[2])
          midis.push((octave + 1) * 12 + idx)
        }
      }
    }
  }
  return midis
}

/**
 * Octave-folded best-match index into target notes for a recorded note.
 * Returns the target index and distance (or -1 if none match within threshold).
 */
function findBestTargetMatch(
  recordedMidi: number,
  targets: number[],
  used: Set<number>,
  maxSemitones: number,
): { index: number; dist: number } {
  let bestIdx = -1
  let bestDist = Infinity
  for (let i = 0; i < targets.length; i++) {
    if (used.has(i)) continue
    const dist = Math.min(
      Math.abs((recordedMidi % 12) - (targets[i] % 12)),
      12 - Math.abs((recordedMidi % 12) - (targets[i] % 12)),
    )
    if (dist < bestDist) {
      bestDist = dist
      bestIdx = i
    }
  }
  return bestDist <= maxSemitones
    ? { index: bestIdx, dist: bestDist }
    : { index: -1, dist: bestDist }
}

// ── Component ──────────────────────────────────────────────────

export const GuitarRiffTracker: Component<GuitarRiffTrackerProps> = ({
  state,
}) => {
  const [targetInput, setTargetInput] = createSignal('')

  const handleTargetSubmit = () => {
    const raw = targetInput().trim()
    if (!raw) return
    const midis = parseTargetMelody(raw)
    if (midis.length > 0) state.setTargetMelody(midis)
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
                const isScored = state.phase() === 'scoring'
                const dur = () => Math.max(state.recordingDuration(), 1)
                let scoreClass = ''
                if (isScored) {
                  const result = findBestTargetMatch(
                    note.midi,
                    state.targetNotes(),
                    new Set(),
                    1,
                  )
                  if (result.index >= 0) {
                    scoreClass =
                      state.noteResults()[result.index] === 'correct'
                        ? styles.timelineNoteCorrect
                        : styles.timelineNoteWrong
                  }
                }

                return (
                  <div
                    class={`${styles.timelineNote} ${scoreClass}`}
                    style={{
                      left: `${(note.timeMs / dur()) * 100}%`,
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
