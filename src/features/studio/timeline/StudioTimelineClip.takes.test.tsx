// Studio clip takes on the timeline — a clip of several takes says which plays ("3/3"), and its right-click menu lists them, the playing one checked, a pick playing another.
import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { studioClipWithTakes } from '@/lib/studio/model/clip-takes'
import { studioFixture } from '@/lib/studio/model/model.test-fixtures'
import type { StudioAsset, StudioClip } from '@/lib/studio/model/types'
import { STUDIO_SAMPLE_RATE } from '@/lib/studio/model/types'
import { StudioTimelineClip } from './StudioTimelineClip'
import { createStudioWaveformResource } from './waveform-resource'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const idlePointer = () => ({
  draft: () => null,
  offsetY: () => 0,
  active: () => false,
  message: () => '',
  start: vi.fn(),
  cancel: vi.fn(),
  suppressClick: () => false,
})

/** A clip of three recorded takes, the newest playing. */
function takesClip(takes = 3) {
  const base = studioFixture()
  const assets = new Map<string, StudioAsset>(
    Array.from({ length: takes }, (_, index) => {
      const id = `take-${index + 1}`
      return [id, { ...base.asset, id, originalName: `Take ${index + 1}.wav` }]
    }),
  )
  const one: StudioClip = {
    ...base.clip,
    startFrame: 0,
    sourceOutFrame: 2 * STUDIO_SAMPLE_RATE,
    fades: { curve: 'linear-amplitude' },
  }
  const clip = studioClipWithTakes(
    [...assets.keys()].map((assetId) => ({ ...one, assetId })),
    takes - 1,
  )
  return { clip, assets }
}

function renderClip(clip: StudioClip, assets: Map<string, StudioAsset>) {
  const onCommand = vi.fn(() => true)
  const onSelect = vi.fn()
  render(() => (
    <StudioTimelineClip
      clip={clip}
      asset={assets.get(clip.assetId)}
      assets={assets}
      trackName="Voice"
      selected={false}
      writable
      phone={false}
      tablet={false}
      scale={100}
      scroll={0}
      contentWidth={1000}
      resource={createStudioWaveformResource(() => new Promise(() => {}))}
      pointer={idlePointer()}
      onCommand={onCommand}
      onSelect={onSelect}
      onDetails={vi.fn()}
    />
  ))
  return { onCommand, onSelect }
}

describe('Studio clip takes on the timeline', () => {
  it('says which take plays, on its band and in its name', () => {
    const { clip, assets } = takesClip()
    renderClip(clip, assets)
    const button = screen.getByRole('button', { name: /^Voice, Take 3\.wav/ })
    expect(button).toHaveAccessibleName(
      'Voice, Take 3.wav, take 3 of 3, 0:00.000 to 0:02.000',
    )
    expect(button.querySelector('[data-studio-take-badge]')?.textContent).toBe(
      '3/3',
    )
  })

  it('lists its takes on a right-click, the playing one checked, and plays the one picked', () => {
    const { clip, assets } = takesClip()
    const { onCommand, onSelect } = renderClip(clip, assets)
    fireEvent.contextMenu(screen.getByRole('button', { name: /^Voice/ }), {
      clientX: 20,
      clientY: 10,
    })
    expect(onSelect).toHaveBeenCalled()
    const menu = screen.getByRole('menu', { name: 'Takes' })
    const rows = within(menu).getAllByRole('menuitemradio')
    expect(rows.map((row) => row.textContent)).toEqual([
      'Take 1',
      'Take 2',
      'Take 3',
    ])
    expect(rows.map((row) => row.getAttribute('aria-checked'))).toEqual([
      'false',
      'false',
      'true',
    ])
    fireEvent.click(rows[0])
    expect(onCommand).toHaveBeenCalledWith({
      type: 'choose-take',
      clipId: clip.id,
      take: 0,
    })
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('moves through its rows with the arrow keys, and Escape gives the focus back to the clip', () => {
    const { clip, assets } = takesClip()
    const { onCommand } = renderClip(clip, assets)
    const button = screen.getByRole('button', { name: /^Voice/ })
    button.focus()
    // The menu key: no pointer over the clip.
    fireEvent.contextMenu(button)
    const menu = screen.getByRole('menu')
    const rows = within(menu).getAllByRole('menuitemradio')
    const show = within(menu).getByRole('menuitem', { name: 'Show takes' })
    expect(rows[2]).toHaveFocus()
    fireEvent.keyDown(rows[2], { key: 'ArrowDown' })
    expect(show).toHaveFocus()
    fireEvent.keyDown(show, { key: 'ArrowDown' })
    expect(rows[0]).toHaveFocus()
    fireEvent.keyDown(rows[0], { key: 'End' })
    expect(show).toHaveFocus()
    fireEvent.keyDown(show, { key: 'ArrowUp' })
    expect(rows[2]).toHaveFocus()
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(button).toHaveFocus()
    expect(onCommand).not.toHaveBeenCalled()
  })

  it('lists the passes of a loop take on a right-click, its band naming its pass without a badge', () => {
    const { clip: one, assets } = takesClip(1)
    // Three passes of two seconds, the third playing.
    const pass = 2 * STUDIO_SAMPLE_RATE
    const loop: StudioClip = {
      ...one,
      sourceInFrame: 2 * pass,
      sourceOutFrame: 3 * pass,
      passes: { firstFrame: 0, frames: pass, count: 3 },
    }
    const { onCommand } = renderClip(loop, assets)
    const button = screen.getByRole('button', { name: /^Voice/ })
    expect(button).toHaveAccessibleName(
      'Voice, Take 1, pass 3 of 3, 0:00.000 to 0:02.000',
    )
    expect(button.querySelector('[data-studio-take-badge]')).toBeNull()
    fireEvent.contextMenu(button, { clientX: 20, clientY: 10 })
    const rows = within(screen.getByRole('menu')).getAllByRole('menuitemradio')
    expect(rows.map((row) => row.textContent)).toEqual([
      'Take 1, pass 1 of 3',
      'Take 1, pass 2 of 3',
      'Take 1, pass 3 of 3',
    ])
    fireEvent.click(rows[0])
    expect(onCommand).toHaveBeenCalledWith({
      type: 'choose-take',
      clipId: loop.id,
      take: 0,
      pass: 0,
    })
  })

  it('leaves a clip of one take its own right-click, and its band unmarked', () => {
    const { clip, assets } = takesClip(1)
    renderClip(clip, assets)
    const button = screen.getByRole('button', { name: /^Voice/ })
    expect(fireEvent.contextMenu(button)).toBe(true)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(button.querySelector('[data-studio-take-badge]')).toBeNull()
  })
})
