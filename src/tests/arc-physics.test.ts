// ============================================================
// Arc Physics Unit Tests — expected/current/next state transitions
// ============================================================

import { describe, expect, it } from 'vitest'
import type { ArcState, PlayableNote } from '@/lib/arc-physics'
import { buildPlayable, computeArcCy, computeArcEndBeat, computeBallPos, computeInitialArc, isBackwardsSeek, shouldAdvanceArc, } from '@/lib/arc-physics'

// ---------------------------------------------------------------------------
// computeBallPos
// ---------------------------------------------------------------------------
describe('computeBallPos', () => {
  const base: ArcState = {
    sx: 100,
    sy: 300,
    ex: 300,
    ey: 100,
    cy: 50,
    startBeat: 0,
    endBeat: 1,
    noteIndex: 0,
    initialized: true,
    isRest: false,
  }

  it('returns source position at t=0 (start of arc)', () => {
    const pos = computeBallPos(0, base)
    expect(pos.beatX).toBeCloseTo(100, 1)
    expect(pos.y).toBeCloseTo(300, 1)
  })

  it('returns target position at t=1 (end of arc)', () => {
    const pos = computeBallPos(1, base)
    expect(pos.beatX).toBeCloseTo(300, 1)
    expect(pos.y).toBeCloseTo(100, 1)
  })

  it('returns target position when beat > endBeat', () => {
    const pos = computeBallPos(2, base)
    expect(pos.beatX).toBeCloseTo(300, 1)
    expect(pos.y).toBeCloseTo(100, 1)
  })

  it('returns source position when beat < startBeat', () => {
    const pos = computeBallPos(-1, base)
    expect(pos.beatX).toBeCloseTo(100, 1)
    expect(pos.y).toBeCloseTo(300, 1)
  })

  it('moves toward peak at midpoint (t≈0.5)', () => {
    const pos = computeBallPos(0.5, base)
    // Quadratic Bezier at t=0.5: 0.25*300 + 0.5*50 + 0.25*100 = 125
    // The curve is pulled toward the control point (cy=50) but doesn't pass through it
    expect(pos.y).toBeCloseTo(125, 0)
    expect(pos.y).toBeLessThan(base.sy) // above source (ascended from 300)
    expect(pos.beatX).toBeCloseTo(200, 1) // midX = 200
  })

  it('handles degenerate arc (startBeat >= endBeat)', () => {
    const deg: ArcState = { ...base, startBeat: 1, endBeat: 1 }
    const pos = computeBallPos(1, deg)
    expect(pos.beatX).toBe(base.sx)
    expect(pos.y).toBe(base.sy)
  })

  it('handles negative start/end beats', () => {
    const neg: ArcState = { ...base, startBeat: -2, endBeat: -1 }
    const start = computeBallPos(-2, neg)
    expect(start.beatX).toBeCloseTo(100, 1)
    const end = computeBallPos(-1, neg)
    expect(end.beatX).toBeCloseTo(300, 1)
  })

  it('vertical-only arc (same X, different Y) produces no horizontal movement', () => {
    const vert: ArcState = {
      ...base,
      sx: 200,
      ex: 200,
      sy: 400,
      ey: 100,
      cy: 50,
    }
    const start = computeBallPos(0, vert)
    expect(start.beatX).toBeCloseTo(200, 1)
    const mid = computeBallPos(0.5, vert)
    expect(mid.beatX).toBeCloseTo(200, 1)
    const end = computeBallPos(1, vert)
    expect(end.beatX).toBeCloseTo(200, 1)
  })
})

// ---------------------------------------------------------------------------
// computeArcCy
// ---------------------------------------------------------------------------
describe('computeArcCy', () => {
  it('returns a value above (less than) both source and target Y', () => {
    const cy = computeArcCy(300, 100, 120)
    expect(cy).toBeLessThan(100) // above the higher of the two
    expect(cy).toBeLessThan(300)
  })

  it('produces higher arcs at lower BPM', () => {
    const cy60 = computeArcCy(300, 100, 60)
    const cy120 = computeArcCy(300, 100, 120)
    const cy240 = computeArcCy(300, 100, 240)
    // Lower BPM = higher arc = smaller cy value (more above)
    expect(cy60).toBeLessThan(cy120)
    expect(cy120).toBeLessThan(cy240)
  })

  it('has minimum arc height of 60px at BPM 120', () => {
    // Same Y values → vert=0, so max(0, 60) = 60
    const cy = computeArcCy(200, 200, 120)
    expect(cy).toBeCloseTo(200 - 60, 0) // 60px above
  })

  it('proportional height for large vertical distances', () => {
    const cy = computeArcCy(500, 100, 120)
    // vert = 400, height = max(400*0.5, 60) * 1.0 = 200
    // cy = min(500, 100) - 200 = 100 - 200 = -100
    expect(cy).toBeCloseTo(-100, 0)
  })

  it('clamps BPM to valid range', () => {
    const cyNormal = computeArcCy(300, 100, 120)
    const cyLow = computeArcCy(300, 100, 1) // clamped to 40
    const cyHigh = computeArcCy(300, 100, 999) // clamped to 280
    expect(Number.isFinite(cyLow)).toBe(true)
    expect(Number.isFinite(cyHigh)).toBe(true)
    // Below-normal BPM = higher arc
    expect(cyLow).toBeLessThan(cyNormal)
    expect(cyHigh).toBeGreaterThan(cyNormal)
  })
})

// ---------------------------------------------------------------------------
// computeArcEndBeat
// ---------------------------------------------------------------------------
describe('computeArcEndBeat', () => {
  it('ends at the end of the target note (full duration)', () => {
    const note: PlayableNote = { startBeat: 8, duration: 4 }
    expect(computeArcEndBeat(note)).toBeCloseTo(12, 5)
  })

  it('handles very short notes', () => {
    const note: PlayableNote = { startBeat: 2, duration: 0.1 }
    expect(computeArcEndBeat(note)).toBeCloseTo(2.1, 5)
  })
})

// ---------------------------------------------------------------------------
// shouldAdvanceArc
// ---------------------------------------------------------------------------
describe('shouldAdvanceArc', () => {
  const cur: PlayableNote = { startBeat: 0, duration: 2 }
  const next: PlayableNote = { startBeat: 2, duration: 2 }

  it('does not advance when beat is well before next note', () => {
    // ARC_LOOK_AHEAD = 1, so advance zone starts at next.startBeat - 1 = 1
    expect(shouldAdvanceArc(cur, next, 0.5)).toBe(false)
  })

  it('advances 1 beat before next note start (ARC_LOOK_AHEAD)', () => {
    expect(shouldAdvanceArc(cur, next, 1)).toBe(true)
  })

  it('advances when beat reaches the next note start', () => {
    expect(shouldAdvanceArc(cur, next, 2)).toBe(true)
  })

  it('does not advance mid-gap — waits until near next note', () => {
    const gapNext: PlayableNote = { startBeat: 8, duration: 2 }
    // beat=4 is well before ARC_LOOK_AHEAD zone (starts at 7)
    expect(shouldAdvanceArc(cur, gapNext, 4)).toBe(false)
    // beat=7: at the look-ahead boundary
    expect(shouldAdvanceArc(cur, gapNext, 7)).toBe(true)
    // beat=9: past next.startBeat
    expect(shouldAdvanceArc(cur, gapNext, 9)).toBe(true)
  })

  it('advances when beat is past next note', () => {
    expect(shouldAdvanceArc(cur, { startBeat: 8, duration: 2 }, 12)).toBe(true)
  })

  it('advances for consecutive notes at look-ahead boundary', () => {
    const c: PlayableNote = { startBeat: 0, duration: 2 }
    const n: PlayableNote = { startBeat: 2, duration: 2 }
    expect(shouldAdvanceArc(c, n, 0.5)).toBe(false)
    expect(shouldAdvanceArc(c, n, 1)).toBe(true) // ARC_LOOK_AHEAD
    expect(shouldAdvanceArc(c, n, 2)).toBe(true)
    expect(shouldAdvanceArc(c, n, 3)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// buildPlayable
// ---------------------------------------------------------------------------
describe('buildPlayable', () => {
  it('includes rests in playable array', () => {
    const melody = [
      {
        startBeat: 0,
        duration: 1,
        isRest: false,
        note: { freq: 440, name: 'A4' },
      },
      { startBeat: 1, duration: 1, isRest: true, note: { freq: 0, name: '' } },
      {
        startBeat: 2,
        duration: 1,
        isRest: false,
        note: { freq: 880, name: 'A5' },
      },
    ]
    const playable = buildPlayable(melody)
    expect(playable).toHaveLength(3)
    expect(playable[0].item.startBeat).toBe(0)
    expect(playable[1].item.startBeat).toBe(1)
    expect(playable[2].item.startBeat).toBe(2)
  })

  it('returns all rests for all-rest melody', () => {
    const melody = [
      { startBeat: 0, duration: 1, isRest: true },
      { startBeat: 1, duration: 1, isRest: true },
    ]
    expect(buildPlayable(melody)).toHaveLength(2)
  })

  it('sorts by startBeat so playback follows left-to-right order', () => {
    // Melody out of chronological order — simulates inserting a note
    // between existing notes (ID order ≠ time order).
    const melody = [
      { startBeat: 4, duration: 1, isRest: false },
      { startBeat: 0, duration: 1, isRest: false },
      { startBeat: 2, duration: 1, isRest: false },
    ]
    const playable = buildPlayable(melody)
    expect(playable.map((p) => p.item.startBeat)).toEqual([0, 2, 4])
  })

  it('sorts by startBeat: note placed farther first, then note at beginning (user scenario)', () => {
    // User creates note at beat 4 (id=1), then note at beat 0 (id=2).
    // The melody array is [beat4, beat0] but playback must follow [beat0, beat4].
    const melody = [
      { startBeat: 4, duration: 1, isRest: false },
      { startBeat: 0, duration: 1, isRest: false },
    ]
    const playable = buildPlayable(melody)
    expect(playable[0].item.startBeat).toBe(0)
    expect(playable[1].item.startBeat).toBe(4)
  })

  it('items without isRest are included', () => {
    const melody = [
      { startBeat: 0, duration: 1, isRest: false },
      { startBeat: 1, duration: 1, isRest: false },
    ]
    expect(buildPlayable(melody)).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// computeInitialArc
// ---------------------------------------------------------------------------
describe('computeInitialArc', () => {
  it('arcs from above down to note end position', () => {
    const note: PlayableNote = { startBeat: 0, duration: 2 }
    const arc = computeInitialArc(note, 0, 200)
    expect(arc.sx).toBe(0) // start beat
    expect(arc.ex).toBe(2) // end beat = startBeat + duration (top-right corner)
    expect(arc.sy).toBe(100) // 200 - 100 = above target
    expect(arc.ey).toBe(200)
    expect(arc.cy).toBe(40) // 200 - 160
    expect(arc.noteIndex).toBe(0)
  })

  it('starts arc at max(0, note.startBeat - 0.5)', () => {
    const early: PlayableNote = { startBeat: 8, duration: 2 }
    const arc = computeInitialArc(early, 60, 200)
    expect(arc.startBeat).toBe(7.5) // 8 - 0.5

    const atZero: PlayableNote = { startBeat: 0.2, duration: 2 }
    const arc2 = computeInitialArc(atZero, 60, 200)
    expect(arc2.startBeat).toBe(0) // max(0, 0.2 - 0.5) = max(0, -0.3) = 0
  })

  it('ends at the first note end (full duration)', () => {
    const note: PlayableNote = { startBeat: 4, duration: 3 }
    const arc = computeInitialArc(note, 100, 300)
    expect(arc.endBeat).toBeCloseTo(7, 5) // 4 + 3
  })
})

// ---------------------------------------------------------------------------
// isBackwardsSeek
// ---------------------------------------------------------------------------
describe('isBackwardsSeek', () => {
  it('returns false when prevBeat is -1 (not yet tracked)', () => {
    expect(isBackwardsSeek(5, -1)).toBe(false)
  })

  it('returns false during normal forward playback', () => {
    expect(isBackwardsSeek(5, 4.98)).toBe(false)
    expect(isBackwardsSeek(5.1, 5)).toBe(false)
  })

  it('returns true when beat jumps back significantly', () => {
    expect(isBackwardsSeek(2, 8)).toBe(true)
  })

  it('returns false for small backward movement within threshold', () => {
    // 0.3 beat backwards movement (below 0.5 default threshold)
    expect(isBackwardsSeek(5, 5.3)).toBe(false)
  })

  it('returns true for backward movement exceeding threshold', () => {
    expect(isBackwardsSeek(5, 5.6)).toBe(true)
  })

  it('respects custom threshold', () => {
    expect(isBackwardsSeek(5, 6, 2)).toBe(false) // 1 beat back, threshold is 2
    expect(isBackwardsSeek(5, 6, 0.5)).toBe(true) // 1 beat back, threshold is 0.5
  })
})

// ---------------------------------------------------------------------------
// State machine integration tests
// ---------------------------------------------------------------------------
describe('Arc state transitions (integration)', () => {
  /**
   * Simulates the full arc state machine through a melody. Tests that
   * the ball progresses through each note in order without resetting.
   */
  const simulateMelody = (
    notes: PlayableNote[],
    bpm: number,
    /** Beat positions to sample (simulated RAF frames) */
    sampleBeats: number[],
  ) => {
    // Use computeInitialArc for first note
    const first = notes[0]
    const initial = computeInitialArc(first, 100, 200)
    const state: ArcState = {
      ...initial,
      initialized: true,
      isRest: false,
    }

    let prevBeat = sampleBeats[0]
    const visited: number[] = [] // note indices visited

    for (const beat of sampleBeats) {
      // Record current note index BEFORE advance (so we capture every note)
      if (
        visited.length === 0 ||
        visited[visited.length - 1] !== state.noteIndex
      ) {
        visited.push(state.noteIndex)
      }

      // Backwards seek detection
      if (isBackwardsSeek(beat, prevBeat)) {
        state.initialized = false
        break
      }
      prevBeat = beat

      // Advance when current arc finishes — ensures ball reaches
      // each note's top-right corner before arcing to the next.
      const nextIdx = state.noteIndex + 1
      if (nextIdx < notes.length && beat >= state.endBeat) {
        const next = notes[nextIdx]
        const src = computeBallPos(beat, state)
        state.sx = beat
        state.sy = src.y
        state.ex = next.startBeat + next.duration
        state.ey = 200
        state.cy = computeArcCy(src.y, 200, bpm)
        state.startBeat = beat
        state.endBeat = computeArcEndBeat(next)
        if (state.endBeat <= state.startBeat) {
          state.endBeat = state.startBeat + 0.5
        }
        state.noteIndex = nextIdx
      }
    }

    return { state, visited }
  }

  it('advances through consecutive notes in order without skipping', () => {
    const notes: PlayableNote[] = [
      { startBeat: 0, duration: 2 },
      { startBeat: 2, duration: 2 },
      { startBeat: 4, duration: 2 },
      { startBeat: 6, duration: 2 },
    ]

    // Simulate beats from 0 to 8, every 0.1 beat (simulating ~10fps for test speed)
    const sampleBeats: number[] = []
    for (let b = 0; b <= 8; b += 0.1) sampleBeats.push(b)

    const { visited } = simulateMelody(notes, 120, sampleBeats)

    // Should visit notes 0, 1, 2, 3 in order
    expect(visited).toEqual([0, 1, 2, 3])
  })

  it('advances through notes with rests/gaps between them', () => {
    // Simulates: note 0 ends at beat 2, then a 6-beat rest, then note 1 at beat 8
    const notes: PlayableNote[] = [
      { startBeat: 0, duration: 2 },
      { startBeat: 8, duration: 2 },
      { startBeat: 10, duration: 2 },
    ]

    const sampleBeats: number[] = []
    for (let b = 0; b <= 12; b += 0.1) sampleBeats.push(b)

    const { visited } = simulateMelody(notes, 120, sampleBeats)

    // Should visit 0, 1, 2; should NOT loop back to 0
    expect(visited[0]).toBe(0)
    expect(visited).toContain(1)
    expect(visited).toContain(2)
    // 0 should only appear once at the start
    expect(visited.filter((v) => v === 0)).toHaveLength(1)
  })

  it('resets on genuine backwards seek', () => {
    const notes: PlayableNote[] = [
      { startBeat: 0, duration: 2 },
      { startBeat: 2, duration: 2 },
    ]

    // Forward for a bit, then jump back
    const sampleBeats = [0, 0.5, 1, 1.5, 2, 2.5, 0.5] // 0.5 after 2.5 is a backwards seek

    const { state } = simulateMelody(notes, 120, sampleBeats)
    expect(state.initialized).toBe(false)
  })

  it('does NOT reset during normal forward playback (even with gaps)', () => {
    const notes: PlayableNote[] = [
      { startBeat: 4, duration: 2 }, // first note starts at beat 4!
      { startBeat: 10, duration: 2 }, // second note starts at beat 10
    ]

    const sampleBeats: number[] = []
    for (let b = 0; b <= 12; b += 0.1) sampleBeats.push(b)

    const { state, visited } = simulateMelody(notes, 120, sampleBeats)

    // Should NOT reset — state.initialized should still be true
    expect(state.initialized).toBe(true)
    // Should have advanced from 0 to 1
    expect(visited).toContain(1)
  })

  it('advances exactly 1 note per frame (never skips)', () => {
    // With beat >= endBeat advance: ball reaches note end, then advances.
    // Simulate normal forward playback (small steps) through 5 short notes.
    const notes: PlayableNote[] = [
      { startBeat: 0, duration: 0.5 },
      { startBeat: 0.5, duration: 0.5 },
      { startBeat: 1, duration: 0.5 },
      { startBeat: 1.5, duration: 0.5 },
      { startBeat: 2, duration: 0.5 },
    ]

    const sampleBeats: number[] = []
    for (let b = 0; b <= 3; b += 0.02) sampleBeats.push(b)

    const { visited } = simulateMelody(notes, 120, sampleBeats)

    // Should visit all notes in order, no gaps
    expect(visited).toEqual([0, 1, 2, 3, 4])
  })

  it('single playable note — arc stays on that note', () => {
    const notes: PlayableNote[] = [{ startBeat: 0, duration: 4 }]

    const sampleBeats = [0, 1, 2, 3, 4, 5]
    const { state, visited } = simulateMelody(notes, 120, sampleBeats)

    expect(state.noteIndex).toBe(0)
    expect(visited).toEqual([0])
    expect(state.initialized).toBe(true)
  })

  // -----------------------------------------------------------------------
  // Ball timing: ball must NOT be ahead of playhead
  // -----------------------------------------------------------------------

  it('ball is mid-flight at note startBeat (not already at corner)', () => {
    // Test that at a note's startBeat, the ball is still in the air,
    // not already at the target corner.
    const notes: PlayableNote[] = [
      { startBeat: 0, duration: 4 },
      { startBeat: 4, duration: 4 },
    ]

    // Build a simple arc for note 1 so we can sample at its startBeat
    const first = notes[0]
    const firstArc: ArcState = {
      sx: 100,
      sy: 100,
      ex: 300,
      ey: 300,
      cy: 50,
      startBeat: 0,
      endBeat: first.startBeat + first.duration, // 0 + 4 = 4
      noteIndex: 0,
      initialized: true,
      isRest: false,
    }

    // At beat 4 (note 1's startBeat): shouldAdvanceArc fires, arc starts.
    // The source position (where ball was at beat 4 on the old arc) is mid-flight.
    const ballAtStartOfNote = computeBallPos(4, firstArc)

    // Ball should be at the target corner by beat 4 (t=1)
    expect(ballAtStartOfNote.beatX).toBeCloseTo(300, 1)
    expect(ballAtStartOfNote.y).toBeCloseTo(300, 1)

    // After advancing, new arc starts at beat 4 and ends at beat 8.
    // At beat 4 (t=0), ball should be at source = old end position (in the air).
    const second: PlayableNote = { startBeat: 4, duration: 4 }
    const newArc: ArcState = {
      sx: ballAtStartOfNote.beatX,
      sy: ballAtStartOfNote.y,
      ex: 500,
      ey: 100,
      cy: computeArcCy(ballAtStartOfNote.y, 100, 120),
      startBeat: 4,
      endBeat: second.startBeat + second.duration, // 4 + 4 = 8
      noteIndex: 1,
      initialized: true,
      isRest: false,
    }

    // At beat 4 (t=0): ball at source
    const atStart = computeBallPos(4, newArc)
    expect(atStart.beatX).toBeCloseTo(300, 1)

    // At beat 5 (t=0.25): ball is mid-flight, NOT at corner
    const midFlight = computeBallPos(5, newArc)
    expect(midFlight.beatX).not.toBeCloseTo(500, 1)
    expect(midFlight.y).not.toBeCloseTo(100, 1)

    // At beat 8 (t=1): ball at corner
    const atEnd = computeBallPos(8, newArc)
    expect(atEnd.beatX).toBeCloseTo(500, 1)
    expect(atEnd.y).toBeCloseTo(100, 1)
  })

  it('ball reaches corner exactly at note endBeat, not before', () => {
    const note: PlayableNote = { startBeat: 2, duration: 3 }
    const arc: ArcState = {
      sx: 50,
      sy: 400,
      ex: 200,
      ey: 150,
      cy: computeArcCy(400, 150, 120),
      startBeat: 2,
      endBeat: note.startBeat + note.duration, // 2 + 3 = 5
      noteIndex: 0,
      initialized: true,
      isRest: false,
    }

    // 80% through the note — ball should NOT be at corner
    const beforeEnd = computeBallPos(4.8, arc)
    expect(beforeEnd.beatX).not.toBeCloseTo(200, 1)
    expect(beforeEnd.y).not.toBeCloseTo(150, 1)

    // At exact end beat — ball IS at corner
    const atEnd = computeBallPos(5, arc)
    expect(atEnd.beatX).toBeCloseTo(200, 1)
    expect(atEnd.y).toBeCloseTo(150, 1)
  })

  // -----------------------------------------------------------------------
  // Rest handling: ball follows playhead through rests in the air
  // -----------------------------------------------------------------------

  it('arc spans entire rest period without teleporting', () => {
    // Note 0: beats 0-2. Rest: beats 2-8. Note 1: beats 8-10.
    // Advance happens around beat 2. Arc should span from ~2 to 10.
    const notes: PlayableNote[] = [
      { startBeat: 0, duration: 2 },
      { startBeat: 8, duration: 2 },
    ]

    const sampleBeats: number[] = []
    for (let b = 0; b <= 10; b += 0.2) sampleBeats.push(b)

    const { visited } = simulateMelody(notes, 120, sampleBeats)

    // Must visit both notes
    expect(visited[0]).toBe(0)
    expect(visited).toContain(1)
    // Note 0 appears only once
    expect(visited.filter((v) => v === 0)).toHaveLength(1)
  })

  it('ball is in the air during a long rest (mid-flight, not at corner)', () => {
    // Simulate: note 0 (0-2), then a 6-beat rest, then note 1 (8-10)
    // When the arc to note 1 is created at ~beat 2, it ends at beat 10.
    // During the rest (e.g., beat 5), the ball should be mid-flight.
    const notes: PlayableNote[] = [
      { startBeat: 0, duration: 2 },
      { startBeat: 8, duration: 2 },
    ]

    const firstArc: ArcState = {
      sx: 100,
      sy: 200,
      ex: 200,
      ey: 300,
      cy: 50,
      startBeat: 0,
      endBeat: notes[0].startBeat + notes[0].duration, // 2
      noteIndex: 0,
      initialized: true,
      isRest: false,
    }

    // At beat 2 (end of note 0), advance fires. Ball position at beat 2:
    const ballAtAdvance = computeBallPos(2, firstArc)

    // New arc from beat 2 to beat 10 (note 1's end)
    const restArc: ArcState = {
      sx: ballAtAdvance.beatX,
      sy: ballAtAdvance.y,
      ex: 400,
      ey: 100,
      cy: computeArcCy(ballAtAdvance.y, 100, 120),
      startBeat: 2,
      endBeat: computeArcEndBeat(notes[1]), // 8 + 2 = 10
      noteIndex: 1,
      initialized: true,
      isRest: false,
    }

    // During rest (beat 5): ball is mid-flight
    const midRest = computeBallPos(5, restArc)
    const t_mid = (5 - 2) / (10 - 2) // 0.375
    expect(t_mid).toBeGreaterThan(0)
    expect(t_mid).toBeLessThan(1)
    expect(midRest.beatX).not.toBeCloseTo(400, 1)

    // At note 1's startBeat (8): ball is still mid-flight (lands at end)
    const atNote1Start = computeBallPos(8, restArc)
    const t_start = (8 - 2) / (10 - 2) // 0.75
    expect(t_start).toBeGreaterThan(0)
    expect(t_start).toBeLessThan(1)
    expect(atNote1Start.beatX).not.toBeCloseTo(400, 1)

    // At note 1's end (10): ball reaches corner
    const atNote1End = computeBallPos(10, restArc)
    expect(atNote1End.beatX).toBeCloseTo(400, 1)
    expect(atNote1End.y).toBeCloseTo(100, 1)
  })

  // -----------------------------------------------------------------------
  // 5+ notes continuous progression
  // -----------------------------------------------------------------------

  it('visits all 7 notes in order with no skips or resets', () => {
    const notes: PlayableNote[] = [
      { startBeat: 0, duration: 1 },
      { startBeat: 1, duration: 1 },
      { startBeat: 2, duration: 1 },
      { startBeat: 3, duration: 1 },
      { startBeat: 4, duration: 1 },
      { startBeat: 5, duration: 1 },
      { startBeat: 6, duration: 1 },
    ]

    const sampleBeats: number[] = []
    for (let b = 0; b <= 8; b += 0.05) sampleBeats.push(b)

    const { visited } = simulateMelody(notes, 120, sampleBeats)

    expect(visited).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('visits all 7 notes with rests between some', () => {
    const notes: PlayableNote[] = [
      { startBeat: 0, duration: 2 },
      { startBeat: 4, duration: 2 },
      { startBeat: 8, duration: 1 },
      { startBeat: 9, duration: 1 },
      { startBeat: 12, duration: 2 },
      { startBeat: 16, duration: 2 },
      { startBeat: 20, duration: 2 },
    ]

    const sampleBeats: number[] = []
    for (let b = 0; b <= 22; b += 0.1) sampleBeats.push(b)

    const { visited } = simulateMelody(notes, 120, sampleBeats)

    expect(visited).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  // -----------------------------------------------------------------------
  // Backwards seek does not misfire during rests or gaps
  // -----------------------------------------------------------------------

  it('does not reset during gap between notes (no false backwards-seek)', () => {
    const notes: PlayableNote[] = [
      { startBeat: 10, duration: 2 },
      { startBeat: 20, duration: 2 },
    ]

    // Start playing from beat 10 (initial arc starts at 9.5)
    const sampleBeats: number[] = []
    for (let b = 10; b <= 22; b += 0.05) sampleBeats.push(b)

    const { state, visited } = simulateMelody(notes, 120, sampleBeats)

    expect(state.initialized).toBe(true)
    expect(visited).toContain(1)
    // No reset back to 0
    expect(visited.filter((v) => v === 0)).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Comprehensive ball behavior tests — trajectory, continuity, gaps
// ---------------------------------------------------------------------------
describe('Ball trajectory and continuity', () => {
  /** Full state machine simulation returning positions at each sample. */
  const simulateWithPositions = (
    notes: PlayableNote[],
    bpm: number,
    sampleBeats: number[],
    noteYs: number[],
  ) => {
    const first = notes[0]
    const initial = computeInitialArc(first, Math.max(0, first.startBeat - 0.5), noteYs[0] ?? 200)
    const state: ArcState = {
      ...initial,
      initialized: true,
      isRest: false,
    }

    const positions: { beat: number; beatX: number; y: number; noteIndex: number }[] = []
    let prevBeat = sampleBeats[0]

    for (const beat of sampleBeats) {
      if (isBackwardsSeek(beat, prevBeat)) {
        state.initialized = false
        break
      }
      prevBeat = beat

      const nextIdx = state.noteIndex + 1
      if (nextIdx < notes.length && beat >= state.endBeat) {
        const next = notes[nextIdx]
        const src = computeBallPos(beat, state)
        state.sx = beat
        state.sy = src.y
        state.ex = next.startBeat + next.duration
        state.ey = noteYs[nextIdx] ?? 200
        state.cy = computeArcCy(src.y, noteYs[nextIdx] ?? 200, bpm)
        state.startBeat = beat
        state.endBeat = computeArcEndBeat(next)
        if (state.endBeat <= state.startBeat) {
          state.endBeat = state.startBeat + 0.5
        }
        state.noteIndex = nextIdx
      }

      const pos = computeBallPos(beat, state)
      positions.push({
        beat,
        beatX: pos.beatX,
        y: pos.y,
        noteIndex: state.noteIndex,
      })
    }

    return { state, positions }
  }

  it('ball X tracks beat linearly (1:1 with playhead)', () => {
    // Bezier X is linear: beatX = (1-t)*sx + t*ex, and t = (beat-start)/(end-start),
    // so beatX = beat.  Ball moves exactly with the playhead.
    const notes: PlayableNote[] = [
      { startBeat: 0, duration: 4 },
      { startBeat: 4, duration: 4 },
    ]
    const sampleBeats: number[] = []
    for (let b = 0; b <= 8; b += 0.1) sampleBeats.push(b)

    // sx must equal startBeat for beatX=beat to hold (and it does in
    // computeInitialArc: sx=startBeatX, startBeat=Math.max(0, first.startBeat-0.5)).
    const firstNote = notes[0]
    const startBeatX = Math.max(0, firstNote.startBeat - 0.5)
    const initial = computeInitialArc(firstNote, startBeatX, 300)
    const state: ArcState = { ...initial, initialized: true, isRest: false }
    const positions: { beat: number; beatX: number; y: number; noteIndex: number }[] = []
    let prevBeat = sampleBeats[0]

    for (const beat of sampleBeats) {
      if (isBackwardsSeek(beat, prevBeat)) break
      prevBeat = beat

      const nextIdx = state.noteIndex + 1
      if (nextIdx < notes.length && beat >= state.endBeat) {
        const next = notes[nextIdx]
        const src = computeBallPos(beat, state)
        state.sx = beat
        state.sy = src.y
        state.ex = next.startBeat + next.duration
        state.ey = nextIdx === 1 ? 100 : 300
        state.cy = computeArcCy(src.y, nextIdx === 1 ? 100 : 300, 120)
        state.startBeat = beat
        state.endBeat = computeArcEndBeat(next)
        if (state.endBeat <= state.startBeat) {
          state.endBeat = state.startBeat + 0.5
        }
        state.noteIndex = nextIdx
      }

      const pos = computeBallPos(beat, state)
      positions.push({ beat, beatX: pos.beatX, y: pos.y, noteIndex: state.noteIndex })
    }

    for (const p of positions) {
      if (p.noteIndex < notes.length) {
        expect(Math.abs(p.beatX - p.beat)).toBeLessThan(0.001)
      }
    }
  })

  it('ball reaches top-right corner at each arc endBeat', () => {
    // For each note, the ball's Y should equal the note's Y at the arc endBeat.
    const notes: PlayableNote[] = [
      { startBeat: 0, duration: 2 },
      { startBeat: 2, duration: 2 },
      { startBeat: 4, duration: 2 },
    ]
    const noteYs = [300, 150, 80]

    const sampleBeats: number[] = []
    for (let b = 0; b <= 6.2; b += 0.05) sampleBeats.push(b)

    const { positions } = simulateWithPositions(notes, 120, sampleBeats, noteYs)

    // At each note's endBeat, ball should be at that note's Y
    const noteEnds = [2, 4, 6]
    for (let i = 0; i < noteEnds.length; i++) {
      const atEnd = positions.find(
        (p) => Math.abs(p.beat - noteEnds[i]) < 0.001,
      )
      expect(atEnd).toBeDefined()
      expect(atEnd!.y).toBeCloseTo(noteYs[i], 1)
    }
  })

  it('ball position is continuous at arc boundaries (no jumps)', () => {
    // When advancing from one arc to the next, the ball's position
    // at the boundary beat should be the same before and after advancing.
    const notes: PlayableNote[] = [
      { startBeat: 0, duration: 2 },
      { startBeat: 2, duration: 2 },
    ]
    const noteYs = [300, 100]

    const first = notes[0]
    const initial = computeInitialArc(first, 100, noteYs[0])
    const state: ArcState = {
      ...initial,
      initialized: true,
      isRest: false,
    }

    // At beat 2 (endBeat), get position BEFORE advance
    const posBefore = computeBallPos(2, state)

    // Simulate advance
    const src = computeBallPos(2, state)
    state.sx = 2  // beat at boundary equals endBeat, so sx=startBeat=2
    state.sy = src.y
    state.ex = notes[1].startBeat + notes[1].duration
    state.ey = noteYs[1]
    state.cy = computeArcCy(src.y, noteYs[1], 120)
    state.startBeat = 2
    state.endBeat = computeArcEndBeat(notes[1])
    state.noteIndex = 1

    // At same beat (2), get position AFTER advance
    const posAfter = computeBallPos(2, state)

    // Should be the same position (t=0 of new arc = end of old arc)
    expect(posAfter.beatX).toBeCloseTo(posBefore.beatX, 1)
    expect(posAfter.y).toBeCloseTo(posBefore.y, 1)
  })

  it('ball arcs seamlessly through long gaps without waiting', () => {
    // Note 0: beats 0-1. Gap: beats 1-8. Note 1: beats 8-10.
    // Ball should start arcing to note 1 at beat 1 (right when note 0 ends),
    // NOT wait until beat 7 (old ARC_LOOK_AHEAD=1 behavior).
    const notes: PlayableNote[] = [
      { startBeat: 0, duration: 1 },
      { startBeat: 8, duration: 2 },
    ]
    const noteYs = [300, 100]

    const sampleBeats: number[] = []
    for (let b = 0; b <= 10.2; b += 0.1) sampleBeats.push(b)

    const { positions } = simulateWithPositions(notes, 120, sampleBeats, noteYs)

    // Ball should advance from note 0 to note 1 near beat 1 (end of note 0)
    // Find first position where noteIndex becomes 1
    const firstNote1 = positions.find((p) => p.noteIndex === 1)
    expect(firstNote1).toBeDefined()
    // Should advance at or very close to beat 1 (no waiting)
    expect(firstNote1!.beat).toBeLessThan(1.2)

    // During the gap (beat 3-7), ball should be mid-flight
    const midGap = positions.find(
      (p) => Math.abs(p.beat - 5) < 0.001,
    )
    expect(midGap).toBeDefined()
    expect(midGap!.noteIndex).toBe(1)
    // Ball Y should NOT be at note 0's Y (300) or note 1's Y (100)
    // It should be somewhere in between
    expect(midGap!.y).toBeLessThan(300)
    expect(midGap!.y).toBeGreaterThan(100)
  })

  it('ascending notes produce correct arc trajectory (ball goes up)', () => {
    // Ascending scale: C4 (y=400) → D4 (y=350) → E4 (y=300)
    const notes: PlayableNote[] = [
      { startBeat: 0, duration: 1 },
      { startBeat: 1, duration: 1 },
      { startBeat: 2, duration: 1 },
    ]
    // Y decreases as pitch goes up (higher freq = smaller Y on canvas)
    const noteYs = [400, 350, 300]

    const sampleBeats: number[] = []
    for (let b = 0; b <= 3.1; b += 0.05) sampleBeats.push(b)

    const { positions } = simulateWithPositions(notes, 120, sampleBeats, noteYs)

    // At each note's endBeat, ball should be at correct Y
    // Note 0 ends at beat 1
    const atNote0End = positions.find(
      (p) => Math.abs(p.beat - 1) < 0.001,
    )
    expect(atNote0End).toBeDefined()
    expect(atNote0End!.y).toBeCloseTo(400, 1)

    // Note 1 ends at beat 2
    const atNote1End = positions.find(
      (p) => Math.abs(p.beat - 2) < 0.001,
    )
    expect(atNote1End).toBeDefined()
    expect(atNote1End!.y).toBeCloseTo(350, 1)

    // Note 2 ends at beat 3
    const atNote2End = positions.find(
      (p) => Math.abs(p.beat - 3) < 0.001,
    )
    expect(atNote2End).toBeDefined()
    expect(atNote2End!.y).toBeCloseTo(300, 1)
  })

  it('descending notes produce correct arc trajectory (ball goes down)', () => {
    // Descending: high (y=100) → mid (y=250) → low (y=400)
    const notes: PlayableNote[] = [
      { startBeat: 0, duration: 1 },
      { startBeat: 1, duration: 1 },
      { startBeat: 2, duration: 1 },
    ]
    const noteYs = [100, 250, 400]

    const sampleBeats: number[] = []
    for (let b = 0; b <= 3.1; b += 0.05) sampleBeats.push(b)

    const { positions } = simulateWithPositions(notes, 120, sampleBeats, noteYs)

    const atNote0End = positions.find(
      (p) => Math.abs(p.beat - 1) < 0.001,
    )
    expect(atNote0End!.y).toBeCloseTo(100, 1)

    const atNote2End = positions.find(
      (p) => Math.abs(p.beat - 3) < 0.001,
    )
    expect(atNote2End!.y).toBeCloseTo(400, 1)
  })

  it('rest notes produce sine wave oscillation', () => {
    // Manually construct an arc with isRest=true
    const restArc: ArcState = {
      sx: 100,
      sy: 200,
      ex: 300,
      ey: 200,
      cy: 40,
      startBeat: 2,
      endBeat: 4,
      noteIndex: 1,
      initialized: true,
      isRest: true,
    }

    // At t=0.125 (beat 2.25), sin(π/2)*40 = 40 — ball should oscillate up
    const quarterRest = computeBallPos(2.25, restArc)
    expect(Math.abs(quarterRest.y - 240)).toBeLessThan(1)

    // At start and end, ball should be at source/target
    const atStart = computeBallPos(2, restArc)
    expect(atStart.y).toBeCloseTo(200, 1)

    const atEnd = computeBallPos(4, restArc)
    expect(atEnd.y).toBeCloseTo(200, 1)
  })

  it('ball arcs correctly with different BPM values', () => {
    // Two notes so computeArcCy runs at advance time. Lower BPM = bigger arc.
    const notes: PlayableNote[] = [
      { startBeat: 0, duration: 2 },
      { startBeat: 2, duration: 2 },
    ]
    const noteYs = [300, 100]
    const sampleBeats: number[] = []
    for (let b = 0; b <= 4.1; b += 0.05) sampleBeats.push(b)

    const slow = simulateWithPositions(notes, 60, sampleBeats, noteYs)
    const fast = simulateWithPositions(notes, 180, sampleBeats, noteYs)

    // After advancing (beat >= 2), the second arc uses computeArcCy which
    // depends on BPM. Lower BPM → larger height → lower cy → lower mid-Y.
    const slowMid = slow.positions.find(
      (p) => Math.abs(p.beat - 3) < 0.01,
    )
    const fastMid = fast.positions.find(
      (p) => Math.abs(p.beat - 3) < 0.01,
    )

    expect(slowMid).toBeDefined()
    expect(fastMid).toBeDefined()
    expect(slowMid!.y).toBeLessThan(fastMid!.y)
  })

  it('single note melody — ball arcs to its top-right only', () => {
    const notes: PlayableNote[] = [{ startBeat: 2, duration: 3 }]
    const noteYs = [250]

    const sampleBeats: number[] = []
    for (let b = 0; b <= 6; b += 0.1) sampleBeats.push(b)

    const { positions } = simulateWithPositions(notes, 120, sampleBeats, noteYs)

    // Ball reaches note Y at endBeat=5
    const atEnd = positions.find((p) => Math.abs(p.beat - 5) < 0.001)
    expect(atEnd).toBeDefined()
    expect(atEnd!.y).toBeCloseTo(250, 1)

    // Ball should start above the note
    const atStart = positions.find((p) => Math.abs(p.beat - 1.5) < 0.001)
    expect(atStart).toBeDefined()
    // initial sy = 250 - 100 = 150, which is above (smaller Y)
    expect(atStart!.y).toBeLessThan(250)
  })

  // -------------------------------------------------------------------------
  // High-BPM & edge-case ball behavior (inside the same describe to access
  // simulateWithPositions)
  // -------------------------------------------------------------------------

  it('ball X never regresses behind beat at high BPM (16th notes @ 180 BPM)', () => {
    // 16th notes at 180 BPM: each note is 0.25 beats. If the ball's X
    // falls behind the playhead, it would appear to "teleport back."
    const notes: PlayableNote[] = []
    for (let i = 0; i < 32; i++) {
      notes.push({ startBeat: i * 0.25, duration: 0.25 })
    }
    const noteYs = notes.map(() => 200)

    const sampleBeats: number[] = []
    for (let b = 0; b <= 8; b += 0.02) sampleBeats.push(b)

    const { positions } = simulateWithPositions(notes, 180, sampleBeats, noteYs)

    for (const p of positions) {
      // beatX must never be less than beat (no regression / teleport-back)
      expect(p.beatX).toBeGreaterThanOrEqual(p.beat - 0.01)
      expect(Math.abs(p.beatX - p.beat)).toBeLessThan(0.01)
    }
  })

  it('noteIndex advances monotonically at high BPM (max 1 per sample)', () => {
    const notes: PlayableNote[] = []
    for (let i = 0; i < 20; i++) {
      notes.push({ startBeat: i * 0.5, duration: 0.5 })
    }
    const noteYs = notes.map(() => 200)

    const sampleBeats: number[] = []
    for (let b = 0; b <= 10; b += 0.05) sampleBeats.push(b)

    const { positions } = simulateWithPositions(notes, 200, sampleBeats, noteYs)

    let lastIdx = -1
    for (const p of positions) {
      expect(p.noteIndex).toBeGreaterThanOrEqual(lastIdx)
      expect(p.noteIndex - lastIdx).toBeLessThanOrEqual(1)
      lastIdx = p.noteIndex
    }
  })

  it('ball Y is continuous at arc boundaries (no vertical teleport)', () => {
    const notes: PlayableNote[] = [
      { startBeat: 0, duration: 1 },
      { startBeat: 1, duration: 1 },
      { startBeat: 2, duration: 1 },
    ]
    const noteYs = [300, 150, 80]

    const sampleBeats: number[] = []
    for (let b = 0; b <= 3; b += 0.02) sampleBeats.push(b)

    const { positions } = simulateWithPositions(notes, 120, sampleBeats, noteYs)

    for (let i = 1; i < positions.length; i++) {
      if (positions[i].noteIndex !== positions[i - 1].noteIndex) {
        // bezier Y approaches ey, so t→1 diff is normal up to ~10px
        const yDiff = Math.abs(positions[i].y - positions[i - 1].y)
        expect(yDiff).toBeLessThan(15)
      }
    }
  })

  it('beat jump (seek) — ball X catches up instantly, no backward teleport', () => {
    const notes: PlayableNote[] = [
      { startBeat: 0, duration: 2 },
      { startBeat: 2, duration: 2 },
      { startBeat: 4, duration: 2 },
      { startBeat: 6, duration: 2 },
    ]
    const noteYs = [300, 200, 100, 50]

    // Normal playback up to beat 0.5, then a big jump to beat 5
    const first = notes[0]
    const initial = computeInitialArc(first, 0, noteYs[0])
    const state: ArcState = { ...initial, initialized: true, isRest: false }

    const sampleA = [0, 0.1, 0.2, 0.3, 0.4, 0.5]
    for (const beat of sampleA) {
      const nextIdx = state.noteIndex + 1
      if (nextIdx < notes.length && beat >= state.endBeat) {
        const next = notes[nextIdx]
        const src = computeBallPos(beat, state)
        state.sx = beat
        state.sy = src.y
        state.ex = next.startBeat + next.duration
        state.ey = noteYs[nextIdx]
        state.cy = computeArcCy(src.y, noteYs[nextIdx], 120)
        state.startBeat = beat
        state.endBeat = computeArcEndBeat(next)
        if (state.endBeat <= state.startBeat) {
          state.endBeat = state.startBeat + 0.5
        }
        state.noteIndex = nextIdx
      }
    }

    // Simulate backwards seek reset at beat 5
    state.initialized = false
    let startIdx = 0
    for (let i = notes.length - 1; i >= 0; i--) {
      if (5 >= notes[i].startBeat) { startIdx = i; break }
    }
    const reinit = computeInitialArc(
      notes[startIdx],
      Math.max(0, notes[startIdx].startBeat - 0.5),
      noteYs[startIdx],
    )
    Object.assign(state, reinit, { initialized: true, isRest: false, noteIndex: startIdx })

    // After seek, ball X must equal beat (no backward teleport)
    const posAfterSeek = computeBallPos(5, state)
    expect(Math.abs(posAfterSeek.beatX - 5)).toBeLessThan(0.01)
  })
})
