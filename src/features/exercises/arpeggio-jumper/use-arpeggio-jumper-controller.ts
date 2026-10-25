// ============================================================
// Arpeggio Jumper controller — four chord tones, each scored in its own time
// ============================================================
//
// The grade is the mean of the note scores and nothing else, so the number
// the singer watches during the run is the number they get. The best note is
// praise on the result line, not part of the grade (scoring version 2,
// 2026-10-25; version 1 blended in the best note at 30 % and a "richness"
// read on the wrong scale at 25 %, which capped a flawless run at 75).
//
// Which sound a note is scored on is the part that is easy to break:
//
//  - `playTone` resolves once the tone is SCHEDULED, not when it ends
//    (audio-engine.ts). Every window is timed from the tone's start plus its
//    length, never from the promise.
//  - A note is scored only on the frames voiced inside its own window, never
//    on a trailing window: that one slid back onto the reference tone (the
//    mic runs with echo cancellation off) or the note before whenever the
//    singer went quiet.
//  - Frames arrive one measured mic round trip after they were sung, so each
//    window is read that much later.
//  - The first 15 % of a note's frames, the slide into it, is not scored
//    (score-window's 'settled' mode, the app's default).
//  - The run is scored in one octave: the guide's, or one above or below it,
//    whichever fits the whole run best. Each note is still scored against
//    its own target in that octave, so the leap to the top do has to be sung.

import { batch } from 'solid-js'
import { difficultyFactor } from '@/features/practice-intelligence/difficulty-scaling'
import { launchDifficulty } from '@/features/practice-intelligence/launch-override'
import { midiToFrequency as midiToFreq } from '@/lib/frequency-to-note'
import { scoreWindow } from '@/lib/score-window'
import { EMPTY_NOTE_TALLY, tallyFromDeviations } from '../exercise-note-tally'
import { averageDeviationCents, scoreSamples } from '../exercise-scoring-utils'
import type { ExerciseResult } from '../types'
import { EXERCISE_ARPEGGIO_JUMPER } from '../types'
import type { BaseExerciseController } from '../use-base-exercise'

type ArpeggioType = 'major' | 'minor' | 'diminished' | 'augmented'

/**
 * Interaction mode:
 *  - 'steps' — the classic loop: play ONE note, sing it back, next note.
 *  - 'echo'  — audiation practice: the WHOLE arpeggio plays first, then the
 *    singer repeats it from memory in evenly-paced slots. Each expected note
 *    is scored only against its own slot, so the right notes in the wrong
 *    order do not score.
 */
export type ArpeggioMode = 'steps' | 'echo'

const ARPEGGIO_DEGREES: Record<ArpeggioType, number[]> = {
  major: [0, 4, 7, 12],
  minor: [0, 3, 7, 12],
  diminished: [0, 3, 6, 12],
  augmented: [0, 4, 8, 12],
}

const NOTE_PLAY_DURATION_MS = 700
/** Steps mode: quiet between the tone's end and the singer's window. */
const GAP_BETWEEN_NOTES_MS = 250
const MATCH_WINDOW_MS = 2000
/** Echo mode: pause between the played phrase's end and the singer's turn. */
const GAP_BEFORE_ECHO_MS = 700
/** Echo mode: per-note singing slot (scaled by difficulty like the rest). */
const ECHO_SLOT_MS = 1300
/** Steps mode: pause after a note's window before the next tone. */
const PAUSE_AFTER_NOTE_MS = 400

/**
 * The least time a singer gets for one note, at every level: room for a
 * late start, the slide in, a settled stretch and the mic round trip. Level
 * 10 used to shrink an echo slot to 780 ms. Harder levels shorten the demo
 * tone instead; the time to sing stops shrinking here.
 */
export const MIN_SINGING_MS = 1200

/** One run's timings at a difficulty level (1-10, 5 is the baseline). */
export interface ArpeggioTimings {
  /** How long each demo tone sounds. */
  toneMs: number
  /** Steps mode: the singer's window for each note. */
  windowMs: number
  /** Echo mode: the singer's slot for each note. */
  slotMs: number
  /** Echo mode: silence between the demo's last note and slot 0. */
  gapBeforeEchoMs: number
}

export function arpeggioTimings(level: number): ArpeggioTimings {
  const factor = difficultyFactor(level)
  return {
    toneMs: Math.round(NOTE_PLAY_DURATION_MS * factor),
    windowMs: Math.max(MIN_SINGING_MS, Math.round(MATCH_WINDOW_MS * factor)),
    slotMs: Math.max(MIN_SINGING_MS, Math.round(ECHO_SLOT_MS * factor)),
    gapBeforeEchoMs: Math.round(GAP_BEFORE_ECHO_MS * factor),
  }
}

interface PitchFrame {
  freq: number
  time: number
  cents: number
  clarity?: number
}

/** One presented note: its written target and the frames it is scored on. */
export interface SungNote {
  midi: number
  /** Voiced frames from the note's own window, settled; empty = not sung. */
  frames: readonly PitchFrame[]
}

/** Octaves the run may be scored in, relative to the guide. */
export type OctaveOffset = -1 | 0 | 1

/** The guide's octave first, so a tie never moves the run. */
const OCTAVE_OFFSETS: readonly OctaveOffset[] = [0, -1, 1]

/**
 * The one octave offset for the whole run that minimises its total error:
 * the sum, over the notes that were sung, of each note's mean distance in
 * cents from its target moved by that many octaves. One offset, not one per
 * note, so the leap to the top do still has to be sung; and the whole run
 * decides it, not the first note, where phrases start flat and a single
 * detector octave error would have zeroed every note.
 */
export function bestOctaveOffset(notes: readonly SungNote[]): OctaveOffset {
  let best: OctaveOffset = 0
  let bestError = Infinity
  for (const offset of OCTAVE_OFFSETS) {
    let error = 0
    for (const note of notes) {
      error += averageDeviationCents(note.frames, note.midi + 12 * offset) ?? 0
    }
    if (error < bestError) {
      best = offset
      bestError = error
    }
  }
  return best
}

/** Each note's score, and its distance in cents or null when not sung. */
export function scoreSungNotes(
  notes: readonly SungNote[],
  offset: OctaveOffset,
): { scores: number[]; deviations: (number | null)[] } {
  return {
    scores: notes.map((n) => scoreSamples(n.frames, n.midi + 12 * offset)),
    deviations: notes.map((n) =>
      averageDeviationCents(n.frames, n.midi + 12 * offset),
    ),
  }
}

/** What the result line says about the octave, or null in the guide's. */
export function octaveLine(offset: number | undefined): string | null {
  if (offset === 1) return 'Scored an octave above the guide tone.'
  if (offset === -1) return 'Scored an octave below the guide tone.'
  return null
}

/**
 * Whether anything was voiced in any note's window. A run with nothing is
 * not a low result but no result: it is not recorded (REQ-GVC-031, refuse a
 * false low result), so it moves no average, level or weak-drill flag.
 */
export function arpeggioRunHeard(
  metrics: Readonly<Record<string, number>> | undefined,
): boolean {
  return (metrics?.notesSung ?? 0) > 0
}

function buildArpeggioNotes(
  baseMidi: number,
  arpeggioType: ArpeggioType,
  direction: 'up' | 'down',
): number[] {
  const degrees = ARPEGGIO_DEGREES[arpeggioType]
  let notes = degrees.map((d) => baseMidi + d)
  if (direction === 'down') {
    notes = [...notes].reverse()
  }
  return notes
}

export interface ArpeggioJumperOptions {
  /** The measured mic round trip in ms; 0 (unmeasured) changes nothing. */
  micLatencyMs?: () => number
}

export function useArpeggioJumperController(
  base: BaseExerciseController,
  audioEngine: { playTone: (freq: number, duration?: number) => Promise<void> },
  options: ArpeggioJumperOptions = {},
) {
  let arpeggioNotes: number[] = []
  let noteIndex = 0
  // One entry per note PRESENTED, so a note that captured nothing stays in
  // the run as "not sung" rather than vanishing from the denominator.
  let sungNotes: SungNote[] = []
  let mode: ArpeggioMode = 'steps'
  let timings = arpeggioTimings(5)
  const timers = new Set<ReturnType<typeof setTimeout>>()
  let _cancelled = false
  // Bumped by every setArpeggio. An await begun in an earlier run (the echo
  // demo waits out each tone; playTone waits on the audio context) can
  // settle after Stop and a new start have cleared `_cancelled`, so each
  // continuation checks that its run is still the one in progress.
  let run = 0

  const latencyMs = (): number => Math.max(0, options.micLatencyMs?.() ?? 0)

  function schedule(fn: () => void, ms: number): void {
    const timer = setTimeout(() => {
      timers.delete(timer)
      if (_cancelled) return
      fn()
    }, ms)
    timers.add(timer)
  }

  function clearTimers(): void {
    for (const timer of timers) clearTimeout(timer)
    timers.clear()
  }

  base._registerDispose(() => {
    clearTimers()
    // reset()/unmount can fire while a playTone().then() continuation is
    // in flight — clearing the pending timers alone cannot stop it from
    // re-arming the chain (Back kept the sequence playing to the end).
    // The flag makes the continuation's own guards bail instead.
    _cancelled = true
  })

  function setArpeggio(
    baseMidi: number,
    arpeggioType: ArpeggioType = 'major',
    direction: 'up' | 'down' = 'up',
    interactionMode: ArpeggioMode = 'steps',
  ): void {
    run++
    _cancelled = false
    arpeggioNotes = buildArpeggioNotes(baseMidi, arpeggioType, direction)
    noteIndex = 0
    sungNotes = []
    mode = interactionMode
    timings = arpeggioTimings(launchDifficulty(EXERCISE_ARPEGGIO_JUMPER))
  }

  function startArpeggio(): void {
    if (mode === 'echo') {
      void playEchoCall()
    } else {
      playCurrentNote()
    }
  }

  /**
   * Keep the frames voiced in `[fromMs, toMs)` of the run clock, settled, as
   * the next note's evidence, and move the live score to what the grade
   * would be now.
   */
  function recordNote(midi: number, fromMs: number, toMs: number): void {
    const voiced = base
      .pitchHistory()
      .filter(
        (p) => p.freq > 0 && p.time >= fromMs / 1000 && p.time < toMs / 1000,
      )
    sungNotes.push({ midi, frames: scoreWindow(voiced, 'settled') })
    const { scores } = scoreSungNotes(sungNotes, bestOctaveOffset(sungNotes))
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    batch(() => {
      base._updateScore(Math.round(avg))
      base._updateMetrics({
        lastNoteScore: scores[scores.length - 1],
        notesCompleted: scores.length,
      })
    })
  }

  // ── Echo mode: play the whole phrase, then score slot by slot ──────

  async function playEchoCall(): Promise<void> {
    const thisRun = run
    const over = () => _cancelled || run !== thisRun
    batch(() => {
      base._updateMetrics({
        arpeggioLength: arpeggioNotes.length,
        echo: 1,
        phase: 1, // listening to the full phrase
        matchWindowMs: timings.slotMs,
      })
    })
    for (let i = 0; i < arpeggioNotes.length; i++) {
      if (over()) return
      const midi = arpeggioNotes[i]
      batch(() => {
        base._setTargetPitch(midiToFreq(midi))
        base._updateMetrics({ noteIndex: i, currentMidi: midi })
      })
      await audioEngine.playTone(midiToFreq(midi), timings.toneMs)
      // The promise settles when the tone is scheduled. Wait it out, so each
      // demo note sounds in full before the next one cuts it off.
      await new Promise((r) => setTimeout(r, timings.toneMs))
    }
    if (over()) return
    schedule(startEchoResponse, timings.gapBeforeEchoMs)
  }

  /**
   * One singing slot per expected note. The target line and label move with
   * the slots on the screen's clock; each slot is read one mic round trip
   * later, when its frames have arrived.
   */
  function startEchoResponse(): void {
    const responseStartMs = base._getElapsed()
    const lag = latencyMs()
    const slotMs = timings.slotMs
    noteIndex = 0
    showEchoSlot(0)
    for (let i = 0; i < arpeggioNotes.length; i++) {
      const slot = i
      const fromMs = responseStartMs + slot * slotMs + lag
      if (slot > 0) schedule(() => showEchoSlot(slot), slot * slotMs)
      schedule(
        () => {
          recordNote(arpeggioNotes[slot], fromMs, fromMs + slotMs)
          if (sungNotes.length >= arpeggioNotes.length) finish()
        },
        (slot + 1) * slotMs + lag,
      )
    }
  }

  function showEchoSlot(slot: number): void {
    noteIndex = slot
    const midi = arpeggioNotes[slot]
    batch(() => {
      base._setTargetPitch(midiToFreq(midi))
      base._updateMetrics({ noteIndex: slot, currentMidi: midi, phase: 2 })
    })
  }

  // ── Steps mode: one tone, one window, next note ──────

  function playCurrentNote(): void {
    if (noteIndex >= arpeggioNotes.length) {
      finish()
      return
    }

    const idx = noteIndex
    const midi = arpeggioNotes[idx]
    batch(() => {
      base._setTargetPitch(midiToFreq(midi))
      base._updateMetrics({
        noteIndex: idx,
        arpeggioLength: arpeggioNotes.length,
        currentMidi: midi,
        phase: 1,
        // report the SCALED acceptance window for the component to display
        matchWindowMs: timings.windowMs,
      })
    })

    const thisRun = run
    void audioEngine.playTone(midiToFreq(midi), timings.toneMs).then(() => {
      if (_cancelled || run !== thisRun) return
      // Settled at scheduling: the tone is still sounding. The window opens
      // after its length plus the gap, so the tone is never scored.
      schedule(() => startMatching(idx), timings.toneMs + GAP_BETWEEN_NOTES_MS)
    })
  }

  function startMatching(idx: number): void {
    batch(() => base._updateMetrics({ phase: 2 }))
    // The window is the singer's turn on screen, read one round trip later.
    const lag = latencyMs()
    const fromMs = base._getElapsed() + lag
    const windowMs = timings.windowMs
    schedule(() => {
      recordNote(arpeggioNotes[idx], fromMs, fromMs + windowMs)
      noteIndex = idx + 1
      schedule(playCurrentNote, PAUSE_AFTER_NOTE_MS)
    }, windowMs + lag)
  }

  function finish(): void {
    const result = computeResult()
    base._completeWithResult(result)
  }

  function computeResult(): ExerciseResult {
    const echoMode = mode === 'echo' ? 1 : 0
    if (sungNotes.length === 0) {
      return {
        type: EXERCISE_ARPEGGIO_JUMPER,
        score: 0,
        metrics: {
          notesCompleted: 0,
          avgAccuracy: 0,
          bestNote: 0,
          notesSung: 0,
          octaveOffset: 0,
          echoMode,
          ...EMPTY_NOTE_TALLY,
        },
        completedAt: Date.now(),
      }
    }
    const octaveOffset = bestOctaveOffset(sungNotes)
    const { scores, deviations } = scoreSungNotes(sungNotes, octaveOffset)
    const avgAccuracy = Math.round(
      scores.reduce((a, b) => a + b, 0) / scores.length,
    )

    return {
      type: EXERCISE_ARPEGGIO_JUMPER,
      // The one rule: the grade is the mean of the note scores.
      score: avgAccuracy,
      metrics: {
        notesCompleted: scores.length,
        avgAccuracy,
        // Praise on the result line; it is not part of the grade.
        bestNote: Math.max(...scores),
        notesSung: deviations.filter((d) => d !== null).length,
        octaveOffset,
        echoMode,
        // Counted in the same octave as the score.
        ...tallyFromDeviations(deviations),
      },
      completedAt: Date.now(),
    }
  }

  function stopArpeggio(): void {
    _cancelled = true
    clearTimers()
    base._setRunning(false)
    finish()
  }

  /** Notes still to come after the one being asked for, nearest first. */
  function getUpcomingMidi(): number[] {
    return arpeggioNotes.slice(noteIndex + 1)
  }

  return {
    setArpeggio,
    startArpeggio,
    stopArpeggio,
    computeResult,
    getUpcomingMidi,
  }
}
