// ============================================================
// Challenge Stage Model tests — melody adapter + coverage-honest scoring
// ============================================================

import { describe, expect, it } from 'vitest'
import { CHALLENGE_LEAD_IN_BEATS, CHALLENGE_TAIL_BEATS, challengeTargetHighlights, challengeToZenExercise, scoreChallengeNotes, summarizeChallengeRun, } from '@/features/challenges/challenge-stage-model'
import type { ResolvedZenTarget, ZenPitchPoint } from '@/features/zen/types'
import { resolveZenTargets } from '@/features/zen/zen-model'
import { midiToFrequency, midiToNoteName } from '@/lib/frequency-to-note'
import type { MelodyItem, NoteName } from '@/types'

function melodyItem(midi: number, startBeat: number, duration = 1): MelodyItem {
  return {
    id: startBeat + 1,
    note: {
      midi,
      name: midiToNoteName(midi).replace(/-?\d+$/, '') as NoteName,
      octave: Math.floor(midi / 12) - 1,
      freq: midiToFrequency(midi),
    },
    duration,
    startBeat,
  }
}

/** Adapter + zen resolution in one step — what the stage actually consumes. */
function resolvedChallenge(items: MelodyItem[]): {
  targets: ResolvedZenTarget[]
  loopSec: number
} {
  const exercise = challengeToZenExercise({
    id: 'wk-1',
    title: 'Test Legend',
    targetItems: items,
  })
  expect(exercise).not.toBeNull()
  return {
    targets: resolveZenTargets(exercise!, exercise!.defaultRootMidi),
    loopSec: (exercise!.loopBeats * 60) / exercise!.bpm,
  }
}

/** Steady in-tune samples across a target's window (30 ms cadence). */
function sungWindow(
  target: ResolvedZenTarget,
  centsOff = 0,
  stepSec = 0.03,
): ZenPitchPoint[] {
  const points: ZenPitchPoint[] = []
  for (
    let t = target.startSec + 0.02;
    t <= target.endSec - 0.02;
    t += stepSec
  ) {
    points.push({ timeSec: t, midi: target.startMidi + centsOff / 100 })
  }
  return points
}

describe('challengeToZenExercise', () => {
  it('lays the melody out after the lead-in, preserving relative timing', () => {
    const exercise = challengeToZenExercise({
      id: 'wk-1',
      title: 'Test Legend',
      targetItems: [melodyItem(67, 0), melodyItem(69, 1), melodyItem(71, 2.5)],
    })
    expect(exercise).not.toBeNull()
    expect(exercise!.targets.map((t) => t.startBeat)).toEqual([
      CHALLENGE_LEAD_IN_BEATS,
      CHALLENGE_LEAD_IN_BEATS + 1,
      CHALLENGE_LEAD_IN_BEATS + 2.5,
    ])
    expect(exercise!.loopBeats).toBe(
      CHALLENGE_LEAD_IN_BEATS + 3.5 + CHALLENGE_TAIL_BEATS,
    )
    expect(exercise!.defaultTargetVisibility).toBe('on')
    expect(exercise!.defaultProgressCue).toBe('playhead')
  })

  it('normalises a melody that does not start at beat zero', () => {
    const exercise = challengeToZenExercise({
      id: 'wk-1',
      title: 'Test Legend',
      targetItems: [melodyItem(60, 4), melodyItem(62, 5)],
    })
    expect(exercise!.targets[0]!.startBeat).toBe(CHALLENGE_LEAD_IN_BEATS)
    expect(exercise!.targets[1]!.startBeat).toBe(CHALLENGE_LEAD_IN_BEATS + 1)
  })

  it('resolves through resolveZenTargets back to the melody pitches', () => {
    const { targets } = resolvedChallenge([
      melodyItem(67, 0),
      melodyItem(64, 1),
      melodyItem(72, 2),
    ])
    expect(targets.map((t) => t.startMidi)).toEqual([67, 64, 72])
    expect(targets.map((t) => t.endMidi)).toEqual([67, 64, 72])
    expect(targets.map((t) => t.cue)).toEqual(['G4', 'E4', 'C5'])
  })

  it('sorts out-of-order items and rejects empty melodies', () => {
    const shuffled = challengeToZenExercise({
      id: 'wk-1',
      title: 'Test Legend',
      targetItems: [melodyItem(71, 2), melodyItem(67, 0), melodyItem(69, 1)],
    })
    expect(shuffled!.targets.map((t) => t.semitone)).toEqual([0, 2, 4])
    expect(
      challengeToZenExercise({ id: 'wk-1', title: 'x', targetItems: [] }),
    ).toBeNull()
  })
})

describe('challenge run scoring (sight-singing parity)', () => {
  it('scores a fully sung, in-tune run at 100', () => {
    const { targets, loopSec } = resolvedChallenge([
      melodyItem(60, 0),
      melodyItem(64, 1),
      melodyItem(67, 2),
    ])
    const points = targets.flatMap((target) => sungWindow(target))
    const notes = scoreChallengeNotes(points, targets)
    expect(notes.every((n) => n.sung && n.matched)).toBe(true)
    const summary = summarizeChallengeRun(points, targets, loopSec)
    expect(summary.score).toBe(100)
    expect(summary.avgAccuracy).toBe(100)
    expect(summary.notesScored).toBe(3)
    expect(summary.clearedCount).toBe(3)
  })

  it('counts unsung notes as zero — a full pass singing half scores half', () => {
    const { targets, loopSec } = resolvedChallenge([
      melodyItem(60, 0),
      melodyItem(64, 1),
    ])
    const firstOnly = sungWindow(targets[0]!)
    const notes = scoreChallengeNotes(firstOnly, targets)
    expect(notes[0]!.score).toBe(100)
    expect(notes[1]!.sung).toBe(false)
    expect(notes[1]!.score).toBe(0)
    const summary = summarizeChallengeRun(firstOnly, targets, loopSec)
    expect(summary.score).toBe(50)
    expect(summary.clearedCount).toBe(1)
  })

  it('spans the whole sequence for an ended-early run (no cherry-picking)', () => {
    const { targets } = resolvedChallenge([
      melodyItem(60, 0),
      melodyItem(64, 1),
      melodyItem(67, 2),
      melodyItem(64, 3),
    ])
    // Nail the first note, then end the run just after its window: the
    // drill's fix — score spans all four notes, avgAccuracy stays the
    // quality of what was sung.
    const firstOnly = sungWindow(targets[0]!)
    const endedAt = targets[0]!.endSec + 0.1
    const summary = summarizeChallengeRun(firstOnly, targets, endedAt)
    expect(summary.notesAttempted).toBe(4)
    expect(summary.notesScored).toBe(1)
    expect(summary.score).toBe(25)
    expect(summary.avgAccuracy).toBe(100)
    expect(summary.bestNote).toBe(100)
  })

  it('scores a silent run at zero', () => {
    const { targets, loopSec } = resolvedChallenge([
      melodyItem(60, 0),
      melodyItem(64, 1),
    ])
    const full = summarizeChallengeRun([], targets, loopSec)
    expect(full.score).toBe(0)
    expect(full.avgAccuracy).toBe(0)
    expect(full.clearedCount).toBe(0)
    const neverStarted = summarizeChallengeRun([], targets, 0)
    expect(neverStarted.score).toBe(0)
    expect(neverStarted.notesScored).toBe(0)
  })

  it('applies the matched floor to a wobbly but held note', () => {
    const { targets } = resolvedChallenge([melodyItem(60, 0)])
    // 50 cents off throughout: raw = 100 - 50 * 1.5 = 25, but held within
    // the 60-cent tolerance long enough to earn the drill's floor of 70.
    const notes = scoreChallengeNotes(sungWindow(targets[0]!, 50), targets)
    expect(notes[0]!.matched).toBe(true)
    expect(notes[0]!.score).toBe(70)
  })

  it('gives an out-of-tolerance drone no matched floor and a low score', () => {
    const { targets } = resolvedChallenge([melodyItem(60, 0)])
    const notes = scoreChallengeNotes(sungWindow(targets[0]!, 80), targets)
    expect(notes[0]!.sung).toBe(true)
    expect(notes[0]!.matched).toBe(false)
    expect(notes[0]!.score).toBe(0)
    const inTune = scoreChallengeNotes(sungWindow(targets[0]!, 5), targets)
    expect(inTune[0]!.score).toBeGreaterThan(notes[0]!.score)
  })
})

describe('challengeTargetHighlights', () => {
  it('keeps upcoming notes plain, glows the active note, shines cleared ones', () => {
    const { targets } = resolvedChallenge([
      melodyItem(60, 0),
      melodyItem(64, 1),
      melodyItem(67, 2),
    ])
    const first = targets[0]!
    const second = targets[1]!
    const points = [
      ...sungWindow(first),
      { timeSec: second.startSec + 0.1, midi: second.startMidi },
    ]
    const midSecond = second.startSec + 0.12
    const highlights = challengeTargetHighlights(points, targets, midSecond)

    const cleared = highlights.get(first.id)!
    expect(cleared.cleared).toBe(true)
    expect(cleared.glow).toBeGreaterThan(0.5)

    const active = highlights.get(second.id)!
    expect(active.cleared).toBe(false)
    expect(active.glow).toBeGreaterThan(0.8)

    const upcoming = highlights.get(targets[2]!.id)!
    expect(upcoming).toEqual({ glow: 0, cleared: false, missed: false })
  })

  it('marks a passed, unsung note as missed with no glow', () => {
    const { targets } = resolvedChallenge([
      melodyItem(60, 0),
      melodyItem(64, 1),
    ])
    const afterFirst = targets[0]!.endSec + 0.2
    const highlights = challengeTargetHighlights([], targets, afterFirst)
    expect(highlights.get(targets[0]!.id)).toMatchObject({
      glow: 0,
      cleared: false,
      missed: true,
    })
  })
})
