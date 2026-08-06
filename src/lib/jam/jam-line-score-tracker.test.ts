import { describe, expect, it } from 'vitest'
import { advanceJamLineScoreTracker, EMPTY_JAM_LINE_SCORE_TRACKER, } from './jam-line-score-tracker'
import type { LyricsLineTiming } from './types'

const lines: LyricsLineTiming[] = [
  { text: 'one', startSec: 0, endSec: 2 },
  { text: 'two', startSec: 2, endSec: 4 },
  { text: 'three', startSec: 4, endSec: 6 },
]

function input(
  positionSec: number,
  over: Partial<Parameters<typeof advanceJamLineScoreTracker>[1]> = {},
) {
  return {
    songId: 'song',
    lines,
    positionSec,
    nowMs: positionSec * 1000,
    isPlaying: true,
    isPaused: false,
    navigation: { token: 0, toSec: 0 },
    ...over,
  }
}

describe('advanceJamLineScoreTracker', () => {
  it('completes a line only when active playback crosses its end', () => {
    const opened = advanceJamLineScoreTracker(
      EMPTY_JAM_LINE_SCORE_TRACKER,
      input(0),
    )
    const crossed = advanceJamLineScoreTracker(opened.state, input(2.1))

    expect(crossed.completedLine?.index).toBe(0)
    expect(crossed.state.openLine?.index).toBe(1)
  })

  it('does not complete a line when a lyric click seeks forward', () => {
    const opened = advanceJamLineScoreTracker(
      EMPTY_JAM_LINE_SCORE_TRACKER,
      input(0),
    )
    const seeked = advanceJamLineScoreTracker(
      opened.state,
      input(4, { navigation: { token: 1, toSec: 4 } }),
    )

    expect(seeked.completedLine).toBeNull()
    expect(seeked.state.openLine?.index).toBe(2)
  })

  it('does not complete a line when the seek token arrives before the clock', () => {
    const opened = advanceJamLineScoreTracker(
      EMPTY_JAM_LINE_SCORE_TRACKER,
      input(0),
    )
    const requested = advanceJamLineScoreTracker(
      opened.state,
      input(0, { navigation: { token: 2, toSec: 4 } }),
    )
    const arrived = advanceJamLineScoreTracker(
      requested.state,
      input(4, { navigation: { token: 2, toSec: 4 } }),
    )

    expect(requested.completedLine).toBeNull()
    expect(arrived.completedLine).toBeNull()
    expect(arrived.state.openLine?.index).toBe(2)
  })

  it('rewinds on Stop without turning the interrupted line into a miss', () => {
    const opened = advanceJamLineScoreTracker(
      EMPTY_JAM_LINE_SCORE_TRACKER,
      input(4),
    )
    const stopped = advanceJamLineScoreTracker(
      opened.state,
      input(0, {
        isPlaying: false,
        navigation: { token: 3, toSec: 0 },
      }),
    )

    expect(stopped.completedLine).toBeNull()
    expect(stopped.state.openLine?.index).toBe(0)
  })

  it('does not complete a line while paused even if position changes', () => {
    const opened = advanceJamLineScoreTracker(
      EMPTY_JAM_LINE_SCORE_TRACKER,
      input(0),
    )
    const moved = advanceJamLineScoreTracker(
      opened.state,
      input(2, { isPaused: true }),
    )

    expect(moved.completedLine).toBeNull()
  })
})
