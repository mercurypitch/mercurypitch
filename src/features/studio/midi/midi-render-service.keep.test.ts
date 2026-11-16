// Studio MIDI render service tests — keeping: a stale clip's render is kept, named as its clip, when the editor closes, when the song opens, before an export and a second after an undo or redo; once for every clip it is for; never for notes that changed while it rendered. Failure: a clip whose render fails plays its earlier audio, its lane says so in plain words, and its key is tried once more only when a keep asks, never a third time.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { studioMidiRenderKey } from '@/lib/studio/midi/render-key'
import { applyStudioCommand } from '@/lib/studio/model/commands'
import type { StudioAsset, StudioProject } from '@/lib/studio/model/types'
import type { StudioRenderImport } from '../controller/imports'
import { editNotes, MIDI_OPTIONS, playedAsset, renderServiceFixture, up, } from './midi-render.fixture'

const cleanups: (() => void)[] = []
beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
  vi.useRealTimers()
})

function mount(...args: Parameters<typeof renderServiceFixture>) {
  const ui = renderServiceFixture(...args)
  cleanups.push(ui.dispose)
  // The take's audio has a name, which a kept render takes.
  ui.setAssets(
    ui.fixture.assets.map((asset) =>
      asset.id === 'asset-midi'
        ? { ...asset, originalName: 'Take 1.wav' }
        : asset,
    ),
  )
  return ui
}

/** Keep renders as the controller does: an asset of their length, swapped in by the command. */
function keepIntoSong(ui: ReturnType<typeof mount>): void {
  let serial = 0
  ui.keep.mockImplementation(async (render: StudioRenderImport) => {
    ui.kept.push(render)
    const song = ui.project()!
    const asset: StudioAsset = {
      ...ui.fixture.assets[1],
      id: `kept-${++serial}`,
      normalizedFrameCount: render.samples.length,
      canonicalPcmByteLength: 32 + render.samples.length * 4,
    }
    const assets = [...MIDI_OPTIONS.assets, asset]
    ui.setAssets(assets)
    const next = applyStudioCommand(
      song,
      {
        type: 'set-midi-render',
        assetId: asset.id,
        renderKey: render.renderKey,
      },
      { ...MIDI_OPTIONS, assets },
    )
    ui.setProject(next)
    return next !== song
  })
}

const keyOf = (project: StudioProject) =>
  studioMidiRenderKey(project.sequences![0], 'piano')

describe('keeping a MIDI render', () => {
  it('keeps a stale clip’s render when the editor closes, under its clip’s name, and the transport then plays the kept audio', async () => {
    // Arrange
    const ui = mount()
    keepIntoSong(ui)
    const edited = editNotes(ui.fixture.project, up)
    ui.setProject(edited)
    await vi.advanceTimersByTimeAsync(250)
    ui.renderer.calls[0].resolve()
    await vi.advanceTimersByTimeAsync(50)

    // Act
    await ui.service.editorClosed()

    // Assert
    expect(ui.keep).toHaveBeenCalledOnce()
    expect(ui.kept[0]).toMatchObject({
      renderKey: keyOf(edited),
      title: 'Take 1',
    })
    expect(ui.kept[0].samples).toHaveLength(120_000)
    expect(ui.renderer.calls).toHaveLength(1)
    expect(playedAsset(ui.service)).toBe('kept-1')
    expect(ui.service.renderState('clip-midi')).toBe('idle')
  })

  it('keeps the render of a clip whose audio has no name with none, as a clip drawn from scratch, so it goes on showing its lane’s', async () => {
    // Arrange: the take's audio unnamed, as a new clip's silence is.
    const ui = mount()
    ui.setAssets(ui.fixture.assets)
    keepIntoSong(ui)
    const edited = editNotes(ui.fixture.project, up)
    ui.setProject(edited)
    await vi.advanceTimersByTimeAsync(250)
    ui.renderer.calls[0].resolve()
    await vi.advanceTimersByTimeAsync(50)

    // Act
    await ui.service.editorClosed()

    // Assert
    expect(ui.kept).toHaveLength(1)
    expect(ui.kept[0].renderKey).toBe(keyOf(edited))
    expect(ui.kept[0].title).toBeUndefined()
  })

  it('keeps what the song was left stale with as it opens, without waiting for an edit to rest', async () => {
    // Arrange
    const stale = editNotes(renderServiceFixture().fixture.project, up)

    // Act
    const ui = mount(stale)
    keepIntoSong(ui)
    await vi.advanceTimersByTimeAsync(0)
    ui.renderer.calls[0].resolve()
    await vi.advanceTimersByTimeAsync(50)

    // Assert
    expect(ui.kept.map((render) => render.renderKey)).toEqual([keyOf(stale)])
    expect(playedAsset(ui.service)).toBe('kept-1')
  })

  it('keeps a render a second after an undo or redo lands on a stale clip', async () => {
    // Arrange
    const ui = mount()
    keepIntoSong(ui)

    // Act
    ui.setProject(editNotes(ui.fixture.project, up))
    ui.setTravels(1)
    await vi.advanceTimersByTimeAsync(250)
    ui.renderer.calls[0].resolve()
    await vi.advanceTimersByTimeAsync(749)
    const early = ui.keep.mock.calls.length
    await vi.advanceTimersByTimeAsync(1)

    // Assert
    expect(early).toBe(0)
    expect(ui.keep).toHaveBeenCalledOnce()
  })

  it('keeps one render once for every clip whose notes have its key', async () => {
    // Arrange
    const ui = mount()
    keepIntoSong(ui)
    const split = applyStudioCommand(
      editNotes(ui.fixture.project, up),
      {
        type: 'split-clip',
        clipId: 'clip-midi',
        atFrame: 72_000,
        newClipId: 'clip-half',
      },
      MIDI_OPTIONS,
    )
    ui.setProject(split)

    // Act
    const closed = ui.service.editorClosed()
    await vi.advanceTimersByTimeAsync(0)
    ui.renderer.calls[0].resolve()
    await closed

    // Assert
    expect(ui.renderer.calls).toHaveLength(1)
    expect(ui.keep).toHaveBeenCalledOnce()
    expect(playedAsset(ui.service, 'clip-midi')).toBe('kept-1')
    expect(playedAsset(ui.service, 'clip-half')).toBe('kept-1')
  })

  it('never keeps a render whose notes changed while it rendered: edit, render in flight, undo, render lands', async () => {
    // Arrange
    const ui = mount()
    keepIntoSong(ui)
    ui.setProject(editNotes(ui.fixture.project, up))
    const closed = ui.service.editorClosed()
    await vi.advanceTimersByTimeAsync(0)
    const inFlight = ui.renderer.calls[0]

    // Act
    ui.setProject(ui.fixture.project)
    inFlight.resolve()
    await closed

    // Assert
    expect(ui.keep).not.toHaveBeenCalled()
    expect(playedAsset(ui.service)).toBe('asset-midi')
    expect(ui.project()!.clips[1].assetId).toBe('asset-midi')
  })

  it('never keeps a ready preview of notes undone as the keep began', async () => {
    // Arrange
    const ui = mount()
    keepIntoSong(ui)
    ui.setProject(editNotes(ui.fixture.project, up))
    await vi.advanceTimersByTimeAsync(250)
    ui.renderer.calls[0].resolve()
    await vi.advanceTimersByTimeAsync(50)

    // Act
    const closed = ui.service.editorClosed()
    // The keep has picked the render and waits on its ready preview.
    await Promise.resolve()
    ui.setProject(ui.fixture.project)
    await closed

    // Assert
    expect(ui.keep).not.toHaveBeenCalled()
    expect(playedAsset(ui.service)).toBe('asset-midi')
  })

  it('settles before an export once the renders are kept, and at once when nothing is stale', async () => {
    // Arrange
    const ui = mount()
    keepIntoSong(ui)
    const nothing = ui.service.settle()
    ui.setProject(editNotes(ui.fixture.project, up))

    // Act
    const settled = ui.service.settle()
    await vi.advanceTimersByTimeAsync(0)
    const pending = ui.service.keepsPending()
    ui.renderer.calls[0].resolve()
    await settled

    // Assert
    await expect(nothing).resolves.toBeUndefined()
    expect(pending).toBe(true)
    expect(ui.service.keepsPending()).toBe(false)
    expect(playedAsset(ui.service)).toBe('kept-1')
  })
})

describe('a MIDI render that fails', () => {
  it('leaves its clip on its earlier audio, says so on its lane, and is tried once more only when a keep asks, never a third time', async () => {
    // Arrange
    const ui = mount()
    const kit = new Error("Studio couldn't start the drum kit for this render.")
    ui.setProject(editNotes(ui.fixture.project, up))
    await vi.advanceTimersByTimeAsync(250)

    // Act
    ui.renderer.calls[0].reject(kit)
    await vi.advanceTimersByTimeAsync(5000)
    const afterFirst = ui.renderer.calls.length
    const notice = ui.service.notice()?.text
    const closed = ui.service.editorClosed()
    await vi.advanceTimersByTimeAsync(0)
    ui.renderer.calls[1].reject(kit)
    await closed
    await ui.service.editorClosed()

    // Assert
    expect(afterFirst).toBe(1)
    expect(notice).toBe(
      "Keys still plays its earlier audio: Studio couldn't render the new notes. Studio couldn't start the drum kit for this render.",
    )
    expect(ui.renderer.calls).toHaveLength(2)
    expect(ui.service.renderState('clip-midi')).toBe('failed')
    expect(playedAsset(ui.service)).toBe('asset-midi')
    expect(ui.keep).not.toHaveBeenCalled()
    expect(ui.failures.count(keyOf(ui.project()!))).toBe(2)
  })
})
