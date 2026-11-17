// Studio note roll ruler tests — a point on the roll's ruler is the song frame its tick sounds on through the clip, a point past the clip's end included and never before the song's start, and back; a press takes the End handle's 44 px first, then the playhead's head, 24 px for a mouse and 44 for a finger, and seeks anywhere else; and the ruler seeks on a click, scrubs a drag, and moves a playing song once, when let go.
import { createRoot } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import type { RollViewport } from '@/lib/roll-geometry'
import { createNoteRollRuler, rollRulerFrame, rollRulerTarget, rollRulerX, } from './note-roll-ruler'

/** A bar across 960 px from the clip's tick 960: 4 ticks a pixel. */
const VIEW: RollViewport = {
  start: 960,
  end: 4800,
  minMidi: 48,
  maxMidi: 71,
  width: 960,
  height: 480,
}
/** At 120 bpm a tick is 25 frames; the clip starts at 1 s, its window at tick 960, so its tick 0 sounds on frame 24000. */
const CLIP = { startFrame: 48_000, sourceInFrame: 24_000 }
const SEQUENCE = { tempoBpm: 120 }

describe('rollRulerFrame', () => {
  it('is the song frame the tick under the point sounds on, through the clip', () => {
    // 240 px in is tick 1920.
    expect(rollRulerFrame(240, VIEW, CLIP, SEQUENCE)).toBe(24_000 + 1920 * 25)
    expect(rollRulerFrame(0, VIEW, CLIP, SEQUENCE)).toBe(48_000)
  })

  it('is a song time in the dimmed room past the clip’s end too, and rolls back to the point', () => {
    // The window ends at tick 3840, 720 px in; 900 px in is tick 4560.
    const frame = rollRulerFrame(900, VIEW, CLIP, SEQUENCE)

    expect(frame).toBe(24_000 + 4560 * 25)
    expect(rollRulerX(frame, VIEW, CLIP, SEQUENCE)).toBeCloseTo(900, 6)
  })

  it('never falls before the song’s start, and is whole', () => {
    // A clip whose window starts two seconds into its sequence, at the song's start.
    const early = { startFrame: 0, sourceInFrame: 96_000 }

    expect(rollRulerFrame(-200, VIEW, early, SEQUENCE)).toBe(0)
    expect(Number.isInteger(rollRulerFrame(3.3, VIEW, CLIP, SEQUENCE))).toBe(
      true,
    )
  })
})

describe('rollRulerTarget', () => {
  const marks = { endX: 720, playheadX: 300, touch: false }

  it('takes the End handle within its 44 px before anything else', () => {
    expect(rollRulerTarget(720 + 22, marks)).toBe('end')
    expect(rollRulerTarget(720 - 22, { ...marks, playheadX: 700 })).toBe('end')
    expect(rollRulerTarget(720 + 23, marks)).toBe('seek')
  })

  it('takes the playhead’s head within 12 px for a mouse and 22 for a finger', () => {
    expect(rollRulerTarget(312, marks)).toBe('playhead')
    expect(rollRulerTarget(313, marks)).toBe('seek')
    expect(rollRulerTarget(322, { ...marks, touch: true })).toBe('playhead')
    expect(rollRulerTarget(323, { ...marks, touch: true })).toBe('seek')
  })

  it('seeks anywhere with no End handle and no playhead in view', () => {
    expect(
      rollRulerTarget(720, { endX: null, playheadX: null, touch: true }),
    ).toBe('seek')
  })
})

describe('createNoteRollRuler', () => {
  function ruler(playing: boolean) {
    const seek = vi.fn()
    const made = createRoot(() =>
      createNoteRollRuler({
        playing: () => playing,
        playheadFrame: () => 100_000,
        seek,
        frameAt: (event) => event.clientX * 1000,
      }),
    )
    return { ruler: made, seek }
  }
  const pointer = (clientX: number) => ({
    pointerId: 1,
    clientX,
    pointerType: 'mouse',
    shiftKey: false,
  })

  it('seeks where a click went down, once let go', () => {
    const { ruler: made, seek } = ruler(false)

    made.press(pointer(40), 'seek')
    made.release(pointer(41))

    expect(seek).toHaveBeenCalledExactlyOnceWith(40_000)
  })

  it('scrubs from the playhead’s head with no jump, and moves a playing song once', () => {
    const { ruler: made, seek } = ruler(true)

    // Taken 4 px right of the playhead, at 104.
    made.press(pointer(104), 'playhead')
    made.move(pointer(150))
    const held = made.scrubFrame()
    made.release(pointer(150))

    expect(held).toBe(146_000)
    expect(seek).toHaveBeenCalledExactlyOnceWith(146_000)
  })
})
