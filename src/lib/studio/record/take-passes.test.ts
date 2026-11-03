// Studio take pass tests — a punch keeps exactly its range, and a loop take's whole passes are windows of one capture that meet frame to frame.
import { describe, expect, it } from 'vitest'
import { STUDIO_MAX_CLIP_PASSES } from '../model/clip-passes'
import { STUDIO_TAKE_MAX_SECONDS } from './studio-recorder'
import { STUDIO_PUNCH_FADE_FRAMES, studioLoopCut, studioMinPartialPass, studioPunchCut, studioTakeClip, } from './take-passes'
import { planStudioTake, STUDIO_LAST_PASS_SPARE_FRAMES, studioPunchPreroll, } from './take-plan'

const RANGE = { startFrame: 96000, endFrame: 192000 }

describe('Studio punch cut', () => {
  it('keeps the take frames heard inside the range, and nothing either side', () => {
    // The first sample lands on 40000: the range starts 56000 frames in.
    const cut = studioPunchCut(40000, RANGE, 200000)
    expect(cut).toEqual({
      startFrame: 96000,
      sourceInFrame: 56000,
      sourceOutFrame: 152000,
      fadeFrames: STUDIO_PUNCH_FADE_FRAMES,
    })
    // Its first kept sample lands on the in point, its last before the out point.
    expect(40000 + cut!.sourceInFrame).toBe(RANGE.startFrame)
    expect(40000 + cut!.sourceOutFrame).toBe(RANGE.endFrame)
    expect(cut!.sourceOutFrame - cut!.sourceInFrame).toBe(96000)
  })

  it('ends where the capture ends when Stop came before the out point', () => {
    expect(studioPunchCut(40000, RANGE, 100000)).toMatchObject({
      startFrame: 96000,
      sourceInFrame: 56000,
      sourceOutFrame: 100000,
    })
  })

  it('keeps nothing when the capture stops before a tenth of a second of the range', () => {
    expect(studioPunchCut(40000, RANGE, 56000 + 4799)).toBeNull()
    expect(studioPunchCut(40000, RANGE, 56000 + 4800)).not.toBeNull()
    expect(studioPunchCut(40000, RANGE, 1000)).toBeNull()
  })
})

describe('Studio loop passes', () => {
  it('marks every whole pass as a window of the one capture: they meet frame to frame, the newest heard', () => {
    const heardFirst = 96000 - 1234
    // Four whole passes and half of a fifth.
    const cut = studioLoopCut(heardFirst, RANGE, 1234 + 4 * 96000 + 48000)
    expect(cut).toEqual({
      startFrame: 96000,
      sourceInFrame: 1234 + 3 * 96000,
      sourceOutFrame: 1234 + 4 * 96000,
      passes: { firstFrame: 1234, frames: 96000, count: 4 },
    })
    // The first window's first sample lands on the range's start, and every
    // later one a whole range on, where the run's count starts it again.
    expect(heardFirst + cut!.passes!.firstFrame).toBe(RANGE.startFrame)
  })

  it('leaves a pass the take stopped inside out of the windows, and plays one whole pass as an ordinary clip', () => {
    const heardFirst = 96000 - 1234
    expect(
      studioLoopCut(heardFirst, RANGE, 1234 + 2 * 96000 + 95999)?.passes,
    ).toEqual({ firstFrame: 1234, frames: 96000, count: 2 })
    expect(studioLoopCut(heardFirst, RANGE, 1234 + 96000 + 48000)).toEqual({
      startFrame: 96000,
      sourceInFrame: 1234,
      sourceOutFrame: 1234 + 96000,
    })
  })

  it('keeps what was sung of a first pass cut short, from the range start, when it holds a second', () => {
    const heardFirst = 96000 - 1234
    const minimum = studioMinPartialPass(96000)
    expect(minimum).toBe(48000)
    expect(studioLoopCut(heardFirst, RANGE, 1234 + minimum - 1)).toBeNull()
    // No out point: the clip runs to the take's end.
    expect(studioLoopCut(heardFirst, RANGE, 1234 + minimum)).toEqual({
      startFrame: 96000,
      sourceInFrame: 1234,
    })
    // Half the range for a range shorter than two seconds.
    expect(studioMinPartialPass(36000)).toBe(18000)
  })

  it('keeps an ordinary take of what was sung over a range longer than a take can be', () => {
    const long = { startFrame: 96000, endFrame: 96000 + 6 * 60 * 48000 }
    const capture = Math.floor((STUDIO_TAKE_MAX_SECONDS - 0.01) * 48000)
    expect(studioLoopCut(96000 - 1234, long, capture)).toEqual({
      startFrame: 96000,
      sourceInFrame: 1234,
    })
  })

  it('skips a pass that began before the capture did', () => {
    const cut = studioLoopCut(96000 + 500, RANGE, 95500 + 2 * 96000)
    expect(cut?.passes).toEqual({ firstFrame: 95500, frames: 96000, count: 2 })
    expect(cut?.startFrame).toBe(96000)
  })

  it('keeps at most the passes a clip holds', () => {
    const short = { startFrame: 0, endFrame: 12000 }
    expect(studioLoopCut(0, short, 12000 * 40)?.passes?.count).toBe(
      STUDIO_MAX_CLIP_PASSES,
    )
  })

  it('makes a plain take, a punch and a loop the clip each keeps', () => {
    const take = { heardFirst: 40000, fromFrame: 48000 }
    expect(studioTakeClip({ ...take, cut: null }, 100000)).toEqual({
      startFrame: 48000,
      sourceInFrame: 8000,
    })
    expect(
      studioTakeClip({ ...take, cut: { mode: 'punch', range: RANGE } }, 200000),
    ).toEqual(studioPunchCut(40000, RANGE, 200000))
    expect(
      studioTakeClip({ ...take, cut: { mode: 'loop', range: RANGE } }, 200000),
    ).toEqual(studioLoopCut(40000, RANGE, 200000))
    expect(studioTakeClip({ ...take, cut: null }, 8000)).toBeNull()
  })
})

describe('Studio take plan', () => {
  it('starts a punch a bar early with no count-in, and the count-in long with one', () => {
    const cut = { mode: 'punch' as const, range: RANGE }
    const bar = studioPunchPreroll(120, 0)
    expect(bar).toBe(96000)
    expect(
      planStudioTake({
        cut,
        playing: false,
        playheadFrame: 5,
        countInBars: 0,
        tempoBpm: 120,
      }),
    ).toEqual({
      cut,
      songFrom: 0,
      fromFrame: 96000,
      countInSeconds: 0,
      stopAt: 192000,
    })
    const later = {
      mode: 'punch' as const,
      range: { startFrame: 400000, endFrame: 500000 },
    }
    expect(
      planStudioTake({
        cut: later,
        playing: true,
        playheadFrame: 5,
        countInBars: 2,
        tempoBpm: 120,
      }),
    ).toMatchObject({ songFrom: 400000 - 192000, countInSeconds: 0 })
  })

  it('counts in what the song start leaves short of a punch pre-roll', () => {
    const cut = {
      mode: 'punch' as const,
      range: { startFrame: 24000, endFrame: 96000 },
    }
    const plan = planStudioTake({
      cut,
      playing: false,
      playheadFrame: 0,
      countInBars: 0,
      tempoBpm: 120,
    })
    expect(plan.songFrom).toBe(0)
    expect(plan.countInSeconds).toBe(1.5)
  })

  it('loops from the range start after the count-in, stopping just after the last pass a clip keeps', () => {
    const cut = { mode: 'loop' as const, range: RANGE }
    expect(
      planStudioTake({
        cut,
        playing: true,
        playheadFrame: 5,
        countInBars: 1,
        tempoBpm: 120,
      }),
    ).toEqual({
      cut,
      songFrom: 96000,
      fromFrame: 96000,
      countInSeconds: 2,
      stopAt: 96000 + STUDIO_MAX_CLIP_PASSES * 96000 + 480,
    })
    expect(STUDIO_LAST_PASS_SPARE_FRAMES).toBe(480)
  })

  it('records a plain take from the playhead, or along with a song that plays', () => {
    const request = {
      cut: null,
      playheadFrame: 4800,
      countInBars: 1,
      tempoBpm: 120,
    }
    expect(planStudioTake({ ...request, playing: false })).toEqual({
      cut: null,
      songFrom: 4800,
      fromFrame: 4800,
      countInSeconds: 2,
      stopAt: null,
    })
    expect(planStudioTake({ ...request, playing: true })).toMatchObject({
      songFrom: null,
      fromFrame: null,
      countInSeconds: 0,
    })
  })
})
