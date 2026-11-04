// Studio ruler gesture tests — a click seeks, a drag past the slop draws the range, the playhead's handle scrubs, and a second finger lets go.
import { createRoot } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import type { StudioFrameRange } from '@/lib/studio/playback/loop-range'
import type { StudioRulerPointer } from './ruler-gesture'
import { createStudioRulerGesture, STUDIO_RULER_SLOP_PX, studioRulerSlop, } from './ruler-gesture'

/** One pixel of ruler is a thousand frames. */
const frameAt = (x: number) => x * 1000

function pointer(
  clientX: number,
  more: Partial<StudioRulerPointer> = {},
): StudioRulerPointer {
  return {
    pointerId: 1,
    clientX,
    pointerType: 'mouse',
    shiftKey: false,
    ...more,
  }
}

function setup(
  options: {
    playing?: boolean
    playhead?: number
    /** What a finished draw sets: the drawn range, or null when too short. */
    drawn?: StudioFrameRange | null
    locked?: boolean
  } = {},
) {
  const seek = vi.fn()
  const draw = {
    start: vi.fn(() => options.locked !== true),
    move: vi.fn(),
    end: vi.fn((commit: boolean) =>
      commit ? (options.drawn === undefined ? null : options.drawn) : null,
    ),
  }
  let playhead = options.playhead ?? 0
  const gesture = createRoot(() =>
    createStudioRulerGesture({
      frameAt: (event) => frameAt(event.clientX),
      playheadFrame: () => playhead,
      playing: () => options.playing === true,
      seek: (frame) => {
        seek(frame)
        if (options.playing !== true) playhead = frame
      },
      draw,
    }),
  )
  return { gesture, seek, draw }
}

describe('studioRulerSlop', () => {
  it('gives a finger more room than a mouse before a press becomes a drag', () => {
    expect(studioRulerSlop('mouse')).toBe(STUDIO_RULER_SLOP_PX)
    expect(studioRulerSlop('pen')).toBe(STUDIO_RULER_SLOP_PX)
    expect(studioRulerSlop('touch')).toBeGreaterThan(STUDIO_RULER_SLOP_PX)
  })
})

describe('a press on the ruler', () => {
  it('seeks where it landed once it is let go, for a stopped song and a playing one', () => {
    for (const playing of [false, true]) {
      const { gesture, seek, draw } = setup({ playing })

      gesture.press(pointer(40), false)
      expect(seek).not.toHaveBeenCalled()
      gesture.move(pointer(42))
      gesture.release(pointer(42))

      expect(seek).toHaveBeenCalledExactlyOnceWith(40_000)
      expect(draw.start).not.toHaveBeenCalled()
    }
  })

  it('draws the range from where it landed once it moves past the slop, and seeks nothing', () => {
    const range = { startFrame: 40_000, endFrame: 140_000 }
    const { gesture, seek, draw } = setup({ drawn: range })

    gesture.press(pointer(40), false)
    gesture.move(pointer(40 + STUDIO_RULER_SLOP_PX))
    gesture.move(pointer(140))
    gesture.release(pointer(140))

    expect(draw.start).toHaveBeenCalledExactlyOnceWith(40_000)
    expect(draw.move).toHaveBeenLastCalledWith(pointer(140))
    expect(draw.end).toHaveBeenCalledExactlyOnceWith(true)
    expect(seek).not.toHaveBeenCalled()
  })

  it('seeks instead when the drag was too short to make a range', () => {
    const { gesture, seek } = setup({ drawn: null })

    gesture.press(pointer(40), false)
    gesture.move(pointer(46))
    gesture.release(pointer(46))

    expect(seek).toHaveBeenCalledExactlyOnceWith(40_000)
  })

  it('keeps a finger a click until it moves past its own wider slop', () => {
    const { gesture, seek, draw } = setup()
    const touch = { pointerType: 'touch' }

    gesture.press(pointer(40, touch), false)
    gesture.move(pointer(40 + studioRulerSlop('touch') - 1, touch))
    gesture.release(pointer(40 + studioRulerSlop('touch') - 1, touch))

    expect(draw.start).not.toHaveBeenCalled()
    expect(seek).toHaveBeenCalledExactlyOnceWith(40_000)
  })

  it('draws nothing and seeks nothing for a drag while a take holds the range', () => {
    const { gesture, seek, draw } = setup({ locked: true })

    gesture.press(pointer(40), false)
    gesture.move(pointer(120))
    gesture.release(pointer(120))

    expect(draw.start).toHaveBeenCalledOnce()
    expect(draw.move).not.toHaveBeenCalled()
    expect(draw.end).not.toHaveBeenCalled()
    expect(seek).not.toHaveBeenCalled()
  })

  it('draws at once with Shift, as before, and seeks nothing for a Shift-click', () => {
    const { gesture, seek, draw } = setup({ drawn: null })

    gesture.press(pointer(40, { shiftKey: true }), false)
    expect(draw.start).toHaveBeenCalledExactlyOnceWith(40_000)
    gesture.release(pointer(40, { shiftKey: true }))

    expect(seek).not.toHaveBeenCalled()
  })

  it('lets go when a second finger lands, so a pinch neither seeks nor draws', () => {
    const { gesture, seek, draw } = setup({ drawn: null })

    gesture.press(pointer(40, { pointerType: 'touch' }), false)
    gesture.move(pointer(80, { pointerType: 'touch' }))
    gesture.press(pointer(200, { pointerId: 2, pointerType: 'touch' }), false)
    gesture.release(pointer(80, { pointerType: 'touch' }))

    expect(draw.end).toHaveBeenCalledExactlyOnceWith(false)
    expect(seek).not.toHaveBeenCalled()
    expect(gesture.active()).toBe(false)
  })
})

describe("the playhead's handle", () => {
  it('scrubs a stopped song under the pointer, with no jump where it was grabbed', () => {
    const { gesture, seek, draw } = setup({ playhead: 100_000 })

    // Grabbed 5 px right of the playhead: the song stays put.
    gesture.press(pointer(105), true)
    expect(seek).not.toHaveBeenCalled()
    expect(gesture.scrubFrame()).toBe(100_000)
    gesture.move(pointer(155))
    expect(seek).toHaveBeenLastCalledWith(150_000)
    gesture.move(pointer(205))
    expect(seek).toHaveBeenLastCalledWith(200_000)
    gesture.release(pointer(205))

    expect(seek).toHaveBeenLastCalledWith(200_000)
    expect(gesture.scrubFrame()).toBeNull()
    expect(draw.start).not.toHaveBeenCalled()
  })

  it('moves a playing song once, when the drag ends', () => {
    const { gesture, seek } = setup({ playing: true, playhead: 100_000 })

    gesture.press(pointer(100), true)
    gesture.move(pointer(150))
    gesture.move(pointer(170))
    expect(seek).not.toHaveBeenCalled()
    expect(gesture.scrubFrame()).toBe(170_000)
    gesture.release(pointer(170))

    expect(seek).toHaveBeenCalledExactlyOnceWith(170_000)
  })

  it('leaves a playing song alone when grabbed and let go in place', () => {
    const { gesture, seek } = setup({ playing: true, playhead: 100_000 })

    gesture.press(pointer(100), true)
    gesture.release(pointer(100))

    expect(seek).not.toHaveBeenCalled()
  })
})
