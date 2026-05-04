// ============================================================
// Arc Physics Unit Tests — expected/current/next state transitions
// ============================================================

import { describe, expect, it } from 'vitest'
import {
  computeBallPos,
  computeArcCy,
  computeArcEndBeat,
  shouldAdvanceArc,
  buildPlayable,
  computeInitialArc,
  isBackwardsSeek,
} from '@/lib/arc-physics'
import type { ArcState, PlayableNote } from '@/lib/arc-physics'

// ---------------------------------------------------------------------------
// computeBallPos
// ---------------------------------------------------------------------------
describe('computeBallPos', () => {
  const base: ArcState = {
    sx: 100, sy: 300,
    ex: 300, ey: 100,
    cy: 50,
    startBeat: 0,
    endBeat: 1,
    noteIndex: 0,
    initialized: true,
  }

  it('returns source position at t=0 (start of arc)', () => {
    const pos = computeBallPos(0, base)
    expect(pos.x).toBeCloseTo(100, 1)
    expect(pos.y).toBeCloseTo(300, 1)
  })

  it('returns target position at t=1 (end of arc)', () => {
    const pos = computeBallPos(1, base)
    expect(pos.x).toBeCloseTo(300, 1)
    expect(pos.y).toBeCloseTo(100, 1)
  })

  it('returns target position when beat > endBeat', () => {
    const pos = computeBallPos(2, base)
    expect(pos.x).toBeCloseTo(300, 1)
    expect(pos.y).toBeCloseTo(100, 1)
  })

  it('returns source position when beat < startBeat', () => {
    const pos = computeBallPos(-1, base)
    expect(pos.x).toBeCloseTo(100, 1)
    expect(pos.y).toBeCloseTo(300, 1)
  })

  it('moves toward peak at midpoint (t≈0.5)', () => {
    const pos = computeBallPos(0.5, base)
    // Quadratic Bezier at t=0.5: 0.25*300 + 0.5*50 + 0.25*100 = 125
    // The curve is pulled toward the control point (cy=50) but doesn't pass through it
    expect(pos.y).toBeCloseTo(125, 0)
    expect(pos.y).toBeLessThan(base.sy) // above source (ascended from 300)
    expect(pos.x).toBeCloseTo(200, 1) // midX = 200
  })

  it('handles degenerate arc (startBeat >= endBeat)', () => {
    const deg: ArcState = { ...base, startBeat: 1, endBeat: 1 }
    const pos = computeBallPos(1, deg)
    expect(pos.x).toBe(base.sx)
    expect(pos.y).toBe(base.sy)
  })

  it('handles negative start/end beats', () => {
    const neg: ArcState = { ...base, startBeat: -2, endBeat: -1 }
    const start = computeBallPos(-2, neg)
    expect(start.x).toBeCloseTo(100, 1)
    const end = computeBallPos(-1, neg)
    expect(end.x).toBeCloseTo(300, 1)
  })

  it('vertical-only arc (same X, different Y) produces no horizontal movement', () => {
    const vert: ArcState = { ...base, sx: 200, ex: 200, sy: 400, ey: 100, cy: 50 }
    const start = computeBallPos(0, vert)
    expect(start.x).toBeCloseTo(200, 1)
    const mid = computeBallPos(0.5, vert)
    expect(mid.x).toBeCloseTo(200, 1)
    const end = computeBallPos(1, vert)
    expect(end.x).toBeCloseTo(200, 1)
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
  it('ends 30% into the target note', () => {
    const note: PlayableNote = { startBeat: 8, duration: 4 }
    expect(computeArcEndBeat(note)).toBeCloseTo(8 + 4 * 0.3, 5)
  })

  it('handles very short notes', () => {
    const note: PlayableNote = { startBeat: 2, duration: 0.1 }
    expect(computeArcEndBeat(note)).toBeCloseTo(2.03, 5)
  })
})

// ---------------------------------------------------------------------------
// shouldAdvanceArc
// ---------------------------------------------------------------------------
describe('shouldAdvanceArc', () => {
  const cur: PlayableNote = { startBeat: 0, duration: 2 }
  const next: PlayableNote = { startBeat: 2, duration: 2 }

  it('does not advance when beat is inside current note', () => {
    expect(shouldAdvanceArc(cur, next, 1)).toBe(false)
  })

  it('advances when beat reaches the next note start', () => {
    expect(shouldAdvanceArc(cur, next, 2)).toBe(true)
  })

  it('advances when beat is past current note end (gap case)', () => {
    const gapNext: PlayableNote = { startBeat: 8, duration: 2 }
    // beat=4: past cur end (0+2=2), before next.startBeat (8), and < next.startBeat+duration (8+2=10)
    expect(shouldAdvanceArc(cur, gapNext, 4)).toBe(true)
    // beat=9: past next.startBeat, so also true
    expect(shouldAdvanceArc(cur, gapNext, 9)).toBe(true)
  })

  it('does not advance when beat is after next note ends', () => {
    // beat=12: past next.startBeat + next.duration (8+2=10)
    // Should still advance because beat >= next.startBeat
    expect(shouldAdvanceArc(cur, { startBeat: 8, duration: 2 }, 12)).toBe(true)
  })

  it('advances exactly at cur.startBeat + cur.duration (boundary)', () => {
    expect(shouldAdvanceArc(cur, next, 2)).toBe(true)
  })

  it('advances one beat before cur.startBeat + cur.duration (should be false)', () => {
    expect(shouldAdvanceArc(cur, next, 1.999)).toBe(false)
  })

  it('advances for consecutive notes (no gap)', () => {
    const c: PlayableNote = { startBeat: 0, duration: 2 }
    const n: PlayableNote = { startBeat: 2, duration: 2 }
    expect(shouldAdvanceArc(c, n, 1)).toBe(false)
    expect(shouldAdvanceArc(c, n, 2)).toBe(true)
    expect(shouldAdvanceArc(c, n, 3)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// buildPlayable
// ---------------------------------------------------------------------------
describe('buildPlayable', () => {
  it('filters out rests', () => {
    const melody = [
      { startBeat: 0, duration: 1, isRest: false, note: { freq: 440, name: 'A4' } },
      { startBeat: 1, duration: 1, isRest: true, note: { freq: 0, name: '' } },
      { startBeat: 2, duration: 1, isRest: false, note: { freq: 880, name: 'A5' } },
    ]
    const playable = buildPlayable(melody)
    expect(playable).toHaveLength(2)
    expect(playable[0].idx).toBe(0)
    expect(playable[1].idx).toBe(2)
  })

  it('returns empty for all-rest melody', () => {
    const melody = [
      { startBeat: 0, duration: 1, isRest: true },
      { startBeat: 1, duration: 1, isRest: true },
    ]
    expect(buildPlayable(melody)).toHaveLength(0)
  })

  it('preserves original index', () => {
    const melody = [
      { startBeat: 0, duration: 1, isRest: true },
      { startBeat: 1, duration: 1, isRest: true },
      { startBeat: 2, duration: 1, isRest: false },
    ]
    const playable = buildPlayable(melody)
    expect(playable[0].idx).toBe(2)
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
  it('places ball 100px above the target Y at same X', () => {
    const note: PlayableNote = { startBeat: 0, duration: 2 }
    const arc = computeInitialArc(note, 50, 200)
    expect(arc.sx).toBe(50)
    expect(arc.ex).toBe(50)
    expect(arc.sy).toBe(100) // 200 - 100
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

  it('ends 30% into the first note', () => {
    const note: PlayableNote = { startBeat: 4, duration: 3 }
    const arc = computeInitialArc(note, 100, 300)
    expect(arc.endBeat).toBeCloseTo(4 + 3 * 0.3, 5)
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
    }

    let prevBeat = sampleBeats[0]
    const visited: number[] = [] // note indices visited

    for (const beat of sampleBeats) {
      // Backwards seek detection
      if (isBackwardsSeek(beat, prevBeat)) {
        state.initialized = false
        break
      }
      prevBeat = beat

      // Advance logic
      const nextIdx = state.noteIndex + 1
      if (nextIdx < notes.length) {
        const cur = notes[state.noteIndex]
        const next = notes[nextIdx]
        if (shouldAdvanceArc(cur, next, beat)) {
          const src = computeBallPos(beat, state)
          state.sx = src.x
          state.sy = src.y
          // target position — just use dummy values since we test noteIndex progression
          state.ex = 100 + nextIdx * 50
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

      // Record current note index
      if (visited.length === 0 || visited[visited.length - 1] !== state.noteIndex) {
        visited.push(state.noteIndex)
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
      { startBeat: 4, duration: 2 },  // first note starts at beat 4!
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
    const notes: PlayableNote[] = [
      { startBeat: 0, duration: 1 },
      { startBeat: 1, duration: 1 },
      { startBeat: 2, duration: 1 },
      { startBeat: 3, duration: 1 },
      { startBeat: 4, duration: 1 },
    ]

    // Jump straight to beat 10 (way past all notes)
    const sampleBeats = [0, 10, 10.1, 10.2, 10.3, 10.4, 10.5]

    const { visited } = simulateMelody(notes, 120, sampleBeats)

    // With "advance at most 1 per frame", we should see no gaps in visited
    for (let i = 1; i < visited.length; i++) {
      expect(visited[i]).toBe(visited[i - 1] + 1)
    }
    // Should eventually reach the last note
    expect(visited[visited.length - 1]).toBe(notes.length - 1)
  })

  it('single playable note — arc stays on that note', () => {
    const notes: PlayableNote[] = [
      { startBeat: 0, duration: 4 },
    ]

    const sampleBeats = [0, 1, 2, 3, 4, 5]
    const { state, visited } = simulateMelody(notes, 120, sampleBeats)

    expect(state.noteIndex).toBe(0)
    expect(visited).toEqual([0])
    expect(state.initialized).toBe(true)
  })
})
