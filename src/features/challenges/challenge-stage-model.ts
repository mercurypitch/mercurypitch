// ============================================================
// Challenge Stage Model — weekly melody -> zen targets, per-note scoring
// ============================================================
//
// Pure functions behind ChallengeStage. The weekly challenge's MelodyItem[]
// becomes a synthetic ZenExerciseDefinition so the zen pitch session/canvas
// can host it unchanged, and a finished run is scored per note with the
// sight-singing drill's semantics so the recorded result is interchangeable
// with a drill run: per-note quality from pitch proximity (best 30% of the
// attempt), a matched floor of 70 for a held note — and the final score is
// the drill's own finalizeSightSingingScore, so unsung notes count zero and
// the armed weekly attempt consumes the result exactly as if the drill had
// produced it.

import { finalizeSightSingingScore } from '@/features/exercises/sight-singing/use-sight-singing-controller'
import { midiToNoteName } from '@/lib/frequency-to-note'
import type { MelodyItem } from '@/types'
import type { ResolvedZenTarget, ZenExerciseDefinition, ZenPitchPoint, ZenTargetHighlight, } from '../zen/types'

/** One challenge beat lasts one second — a calm, singable default tempo. */
export const CHALLENGE_BPM = 60
/** Breathing room before the first note (the playhead's approach run). */
export const CHALLENGE_LEAD_IN_BEATS = 2
/** Space after the last note so the run does not cut on its release. */
export const CHALLENGE_TAIL_BEATS = 1

/** Mirrors the sight-singing drill's tolerance/hold rules (parity target). */
const TOLERANCE_CENTS = 60
const HOLD_TO_PASS_MS = 450
const MATCHED_FLOOR = 70
/**
 * Gap between consecutive voiced samples that still counts as continuous
 * hold. Frames arrive ~every 20-40 ms, so this admits a dropped frame or
 * two and nothing more: the drill DECAYS its hold timer while a voice is
 * unvoiced, and a generous bridge here would hand the matched floor to
 * three sporadic blips that the drill scores far lower.
 */
const MAX_SAMPLE_GAP_MS = 60
/** A cleared note keeps this much shine after its window passes. */
const CLEARED_GLOW = 0.72
/** Live glow forgives a bit more than scoring so the light leads the singer. */
const GLOW_CENTS_SPAN = 120
/** How far back a voiced sample may lie and still drive the live glow. */
const GLOW_RECENCY_SEC = 0.3

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

export interface ChallengeStageSource {
  id: string
  title: string
  targetItems: MelodyItem[]
}

/**
 * Build the synthetic zen exercise for a weekly challenge. Notes keep their
 * relative timing (normalised so the first starts right after the lead-in);
 * pitches ride on defaultRootMidi + semitone like every catalog exercise, so
 * resolveZenTargets needs no special case. Returns null when the challenge
 * has no notes — the stage cannot host an empty melody.
 */
export function challengeToZenExercise(
  challenge: ChallengeStageSource,
): ZenExerciseDefinition | null {
  const items = challenge.targetItems
    .filter(
      (item) =>
        Number.isFinite(item.note?.midi) &&
        Number.isFinite(item.startBeat) &&
        Number.isFinite(item.duration),
    )
    .slice()
    .sort((a, b) => a.startBeat - b.startBeat)
  if (items.length === 0) return null

  const firstBeat = items[0]!.startBeat
  // ABSOLUTE pitch, deliberately. The feat IS the pitch — "hold
  // Puccini's B4 on Vincero" is a tenor money note, and transposing it
  // into each singer's octave would quietly turn one shared feat into a
  // different, easier one per person while they all share a board. The
  // design's answer to inclusivity is a per-voice-type SPLIT (the
  // authored weeks pair a tenor feat with a soprano one, and the
  // catalogue carries low-voice entries) — see WeeklyChallenge's
  // voiceTypeSplit column, not yet surfaced.
  const sourceRoot = items[0]!.note.midi
  const rootMidi = sourceRoot
  const targets = items.map((item, index) => ({
    id: `challenge-note-${index}`,
    startBeat: CHALLENGE_LEAD_IN_BEATS + (item.startBeat - firstBeat),
    durationBeats: Math.max(0.25, item.duration),
    semitone: item.note.midi - sourceRoot,
    cue: midiToNoteName(item.note.midi),
    showCue: true,
  }))
  const lastEndBeat = targets.reduce(
    (end, target) => Math.max(end, target.startBeat + target.durationBeats),
    0,
  )

  return {
    id: `weekly-challenge:${challenge.id}`,
    version: 1,
    title: challenge.title,
    category: 'scales',
    level: 'developing',
    summary: 'This week’s Legend line, one take on the zen canvas.',
    goal: 'Light every note as the line passes.',
    instructions:
      'Sing each note as the playhead reaches it — held, in tune notes shine.',
    bpm: CHALLENGE_BPM,
    countInBeats: 0,
    loopBeats: lastEndBeat + CHALLENGE_TAIL_BEATS,
    defaultRootMidi: rootMidi,
    targets,
    defaultTargetVisibility: 'on',
    defaultProgressCue: 'playhead',
    scoring: {
      pitchWeight: 0.6,
      coverageWeight: 0.3,
      steadinessWeight: 0.1,
      toleranceCents: TOLERANCE_CENTS,
    },
  }
}

export interface ChallengeNoteScore {
  id: string
  /** 0..100, sight-singing per-note semantics. */
  score: number
  /** Held within tolerance long enough to earn the matched floor. */
  matched: boolean
  /** At least two voiced samples landed in this note's window. */
  sung: boolean
}

interface WindowSample {
  timeSec: number
  cents: number
}

function samplesInWindow(
  points: readonly ZenPitchPoint[],
  target: ResolvedZenTarget,
): WindowSample[] {
  const samples: WindowSample[] = []
  for (const point of points) {
    if (point.midi === null || !Number.isFinite(point.midi)) continue
    if (point.timeSec < target.startSec || point.timeSec > target.endSec) {
      continue
    }
    samples.push({
      timeSec: point.timeSec,
      cents: (point.midi - target.startMidi) * 100,
    })
  }
  return samples
}

/** Cumulative in-tolerance time, summing bounded gaps between samples. */
function heldMs(samples: readonly WindowSample[]): number {
  let total = 0
  for (let i = 1; i < samples.length; i++) {
    const previous = samples[i - 1]!
    const current = samples[i]!
    if (
      Math.abs(previous.cents) > TOLERANCE_CENTS ||
      Math.abs(current.cents) > TOLERANCE_CENTS
    ) {
      continue
    }
    total += Math.min(
      MAX_SAMPLE_GAP_MS,
      (current.timeSec - previous.timeSec) * 1000,
    )
  }
  return total
}

/**
 * Score one target window the way the sight-singing drill scores one note:
 * average the best 30% of absolute deviations (rewards finding the note even
 * after a scoop), 1.5 points per cent off, matched floor of 70 for a note
 * held within tolerance. The hold requirement shrinks for notes too short to
 * ever accumulate the drill's 450 ms.
 */
export function scoreChallengeNote(
  points: readonly ZenPitchPoint[],
  target: ResolvedZenTarget,
): ChallengeNoteScore {
  const samples = samplesInWindow(points, target)
  const sung = samples.length >= 2
  let score = 0
  if (sung) {
    const deviations = samples
      .map((sample) => Math.abs(sample.cents))
      .sort((a, b) => a - b)
    const best = deviations.slice(
      0,
      Math.max(1, Math.floor(deviations.length * 0.3)),
    )
    const avgBest = best.reduce((a, b) => a + b, 0) / best.length
    score = Math.max(0, Math.round(100 - avgBest * 1.5))
  }

  const windowMs = Math.max(0, target.endSec - target.startSec) * 1000
  const holdTarget = Math.min(HOLD_TO_PASS_MS, windowMs * 0.6)
  const matched = sung && holdTarget > 0 && heldMs(samples) >= holdTarget
  if (matched) score = Math.max(score, MATCHED_FLOOR)

  return { id: target.id, score, matched, sung }
}

export function scoreChallengeNotes(
  points: readonly ZenPitchPoint[],
  targets: readonly ResolvedZenTarget[],
): ChallengeNoteScore[] {
  return targets.map((target) => scoreChallengeNote(points, target))
}

/** A note counts as cleared (kept shining) from the matched floor upward. */
export const CHALLENGE_CLEAR_SCORE = MATCHED_FLOOR

export interface ChallengeRunSummary {
  /** Whole-sequence score — finalizeSightSingingScore, unsung notes zero. */
  score: number
  /** Quality of what was actually reached (the drill's avgAccuracy). */
  avgAccuracy: number
  bestNote: number
  notesAttempted: number
  notesScored: number
  /** Notes at/above the matched floor — the "notes lit" count. */
  clearedCount: number
}

/**
 * Summarise a finished run with the drill's exact finalisation. "Scored"
 * notes are the windows the run reached (their end fell within
 * durationSec) — ending mid-window leaves the current note unscored, like
 * the drill's Stop & Score — and finalizeSightSingingScore spans the WHOLE
 * sequence, so unsung notes count zero and a partial run cannot outscore an
 * honest full pass.
 */
export function summarizeChallengeRun(
  points: readonly ZenPitchPoint[],
  targets: readonly ResolvedZenTarget[],
  durationSec: number,
): ChallengeRunSummary {
  const reached = targets.filter(
    (target) => target.endSec <= durationSec + 0.05,
  )
  const notes = scoreChallengeNotes(points, reached)
  const final = finalizeSightSingingScore(
    notes.map((note) => note.score),
    targets.length,
  )
  return {
    score: final.score,
    avgAccuracy: final.avgAccuracy,
    bestNote: final.bestNote,
    notesAttempted: targets.length,
    notesScored: notes.length,
    clearedCount: notes.filter((note) => note.score >= CHALLENGE_CLEAR_SCORE)
      .length,
  }
}

/**
 * Live per-target emphasis for the canvas. Current-window targets glow with
 * the singer's proximity (a touch more forgiving than scoring, so the light
 * responds while they close in); passed targets settle into a steady shine
 * when cleared or recede when missed; upcoming targets stay plain. The
 * cleared shine breathes slightly with elapsed time so a finished trail
 * still feels alive.
 */
export function challengeTargetHighlights(
  points: readonly ZenPitchPoint[],
  targets: readonly ResolvedZenTarget[],
  elapsedSec: number,
): Map<string, ZenTargetHighlight> {
  const highlights = new Map<string, ZenTargetHighlight>()
  const breathe = 0.92 + 0.08 * Math.sin(elapsedSec * Math.PI)

  for (const target of targets) {
    if (elapsedSec > target.endSec) {
      const note = scoreChallengeNote(points, target)
      const cleared = note.score >= CHALLENGE_CLEAR_SCORE
      highlights.set(target.id, {
        glow: cleared ? CLEARED_GLOW * breathe : 0,
        cleared,
        missed: !cleared,
      })
      continue
    }

    if (elapsedSec < target.startSec) {
      highlights.set(target.id, { glow: 0, cleared: false, missed: false })
      continue
    }

    let glow = 0
    for (let i = points.length - 1; i >= 0; i--) {
      const point = points[i]!
      if (point.timeSec < elapsedSec - GLOW_RECENCY_SEC) break
      if (point.midi === null || point.timeSec < target.startSec) continue
      const cents = Math.abs((point.midi - target.startMidi) * 100)
      glow = clamp(1 - cents / GLOW_CENTS_SPAN, 0, 1)
      break
    }
    highlights.set(target.id, { glow, cleared: false, missed: false })
  }
  return highlights
}
