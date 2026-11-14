// Studio velocity lane tests — a lollipop's head stands from 10 px over the lane's foot for velocity 0 to 8 px under its top for 1, 4 px right of its note's start; 127 steps span that reach; and the roll draws each stick where the engine's press looks for it.
import { describe, expect, it } from 'vitest'
import type { RollViewport } from '@/lib/roll-geometry'
import type { StudioNote } from '@/lib/studio/model/types'
import { pickLollipop } from './edit-velocity'
import { recordingRollContext } from './note-roll-context.fixture'
import type { StudioRollInput, StudioRollTheme } from './note-roll-draw'
import { drawStudioRollBase } from './note-roll-draw'
import { VELOCITY_INSET, velocityLaneX, velocityLaneY, velocityReach, velocitySteps, } from './velocity-lane'

/** A lane 82 px tall: 64 px from velocity 0 to 1. */
const LANE = 82
/** One bar across 768 px: 5 ticks a pixel. */
const VIEW: RollViewport = {
  start: 0,
  end: 3840,
  minMidi: 55,
  maxMidi: 66,
  width: 768,
  height: 300,
}

describe('the lane', () => {
  it('stands velocity 1 8 px under the top, and 0 on the foot 10 px over the bottom', () => {
    expect([velocityLaneY(1, LANE), velocityLaneY(0, LANE)]).toEqual([8, 72])
    expect(velocityReach(LANE)).toBe(64)
  })

  it("moves 127 steps over the lane's reach, so 64 px up is the whole range", () => {
    expect([
      velocitySteps(64, LANE),
      velocitySteps(-16, LANE),
      velocitySteps(1, LANE),
    ]).toEqual([127, -32, 2])
  })

  it("stands a lollipop 4 px right of its note's start", () => {
    expect(velocityLaneX(960, VIEW)).toBe(192 + VELOCITY_INSET)
  })
})

describe('the drawn lane and the pressed lane', () => {
  it('put a head where a press on it takes it', () => {
    // Arrange: the roll's base drawn with one note at 0.8 on beat 2.
    const note: StudioNote = {
      id: 7,
      pitch: 60,
      startTick: 960,
      lengthTicks: 480,
      velocity: 0.8,
    }
    const keys = 72
    const lane = { top: 26 + 300, height: LANE }
    const { context, paints } = recordingRollContext()
    const input = {
      width: keys + VIEW.width,
      height: lane.top + lane.height,
      ratio: 1,
      layout: { keysWidth: keys, rulerHeight: 26, velocityHeight: LANE },
      theme: new Proxy({}, { get: (_, key) => String(key) }) as StudioRollTheme,
      viewport: VIEW,
      window: { startTick: 0, endTick: 3840 },
      rows: { kind: 'piano' },
      meter: { beatTicks: 960, originTick: 0, beatsPerBar: 4 },
      notes: [note],
      selected: new Set<number>(),
      drafts: [],
      marquee: null,
      grips: [],
      hover: null,
      readout: null,
      playheadTick: null,
      corner: 'Notes',
    } satisfies StudioRollInput

    // Act
    drawStudioRollBase(context, input)
    const head = paints
      .flatMap((paint) => paint.shapes)
      .find((shape) => shape.kind === 'arc' && shape.width === 8)!

    // Assert: the head drawn, in the lane's own pixels, is the head pressed.
    const x = head.x + 4 - keys
    const y = head.y + 4 - lane.top
    expect(x).toBeCloseTo(velocityLaneX(960, VIEW), 9)
    expect(y).toBeCloseTo(velocityLaneY(0.8, LANE), 9)
    expect(
      pickLollipop({
        notes: [note],
        viewport: VIEW,
        height: LANE,
        selection: new Set(),
        x,
        y,
        pointerType: 'mouse',
      }),
    ).toBe(7)
  })
})
