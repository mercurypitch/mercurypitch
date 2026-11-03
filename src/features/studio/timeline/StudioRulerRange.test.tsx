// Studio ruler range tests — a range is drawn with Shift, its ends move by the grid and never cross, and it holds still while a take runs.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { studioFixture } from '@/lib/studio/model/model.test-fixtures'
import { STUDIO_MIN_LOOP_FRAMES } from '@/lib/studio/playback/loop-range'
import { setStudioTakeRunning } from '../record/take-running'
import type { StudioRangeTools } from './StudioRulerRange'
import { createStudioRangeDraw, createStudioRangeTools, studioRangeBetween, studioRangeEdge,StudioRulerRange,  } from './StudioRulerRange'

afterEach(() => {
  cleanup()
  setStudioTakeRunning(false)
})

/** A pointer event whose frame is its clientX, in thousands. */
const at = (thousands: number, shiftKey = true) =>
  ({ clientX: thousands, shiftKey }) as PointerEvent

function draw(locked = false) {
  const commit = vi.fn()
  const tool = createStudioRangeDraw({
    frameAt: (event) => event.clientX * 1000,
    snap: (frame) => Math.round(frame / 12000) * 12000,
    commit,
    locked: () => locked,
  })
  return { tool, commit }
}

describe('studioRangeBetween', () => {
  it('orders its ends, starts at 0 at the earliest and refuses a range too short to loop', () => {
    expect(studioRangeBetween(96000, 48000.4)).toEqual({
      startFrame: 48000,
      endFrame: 96000,
    })
    expect(studioRangeBetween(-500, 24000)).toEqual({
      startFrame: 0,
      endFrame: 24000,
    })
    expect(studioRangeBetween(0, STUDIO_MIN_LOOP_FRAMES - 1)).toBeNull()
  })
})

describe('studioRangeEdge', () => {
  const range = { startFrame: 48000, endFrame: 96000 }

  it('moves one end and stops it the shortest loop short of the other', () => {
    expect(studioRangeEdge(range, 'start', 60000)).toEqual({
      startFrame: 60000,
      endFrame: 96000,
    })
    expect(studioRangeEdge(range, 'start', 200000)).toEqual({
      startFrame: 96000 - STUDIO_MIN_LOOP_FRAMES,
      endFrame: 96000,
    })
    expect(studioRangeEdge(range, 'start', -10)).toEqual({
      startFrame: 0,
      endFrame: 96000,
    })
    expect(studioRangeEdge(range, 'end', 0)).toEqual({
      startFrame: 48000,
      endFrame: 48000 + STUDIO_MIN_LOOP_FRAMES,
    })
  })
})

describe('createStudioRangeDraw', () => {
  it('leaves a press without Shift to the scrub', () => {
    const { tool } = draw()
    expect(tool.press(at(10, false))).toBe(false)
    expect(tool.move(at(20))).toBe(false)
    expect(tool.end(true)).toBe(false)
  })

  it('shows a snapped range while it is drawn and sets it once, on release', () => {
    const { tool, commit } = draw()
    expect(tool.press(at(49))).toBe(true)
    tool.move(at(70))
    expect(tool.draft()).toEqual({ startFrame: 48000, endFrame: 72000 })
    tool.move(at(97))
    expect(commit).not.toHaveBeenCalled()
    expect(tool.end(true)).toBe(true)
    expect(commit).toHaveBeenCalledExactlyOnceWith({
      startFrame: 48000,
      endFrame: 96000,
    })
    expect(tool.draft()).toBeNull()
  })

  it('sets nothing for a cancelled draw or one too short to loop', () => {
    const { tool, commit } = draw()
    tool.press(at(48))
    tool.move(at(96))
    tool.end(false)
    tool.press(at(48))
    tool.move(at(50))
    tool.end(true)
    expect(commit).not.toHaveBeenCalled()
  })

  it('takes a Shift-press during a take and draws nothing', () => {
    const { tool, commit } = draw(true)
    expect(tool.press(at(48))).toBe(true)
    expect(tool.move(at(96))).toBe(false)
    expect(tool.draft()).toBeNull()
    tool.end(true)
    expect(commit).not.toHaveBeenCalled()
  })
})

function mount(range = { startFrame: 48000, endFrame: 96000 }) {
  const onChange = vi.fn()
  let tools!: StudioRangeTools
  render(() => {
    tools = createStudioRangeTools({
      frameAt: (event) => event.clientX * 1000,
      scale: () => 100,
      project: () => studioFixture().project,
      playheadFrame: () => 0,
      snapping: () => false,
      commit: onChange,
    })
    return (
      <StudioRulerRange
        tools={tools}
        range={range}
        scale={100}
        onChange={onChange}
      />
    )
  })
  return { onChange, tools }
}

describe('StudioRulerRange', () => {
  it('moves an end a grid step with the arrow keys and clears with the cross', async () => {
    const { onChange, tools } = mount()
    const start = screen.getByRole('slider', { name: 'Range start' })
    expect(start).toHaveAttribute('aria-valuetext', '0:01.000')
    await fireEvent.keyDown(start, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith({
      startFrame: 48000 + tools.step(),
      endFrame: 96000,
    })
    await fireEvent.keyDown(screen.getByRole('slider', { name: 'Range end' }), {
      key: 'ArrowLeft',
    })
    expect(onChange).toHaveBeenLastCalledWith({
      startFrame: 48000,
      endFrame: 96000 - tools.step(),
    })
    await fireEvent.click(screen.getByRole('button', { name: 'Clear range' }))
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('hides its handles while a take runs, so the range holds still', () => {
    setStudioTakeRunning(true)
    mount()
    expect(screen.queryByRole('slider', { name: 'Range start' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Clear range' })).toBeNull()
    setStudioTakeRunning(false)
    expect(screen.getByRole('slider', { name: 'Range start' })).toBeVisible()
  })
})
