// Studio comp lanes tests — a loop take's passes open under its lane newest on top, a swipe or Enter plays a pass over a stretch as one edit, and a take holds them.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { studioFixture } from '@/lib/studio/model/model.test-fixtures'
import type { StudioClip, StudioProject } from '@/lib/studio/model/types'
import { setStudioTakeRunning } from '../record/take-running'
import { closeStudioComp, openStudioComp, studioCompClipId, } from './comp-editor'
import { StudioCompLanes } from './StudioCompLanes'
import { createStudioWaveformResource } from './waveform-resource'

/** Three two-second passes from frame 0; the clip plays the newest from one second into the song. */
const PASS = 96_000
const take: StudioClip = {
  id: 'take',
  trackId: 'lane',
  assetId: 'asset-1',
  startFrame: 48_000,
  sourceInFrame: 2 * PASS,
  sourceOutFrame: 3 * PASS,
  gainDb: 0,
  fades: { curve: 'linear-amplitude' },
  passes: { firstFrame: 0, frames: PASS, count: 3 },
}

/** The newest pass, the oldest over the second quarter of the clip, then the newest again. */
const stretched: StudioClip = {
  ...take,
  comp: [
    { fromSourceFrame: 2 * PASS, toSourceFrame: 2 * PASS + 24_000, pass: 2 },
    {
      fromSourceFrame: 2 * PASS + 24_000,
      toSourceFrame: 2 * PASS + 48_000,
      pass: 0,
    },
    { fromSourceFrame: 2 * PASS + 48_000, toSourceFrame: 3 * PASS, pass: 2 },
  ],
}

function setup(
  options: { clip?: StudioClip; phone?: boolean; snap?: boolean } = {},
) {
  const base = studioFixture()
  const [project, setProject] = createSignal<StudioProject>({
    ...base.project,
    tempoBpm: 120,
    ruler: 'bars',
    tracks: [{ ...base.project.tracks[0], id: 'lane' }],
    clips: [options.clip ?? take],
  })
  const command = vi.fn(() => true)
  const resource = createStudioWaveformResource(() => new Promise(() => {}))
  render(() => (
    <StudioCompLanes
      trackId="lane"
      timeline={{
        get project() {
          return project()
        },
        assets: [{ ...base.asset, id: 'asset-1' }],
        writable: true,
        phone: options.phone === true,
        playheadFrame: 0,
        onCommand: command,
      }}
      view={{
        // 100 px a second: a pixel is 480 frames, the clip 200 px from 100 px.
        scale: () => 100,
        scroll: () => 0,
        contentWidth: () => 1000,
        snap: () => options.snap !== false,
        resource: () => resource,
      }}
    />
  ))
  return { command, setProject }
}

/** The strip of a pass, laid out where the lane draws it: 200 px from 100 px. */
function strip(number: number): HTMLElement {
  const element = screen.getByRole('group', {
    name: new RegExp(`^Pass ${number} of 3`),
  })
  element.getBoundingClientRect = () => new DOMRect(100, 0, 200, 40)
  element.setPointerCapture = vi.fn()
  element.releasePointerCapture = vi.fn()
  return element
}

function pointer(type: string, target: HTMLElement, clientX: number) {
  const event = new MouseEvent(type, { bubbles: true, clientX, button: 0 })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  target.dispatchEvent(event)
}

beforeEach(() => closeStudioComp())
afterEach(() => {
  cleanup()
  setStudioTakeRunning(false)
  closeStudioComp()
})

describe('Studio comp lanes', () => {
  it('stands the passes under the lane, newest on top, once Comp opens them', () => {
    setup()
    expect(screen.queryByRole('group', { name: /^Pass/ })).toBeNull()

    openStudioComp('take')

    expect(
      screen
        .getAllByRole('group', { name: /^Pass \d of 3/ })
        .map((row) => row.getAttribute('aria-label')?.slice(0, 11)),
    ).toEqual(['Pass 3 of 3', 'Pass 2 of 3', 'Pass 1 of 3'])
  })

  it('stays shut on another lane, on a phone and while a take runs', () => {
    setup({ clip: { ...take, trackId: 'other' } })
    openStudioComp('take')
    expect(screen.queryByRole('group', { name: /^Pass/ })).toBeNull()
    cleanup()

    setup({ phone: true })
    expect(screen.queryByRole('group', { name: /^Pass/ })).toBeNull()
    cleanup()

    setup()
    setStudioTakeRunning(true)
    expect(screen.queryByRole('group', { name: /^Pass/ })).toBeNull()
    setStudioTakeRunning(false)
    expect(screen.getAllByRole('group', { name: /^Pass/ })).toHaveLength(3)
  })

  it('plays the pass swiped across over that stretch, snapped to the grid', () => {
    const { command } = setup()
    openStudioComp('take')
    const first = strip(1)

    // From 0.2 s into the clip to 0.9 s: the grid at 100 px a second is half
    // a beat (a quarter second at 120 bpm), so 0.25 s to 1 s of the clip.
    pointer('pointerdown', first, 100 + 20)
    pointer('pointermove', first, 100 + 60)
    pointer('pointermove', first, 100 + 90)
    pointer('pointerup', first, 100 + 90)

    expect(command).toHaveBeenCalledTimes(1)
    expect(command).toHaveBeenCalledWith({
      type: 'comp-pass',
      clipId: 'take',
      fromSourceFrame: 2 * PASS + 12_000,
      toSourceFrame: 2 * PASS + 48_000,
      pass: 0,
    })
  })

  it('takes a swipe as it is with Snap off', () => {
    const { command } = setup({ snap: false })
    openStudioComp('take')
    const middle = strip(2)

    pointer('pointerdown', middle, 100 + 20)
    pointer('pointermove', middle, 100 + 90)
    pointer('pointerup', middle, 100 + 90)

    expect(command).toHaveBeenCalledWith(
      expect.objectContaining({
        fromSourceFrame: 2 * PASS + 20 * 480,
        toSourceFrame: 2 * PASS + 90 * 480,
        pass: 1,
      }),
    )
  })

  it('lights the stretches each pass plays', () => {
    const { setProject } = setup()
    openStudioComp('take')
    const lit = (number: number) =>
      [
        ...strip(number).querySelectorAll<HTMLElement>(
          '[data-studio-comp-lit]',
        ),
      ].map((part) => `${part.style.left} ${part.style.width}`)
    expect(lit(3)).toEqual(['0px 200px'])
    expect(lit(1)).toEqual([])

    setProject((song) => ({ ...song, clips: [stretched] }))

    expect(lit(3)).toEqual(['0px 50px', '100px 100px'])
    expect(lit(1)).toEqual(['50px 50px'])
  })

  it('dims each pass where another plays', () => {
    const { setProject } = setup()
    openStudioComp('take')
    const unlit = (number: number) =>
      [
        ...strip(number).querySelectorAll<HTMLElement>(
          '[data-studio-comp-unlit]',
        ),
      ].map((part) => `${part.style.left} ${part.style.width}`)
    expect(unlit(3)).toEqual([])
    expect(unlit(1)).toEqual(['0px 200px'])

    setProject((song) => ({ ...song, clips: [stretched] }))

    expect(unlit(3)).toEqual(['50px 50px'])
    expect(unlit(1)).toEqual(['0px 50px', '100px 100px'])
    // Other passes side by side dim as one stretch.
    expect(unlit(2)).toEqual(['0px 200px'])
  })

  it('marks the pick for the keys or a click, and leaves none after a swipe', () => {
    setup()
    openStudioComp('take')
    const middle = strip(2)
    const picked = (element: HTMLElement) =>
      element.querySelector<HTMLElement>('[data-studio-comp-picked]')

    // A swipe focuses its pass and is done: nothing waits for Enter.
    pointer('pointerdown', middle, 100 + 20)
    pointer('pointermove', middle, 100 + 90)
    pointer('pointerup', middle, 100 + 90)
    expect(document.activeElement).toBe(middle)
    expect(picked(middle)).toBeNull()
    expect(middle.getAttribute('aria-label')).not.toContain('Picked')

    // A click picks the grid cell under it, for Enter to use.
    pointer('pointerdown', middle, 100 + 130)
    pointer('pointerup', middle, 100 + 130)
    expect(picked(middle)?.style.left).toBe('125px')
    expect(middle.getAttribute('aria-label')).toContain(
      'Picked 0:02.250 to 0:02.500',
    )

    // The pass the keys move to shows the pick at once.
    fireEvent.keyDown(middle, { key: 'ArrowUp' })
    expect(picked(strip(3))?.style.left).toBe('125px')
  })

  it('moves a selection with the arrows and plays the focused pass there with Enter', () => {
    const { command } = setup()
    openStudioComp('take')
    const middle = strip(2)
    middle.focus()

    fireEvent.keyDown(middle, { key: 'ArrowRight' })
    fireEvent.keyDown(middle, { key: 'ArrowRight', shiftKey: true })
    fireEvent.keyDown(middle, { key: 'Enter' })

    // The clip's first grid cell, moved one cell on and widened by one.
    expect(command).toHaveBeenCalledWith({
      type: 'comp-pass',
      clipId: 'take',
      fromSourceFrame: 2 * PASS + 12_000,
      toSourceFrame: 2 * PASS + 36_000,
      pass: 1,
    })
    expect(middle.getAttribute('aria-label')).toContain('0:01.250 to 0:01.750')
  })

  it('moves to the pass above or below with the arrows, and closes with Escape or Done', () => {
    setup()
    openStudioComp('take')
    const middle = strip(2)
    middle.focus()

    fireEvent.keyDown(middle, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(strip(3))
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(strip(1))

    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(studioCompClipId()).toBeNull()

    openStudioComp('take')
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(studioCompClipId()).toBeNull()
  })

  it('closes when its clip leaves the song', () => {
    const { setProject } = setup()
    openStudioComp('take')

    setProject((song) => ({ ...song, clips: [] }))

    expect(studioCompClipId()).toBeNull()
  })
})
