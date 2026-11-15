import { describe, expect, it } from 'vitest'
import { stagePose } from './stage-pose'

describe("Merc's pose on the drill stage", () => {
  it('stands easy on the setup screen and through the count-in', () => {
    expect(stagePose({ status: 'idle', score: null })).toBe('idle')
    expect(stagePose({ status: 'count-in', score: null })).toBe('idle')
  })

  it('listens for as long as the singer sings', () => {
    expect(stagePose({ status: 'active', score: null })).toBe('listen')
    // A score still on the card from the last run is not this run's.
    expect(stagePose({ status: 'active', score: 100 })).toBe('listen')
  })

  it('cheers a run graded S or A, and no other', () => {
    expect(stagePose({ status: 'complete', score: 100 })).toBe('celebrate')
    expect(stagePose({ status: 'complete', score: 95 })).toBe('celebrate')
    expect(stagePose({ status: 'complete', score: 85 })).toBe('celebrate')
    expect(stagePose({ status: 'complete', score: 84 })).toBe('idle')
    expect(stagePose({ status: 'complete', score: 0 })).toBe('idle')
  })

  it('does not cheer a run that has no score to show', () => {
    // Stopped early, an ungraded drill, a guided dose: the shell passes null.
    expect(stagePose({ status: 'complete', score: null })).toBe('idle')
  })
})
