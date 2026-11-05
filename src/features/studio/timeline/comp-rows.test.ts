// Studio comp rows tests — passes stand newest first, swipes snap to the song's grid inside the clip, keys move whole cells, a phone's cells are bars.
import { describe, expect, it } from 'vitest'
import type { StudioClip } from '@/lib/studio/model/types'
import { studioCompBars, studioCompCell, studioCompLit, studioCompRows, studioCompSnap, studioCompStartSpan, studioCompStep, studioCompSwipe, } from './comp-rows'

/** Three 1000-frame passes from 200; the clip plays the newest (2200 to 3200) from frame 1000 of the song. */
const CLIP: StudioClip = {
  id: 'take',
  trackId: 'lane',
  assetId: 'take-audio',
  startFrame: 1000,
  sourceInFrame: 2200,
  sourceOutFrame: 3200,
  gainDb: 0,
  fades: { curve: 'linear-amplitude' },
  passes: { firstFrame: 200, frames: 1000, count: 3 },
}

const COMPED: StudioClip = {
  ...CLIP,
  comp: [
    { fromSourceFrame: 2200, toSourceFrame: 2400, pass: 2 },
    { fromSourceFrame: 2400, toSourceFrame: 2700, pass: 0 },
    { fromSourceFrame: 2700, toSourceFrame: 3200, pass: 2 },
  ],
}

describe('comp rows', () => {
  it('stands the passes newest on top', () => {
    expect(studioCompRows(CLIP)).toEqual([
      { pass: 2, number: 3 },
      { pass: 1, number: 2 },
      { pass: 0, number: 1 },
    ])
    expect(studioCompRows({ ...CLIP, passes: undefined })).toEqual([])
  })

  it('lights where each pass plays: its stretches, or the whole clip for the pass played whole', () => {
    expect(studioCompLit(COMPED, 2)).toEqual([
      { from: 2200, to: 2400 },
      { from: 2700, to: 3200 },
    ])
    expect(studioCompLit(COMPED, 0)).toEqual([{ from: 2400, to: 2700 }])
    expect(studioCompLit(COMPED, 1)).toEqual([])
    expect(studioCompLit(CLIP, 2)).toEqual([{ from: 2200, to: 3200 }])
  })

  it("snaps a swipe's end to the nearest grid line of the song, inside the clip", () => {
    // Song frame 1130 lies nearest the line at 1250.
    expect(studioCompSnap(CLIP, 2330, 250)).toBe(2450)
    // Nearest the line at 1000, the clip's own start.
    expect(studioCompSnap(CLIP, 2310, 250)).toBe(2200)
    // A line before the clip holds at its start; with no grid a frame stays put.
    expect(studioCompSnap(CLIP, 2210, 3000)).toBe(2200)
    expect(studioCompSnap(CLIP, 2333, null)).toBe(2333)
    expect(studioCompSnap(CLIP, 9000, null)).toBe(3200)
  })

  it('plays a swipe either way along a pass, and nothing for a swipe that covers no frame', () => {
    expect(studioCompSwipe(CLIP, 0, 2700, 2400)).toEqual({
      type: 'comp-pass',
      clipId: 'take',
      fromSourceFrame: 2400,
      toSourceFrame: 2700,
      pass: 0,
    })
    expect(studioCompSwipe(CLIP, 0, 2500, 2500)).toBeNull()
    expect(studioCompSwipe(CLIP, 1, 100, 9000)).toMatchObject({
      fromSourceFrame: 2200,
      toSourceFrame: 3200,
    })
  })

  it('reads the grid cell under a frame, a frame on a line starting the next', () => {
    expect(studioCompCell(CLIP, 2449, 250)).toEqual({ from: 2200, to: 2450 })
    expect(studioCompCell(CLIP, 2450, 250)).toEqual({ from: 2450, to: 2700 })
    // A fractional grid draws its lines rounded, and the cells meet them.
    expect(studioCompCell(CLIP, 2700, 333.5)).toEqual({ from: 2534, to: 2868 })
  })

  it('starts a keyboard selection on the cell under the playhead, else the first', () => {
    expect(studioCompStartSpan(CLIP, 1600, 250)).toEqual({
      from: 2700,
      to: 2950,
    })
    expect(studioCompStartSpan(CLIP, 0, 250)).toEqual({ from: 2200, to: 2450 })
  })

  it('moves a selection a cell at a time and sizes it with whole cells, on the clip', () => {
    const first = { from: 2200, to: 2450 }

    const right = studioCompStep(CLIP, first, 250, 1, false)
    const wider = studioCompStep(CLIP, right, 250, 1, true)
    const narrower = studioCompStep(CLIP, wider, 250, -1, true)
    const smallest = studioCompStep(CLIP, narrower, 250, -1, true)
    const last = studioCompStep(CLIP, { from: 2950, to: 3200 }, 250, 1, false)

    expect(right).toEqual({ from: 2450, to: 2700 })
    expect(wider).toEqual({ from: 2450, to: 2950 })
    expect(narrower).toEqual(right)
    expect(smallest).toEqual(right)
    expect(last).toEqual({ from: 2950, to: 3200 })
    expect(studioCompStep(CLIP, first, 250, -1, false)).toEqual(first)
  })

  it("lays a phone's cells on the song's bars, each with the pass playing it", () => {
    // 120 bpm: a bar is 96000 frames. The clip runs 90000 to 210000 on the song.
    const long: StudioClip = {
      ...CLIP,
      startFrame: 90_000,
      sourceInFrame: 300_000,
      sourceOutFrame: 420_000,
      passes: { firstFrame: 0, frames: 150_000, count: 3 },
      comp: [
        { fromSourceFrame: 300_000, toSourceFrame: 310_000, pass: 2 },
        { fromSourceFrame: 310_000, toSourceFrame: 420_000, pass: 0 },
      ],
    }

    expect(studioCompBars(long, 120)).toEqual([
      { bar: 1, from: 300_000, to: 306_000, pass: 2 },
      { bar: 2, from: 306_000, to: 402_000, pass: 0 },
      { bar: 3, from: 402_000, to: 420_000, pass: 0 },
    ])
  })
})
