// Studio take lanes tests — Show takes stands a clip's takes in rows under its lane, newest on top and the playing one pressed; a click plays another as one edit, Up and Down move between them, Escape or Hide takes closes them back to the clip, and they give way to comping and to a take.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { studioClipWithTakes } from '@/lib/studio/model/clip-takes'
import { studioFixture } from '@/lib/studio/model/model.test-fixtures'
import type { StudioProject } from '@/lib/studio/model/types'
import { setStudioTakeRunning } from '../record/take-running'
import { closeStudioComp, closeStudioTakes, openStudioComp, openStudioTakes, studioCompClipId, studioTakesClipId, } from './comp-editor'
import { StudioTakeLanes } from './StudioTakeLanes'
import { createStudioWaveformResource } from './waveform-resource'

afterEach(() => {
  cleanup()
  closeStudioTakes()
  closeStudioComp()
  setStudioTakeRunning(false)
  document.body.replaceChildren()
})

/** A lane whose clip keeps `takes` takes, the newest playing, and the clip's own button beside the rows. */
function setup(takes = 3, writable = true) {
  const base = studioFixture()
  const assets = Array.from({ length: takes }, (_, index) => ({
    ...base.asset,
    id: `take-${index + 1}`,
    originalName: `Take ${index + 1}.wav`,
  }))
  const one = { ...base.clip, id: 'clip-1', trackId: 'lane' }
  const clip = studioClipWithTakes(
    assets.map((asset) => ({ ...one, assetId: asset.id })),
    takes - 1,
  )
  const [project, setProject] = createSignal<StudioProject>({
    ...base.project,
    tracks: [{ ...base.project.tracks[0], id: 'lane' }],
    clips: [clip],
  })
  const command = vi.fn(() => true)
  const resource = createStudioWaveformResource(() => new Promise(() => {}))
  const button = document.createElement('button')
  button.dataset.studioClip = 'clip-1'
  document.body.append(button)
  render(() => (
    <StudioTakeLanes
      trackId="lane"
      timeline={{
        get project() {
          return project()
        },
        assets,
        writable,
        phone: false,
        onCommand: command,
      }}
      view={{
        scale: () => 100,
        scroll: () => 0,
        contentWidth: () => 1000,
        resource: () => resource,
      }}
    />
  ))
  return { command, setProject, one, button }
}

const rows = () => screen.queryAllByRole('button', { name: /^Take \d$/ })

describe('Studio take lanes', () => {
  it('stands the takes in rows under the lane once Show takes opens them, newest on top, the playing one pressed', () => {
    setup()
    expect(rows()).toEqual([])
    openStudioTakes('clip-1')
    expect(screen.getByRole('group', { name: 'Takes, 3' })).toBeTruthy()
    expect(rows().map((row) => row.getAttribute('aria-label'))).toEqual([
      'Take 3',
      'Take 2',
      'Take 1',
    ])
    expect(rows().map((row) => row.getAttribute('aria-pressed'))).toEqual([
      'true',
      'false',
      'false',
    ])
  })

  it('plays the take clicked as one edit, leaves the playing one be, and moves between rows with Up and Down', () => {
    const { command } = setup()
    openStudioTakes('clip-1')
    fireEvent.click(rows()[2])
    expect(command).toHaveBeenCalledWith({
      type: 'choose-take',
      clipId: 'clip-1',
      take: 0,
    })
    fireEvent.click(rows()[0])
    expect(command).toHaveBeenCalledTimes(1)
    rows()[0].focus()
    fireEvent.keyDown(rows()[0], { key: 'ArrowDown' })
    expect(rows()[1]).toHaveFocus()
    fireEvent.keyDown(rows()[1], { key: 'ArrowUp' })
    expect(rows()[0]).toHaveFocus()
  })

  it('closes on Escape or Hide takes, the focus back on the clip', () => {
    const { button } = setup()
    openStudioTakes('clip-1')
    rows()[1].focus()
    fireEvent.keyDown(rows()[1], { key: 'Escape' })
    expect(rows()).toEqual([])
    expect(studioTakesClipId()).toBeNull()
    expect(button).toHaveFocus()
    openStudioTakes('clip-1')
    fireEvent.click(screen.getByRole('button', { name: 'Hide takes' }))
    expect(rows()).toEqual([])
  })

  it('gives way to comping and to a take, and closes once the clip keeps one take', () => {
    const { setProject, one } = setup()
    openStudioTakes('clip-1')
    openStudioComp('clip-1')
    expect(studioTakesClipId()).toBeNull()
    expect(rows()).toEqual([])
    openStudioTakes('clip-1')
    expect(studioCompClipId()).toBeNull()
    setStudioTakeRunning(true)
    expect(rows()).toEqual([])
    setStudioTakeRunning(false)
    expect(rows()).toHaveLength(3)
    setProject((song) => ({ ...song, clips: [one] }))
    expect(studioTakesClipId()).toBeNull()
  })

  it('shows the takes of a song that cannot be changed without choosing', () => {
    const { command } = setup(2, false)
    openStudioTakes('clip-1')
    expect(rows().map((row) => (row as HTMLButtonElement).disabled)).toEqual([
      true,
      true,
    ])
    fireEvent.click(rows()[1])
    expect(command).not.toHaveBeenCalled()
  })
})
