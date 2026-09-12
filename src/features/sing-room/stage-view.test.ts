// ============================================================
// What the middle of the room shows, state by state
// ============================================================

import { describe, expect, it } from 'vitest'
import { initialSingRoomContext } from './room-machine'
import { singStageView } from './stage-view'

const at = (
  state: ReturnType<typeof initialSingRoomContext>['state'],
  melodyLoaded = false,
) => singStageView(initialSingRoomContext({ state, melodyLoaded, active: true }))

describe('the stage view', () => {
  it('is the canvas for a run, a pause and the take behind its card', () => {
    expect(at('live')).toBe('run')
    expect(at('paused')).toBe('run')
    expect(at('ended')).toBe('run')
  })

  it('is the demo line only where the microphone was refused', () => {
    expect(at('denied')).toBe('demo')
    expect(at('denied', true)).toBe('demo')
  })

  it('is a silent trace at rest with nothing loaded', () => {
    expect(at('resting')).toBe('silent')
    expect(at('priming')).toBe('silent')
  })

  it('is the melody preview at rest with one loaded', () => {
    // R1: the chip names a melody and the capsule says "Continue", so the
    // staff has to show the line those two are talking about.
    expect(at('resting', true)).toBe('melody-preview')
  })

  it('goes back to the silent trace when the melody is removed', () => {
    const loaded = initialSingRoomContext({
      state: 'resting',
      melodyLoaded: true,
      active: true,
    })
    expect(singStageView(loaded)).toBe('melody-preview')
    expect(singStageView({ ...loaded, melodyLoaded: false })).toBe('silent')
  })
})
