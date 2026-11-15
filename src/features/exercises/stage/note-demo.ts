// ============================================================
// A drill's example, played as a row of notes
// ============================================================
//
// "Hear it first": before the singer tries a drill, Merc plays one example
// of what it asks for (the shell's `demo`). For most drills the example is
// a few notes in a row, which is all this does: strike each for its length,
// with a gap between, and say when the last has finished.
//
// The first note is struck where `play` is called, not on a timer, since a
// browser lets a page make its first sound only from inside a tap.

import { midiToFrequency } from '@/lib/frequency-to-note'

/** As much of the audio engine as an example needs. */
export interface NoteDemoEngine {
  playTone: (frequency: number, durationMs?: number) => Promise<void>
  stopTone: (releaseMs?: number) => void
}

export interface NoteDemoOptions {
  /** How long each note sounds, in ms. */
  noteMs?: number
  /** The silence between two notes, in ms. */
  gapMs?: number
}

const NOTE_MS = 800
const GAP_MS = 250

export function createNoteDemo(engine: NoteDemoEngine) {
  let timers: ReturnType<typeof setTimeout>[] = []
  let settle: (() => void) | null = null

  /** Cut the example short. The promise `play` gave still resolves. */
  function stop(): void {
    // Nothing playing, nothing to silence: a drill that never played its
    // example must not reach for the engine on its way out.
    if (settle === null && timers.length === 0) return
    for (const timer of timers) clearTimeout(timer)
    timers = []
    engine.stopTone()
    const done = settle
    settle = null
    done?.()
  }

  /** Play the notes in order; resolves when the last has finished sounding. */
  function play(
    midis: readonly number[],
    options: NoteDemoOptions = {},
  ): Promise<void> {
    stop()
    const noteMs = options.noteMs ?? NOTE_MS
    const gapMs = options.gapMs ?? GAP_MS
    return new Promise<void>((resolve) => {
      settle = resolve
      let at = 0
      midis.forEach((midi, i) => {
        const strike = (): void => {
          engine.playTone(midiToFrequency(midi), noteMs).catch(() => {
            // A note that cannot sound ends nothing: the example runs on.
          })
        }
        if (at === 0) strike()
        else timers.push(setTimeout(strike, at))
        at += noteMs + (i === midis.length - 1 ? 0 : gapMs)
      })
      timers.push(
        setTimeout(() => {
          timers = []
          settle = null
          resolve()
        }, at),
      )
    })
  }

  return { play, stop }
}

export type NoteDemo = ReturnType<typeof createNoteDemo>
