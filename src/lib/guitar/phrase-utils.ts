// ============================================================
// Phrase generation + timer utilities for guitar practice modules
// ============================================================

import { KEY_OFFSETS, SCALE_DEFINITIONS } from '@/lib/scale-data'
import { MAX_FRET, OPEN_MIDI } from './constants'

// ── Timer helpers ─────────────────────────────────────────────

/** Lightweight batched timer manager for sequenced playback. */
export class SequenceTimer {
  private timers: ReturnType<typeof setTimeout>[] = []
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null

  /** Schedule a callback after `delayMs` and track it for cleanup. */
  schedule(cb: () => void, delayMs: number): void {
    this.timers.push(setTimeout(cb, delayMs))
  }

  /** Schedule a one-shot feedback timer that replaces any prior one. */
  scheduleFeedback(cb: () => void, delayMs: number): void {
    if (this.feedbackTimer !== null) clearTimeout(this.feedbackTimer)
    this.feedbackTimer = setTimeout(cb, delayMs)
  }

  /** Clear all scheduled timers immediately. */
  clear(): void {
    for (const t of this.timers) clearTimeout(t)
    this.timers = []
    if (this.feedbackTimer !== null) {
      clearTimeout(this.feedbackTimer)
      this.feedbackTimer = null
    }
  }
}

/**
 * Generate a random phrase of `noteCount` MIDI notes from the given key
 * and scale, restricted to valid guitar fretboard positions.
 */
export function generateGuitarPhrase(
  key: string,
  scale: string,
  noteCount: number,
): number[] {
  const def = SCALE_DEFINITIONS[scale]
  const degrees = def.degrees
  const rootOffset = KEY_OFFSETS[key] ?? 0

  const available: number[] = []
  for (let s = 0; s < 6; s++)
    for (let f = 0; f <= MAX_FRET; f++) {
      const midi = OPEN_MIDI[s] + f
      const degree = (((midi - rootOffset) % 12) + 12) % 12
      if (degrees.includes(degree) || degrees.includes(degree + 12)) {
        available.push(midi)
      }
    }

  const phrase: number[] = []
  for (let i = 0; i < noteCount; i++) {
    phrase.push(available[Math.floor(Math.random() * available.length)])
  }
  return phrase
}
