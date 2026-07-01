import { describe, expect, it } from 'vitest'
import type { BallPhysicsConfig, NoteBounds, } from '@/features/playback/yousician-ball-physics'
import { createBallPhysics, getBallPhysics, } from '@/features/playback/yousician-ball-physics'

describe('getBallPhysics', () => {
  const notes: NoteBounds[] = [
    { startBeat: 0, endBeat: 2, midi: 60, duration: 2, freq: 261.6 },
    { startBeat: 2, endBeat: 4, midi: 64, duration: 2, freq: 329.6 },
  ]
  const config: BallPhysicsConfig = {
    notes,
    rowHeight: 20,
    radius: 8,
    padding: { top: 5, bottom: 5, left: 0, right: 0 },
    bpm: 120,
  }

  it('eventually completes a jump instead of freezing mid-arc forever', () => {
    // Previously `progress` was a local variable reset to 0 on every call,
    // so `Math.min(1, progress + 0.1)` always evaluated to exactly 0.1 and
    // `progress >= 1` could never become true — the ball would visually
    // freeze partway through its arc and never land on the next note.
    let state = createBallPhysics({ speed: 0.5 })
    let landedNote = null
    for (let frame = 0; frame < 50 && !landedNote; frame++) {
      const result = getBallPhysics(state, config)
      state = {
        ...state,
        x: result.x,
        y: result.y,
        lastEndBeat: result.note ? result.note.endBeat : state.lastEndBeat,
        lastNote: result.note ?? state.lastNote,
        progress: result.progress,
      }
      landedNote = result.note
    }

    expect(landedNote).not.toBeNull()
    expect(state.lastEndBeat).toBeGreaterThan(0)
    // After landing, progress resets so the *next* jump animates from
    // scratch instead of instantly snapping (still-1) or staying stuck.
    expect(state.progress).toBe(0)
  })

  it('resets progress while still approaching a jump target', () => {
    const state = createBallPhysics({ speed: 0.05 })
    const result = getBallPhysics(state, config)
    // Far from the jump point (remainingX > speed * 2): progress should
    // stay at 0, not silently accumulate.
    expect(result.progress).toBe(0)
  })
})
