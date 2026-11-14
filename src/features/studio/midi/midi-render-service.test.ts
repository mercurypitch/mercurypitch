// Studio MIDI render service tests — previews: a stale clip is rendered in memory a quarter second after its notes rest and plays in the transport's song under an id of its key; a clip on a drum lane renders the kit; a newer edit aborts the render it supersedes; a preview no clip needs is dropped and its memory given back; a render whose notes changed while it ran is never played; and the editor's drafts render once they rest.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setStudioWorkingBytes, studioReservedMemoryBytes, } from '@/lib/studio/memory-budget'
import { studioMidiRenderKey } from '@/lib/studio/midi/render-key'
import { applyStudioCommand } from '@/lib/studio/model/commands'
import { createStudioTrack } from '@/lib/studio/model/defaults'
import type { StudioProject } from '@/lib/studio/model/types'
import { studioMidiPreviewId } from './midi-preview-audio'
import { editNotes, MIDI_OPTIONS, playedAsset, renderServiceFixture, up, } from './midi-render.fixture'

const cleanups: (() => void)[] = []
beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
  vi.useRealTimers()
  setStudioWorkingBytes(null)
})

function mount(...args: Parameters<typeof renderServiceFixture>) {
  const ui = renderServiceFixture(...args)
  cleanups.push(ui.dispose)
  return ui
}

const keyOf = (project: StudioProject, sound: 'piano' | 'drums' = 'piano') =>
  studioMidiRenderKey(project.sequences![0], sound)

describe('a preview of a stale MIDI clip', () => {
  it('renders a quarter second after the notes rest, and plays in the transport while the song keeps its audio', async () => {
    // Arrange
    const ui = mount()
    const edited = editNotes(ui.fixture.project, up)

    // Act
    ui.setProject(edited)
    await vi.advanceTimersByTimeAsync(249)
    const early = ui.renderer.calls.length
    await vi.advanceTimersByTimeAsync(1)
    ui.renderer.calls[0].resolve()
    await vi.advanceTimersByTimeAsync(50)

    // Assert
    const id = studioMidiPreviewId(keyOf(edited))
    expect(early).toBe(0)
    expect(ui.renderer.calls).toHaveLength(1)
    expect(ui.renderer.calls[0].input).toMatchObject({
      notes: edited.sequences![0].notes,
      tempoBpm: 120,
      lengthTicks: 3840,
      sound: 'piano',
    })
    expect(playedAsset(ui.service)).toBe(id)
    expect(ui.service.snapshot()?.assets.map((asset) => asset.id)).toContain(id)
    expect(ui.service.readPreview(id)?.size).toBeGreaterThan(0)
    expect(ui.service.renderState('clip-midi')).toBe('idle')
    expect(edited.clips[1].assetId).toBe('asset-midi')
  })

  it('renders the drum kit for a clip moved onto a drum lane', async () => {
    // Arrange
    const ui = mount()
    const withDrums = applyStudioCommand(
      ui.fixture.project,
      {
        type: 'add-track',
        track: createStudioTrack({
          id: 'track-drums',
          name: 'Drums',
          order: 2,
          role: 'drums',
        }),
      },
      MIDI_OPTIONS,
    )

    // Act
    ui.setProject(
      applyStudioCommand(
        withDrums,
        {
          type: 'move-clip',
          clipId: 'clip-midi',
          trackId: 'track-drums',
          startFrame: 48_000,
        },
        MIDI_OPTIONS,
      ),
    )
    await vi.advanceTimersByTimeAsync(250)

    // Assert
    expect(ui.renderer.calls.map((call) => call.input.sound)).toEqual(['drums'])
  })

  it('aborts a render a newer edit supersedes, and renders only the newest notes', async () => {
    // Arrange
    const ui = mount()
    const first = editNotes(ui.fixture.project, up)
    const second = editNotes(first, up)
    ui.setProject(first)
    await vi.advanceTimersByTimeAsync(250)
    const superseded = ui.renderer.calls[0].input.signal!

    // Act
    ui.setProject(second)
    await vi.advanceTimersByTimeAsync(250)
    ui.renderer.calls[1].resolve()
    await vi.advanceTimersByTimeAsync(50)

    // Assert
    expect(superseded.aborted).toBe(true)
    expect(ui.renderer.calls).toHaveLength(2)
    expect(playedAsset(ui.service)).toBe(studioMidiPreviewId(keyOf(second)))
  })

  it('drops a preview no stale clip needs, and gives its memory back', async () => {
    // Arrange
    const ui = mount()
    const before = studioReservedMemoryBytes()
    ui.setProject(editNotes(ui.fixture.project, up))
    await vi.advanceTimersByTimeAsync(250)
    ui.renderer.calls[0].resolve()
    await vi.advanceTimersByTimeAsync(50)
    const held = studioReservedMemoryBytes() - before

    // Act
    ui.setProject(ui.fixture.project)

    // Assert
    expect(held).toBeGreaterThanOrEqual(120_000 * 4)
    expect(studioReservedMemoryBytes()).toBe(before)
    expect(playedAsset(ui.service)).toBe('asset-midi')
  })

  it('fails a render the memory cannot hold, in the memory budget’s words, and plays the earlier audio', async () => {
    // Arrange
    const ui = mount()
    setStudioWorkingBytes(studioReservedMemoryBytes() + 100_000)

    // Act
    ui.setProject(editNotes(ui.fixture.project, up))
    await vi.advanceTimersByTimeAsync(250)
    ui.renderer.calls[0].resolve()
    await vi.advanceTimersByTimeAsync(50)

    // Assert
    expect(ui.service.renderState('clip-midi')).toBe('failed')
    expect(ui.service.notice()?.text).toContain('Studio needs more memory')
    expect(playedAsset(ui.service)).toBe('asset-midi')
  })
})

describe('a render of notes that changed while it ran', () => {
  it('is never played: edit, render in flight, undo, render lands', async () => {
    // Arrange
    const ui = mount()
    const before = studioReservedMemoryBytes()
    ui.setProject(editNotes(ui.fixture.project, up))
    await vi.advanceTimersByTimeAsync(250)
    const inFlight = ui.renderer.calls[0]

    // Act
    ui.setProject(ui.fixture.project)
    inFlight.resolve()
    await vi.advanceTimersByTimeAsync(50)

    // Assert
    expect(inFlight.input.signal?.aborted).toBe(true)
    expect(playedAsset(ui.service)).toBe('asset-midi')
    expect(ui.service.snapshot()?.project).toBe(ui.fixture.project)
    expect(studioReservedMemoryBytes()).toBe(before)
    expect(ui.keep).not.toHaveBeenCalled()
  })

  it('is dropped as it lands when the render did not stop for the change', async () => {
    // Arrange
    const ui = mount(undefined, {
      // A renderer that does not listen for aborts: the render lands anyway.
      render: () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                samples: new Float32Array(120_000),
                frames: 120_000,
                engine: 'synth',
              }),
            100,
          ),
        ),
    })
    const before = studioReservedMemoryBytes()
    ui.setProject(editNotes(ui.fixture.project, up))
    await vi.advanceTimersByTimeAsync(250)

    // Act
    ui.setProject(ui.fixture.project)
    await vi.advanceTimersByTimeAsync(150)

    // Assert
    expect(playedAsset(ui.service)).toBe('asset-midi')
    expect(studioReservedMemoryBytes()).toBe(before)
  })
})

describe("the editor's drafts", () => {
  it('render the last draft a quarter second after the drafts rest, and say rendering until it lands', async () => {
    // Arrange
    const ui = mount()
    const sequence = ui.fixture.sequence
    const draft = (pitch: number) => ({
      ...sequence,
      notes: sequence.notes.map((note) => ({ ...note, pitch })),
    })
    const state = () => ui.service.renderState('clip-midi')

    // Act
    ui.service.preview('clip-midi', draft(70))
    const drafting = state()
    await vi.advanceTimersByTimeAsync(200)
    ui.service.preview('clip-midi', draft(72))
    await vi.advanceTimersByTimeAsync(249)
    const resting = ui.renderer.calls.length
    await vi.advanceTimersByTimeAsync(1)
    const rendering = state()
    ui.renderer.calls[0].resolve()
    await vi.advanceTimersByTimeAsync(50)

    // Assert
    expect(drafting).toBe('rendering')
    expect(resting).toBe(0)
    expect(ui.renderer.calls).toHaveLength(1)
    expect(ui.renderer.calls[0].input.notes.map((note) => note.pitch)).toEqual([
      72, 72,
    ])
    expect(rendering).toBe('rendering')
    expect(state()).toBe('idle')
    expect(playedAsset(ui.service)).toBe(
      studioMidiPreviewId(studioMidiRenderKey(draft(72), 'piano')),
    )
  })

  it('plays the committed notes from the draft’s render, rendering nothing more', async () => {
    // Arrange
    const ui = mount()
    const committed = editNotes(ui.fixture.project, up)
    ui.service.preview('clip-midi', committed.sequences![0])
    await vi.advanceTimersByTimeAsync(250)
    ui.renderer.calls[0].resolve()
    await vi.advanceTimersByTimeAsync(50)

    // Act
    ui.setProject(committed)
    await vi.advanceTimersByTimeAsync(500)

    // Assert
    expect(ui.renderer.calls).toHaveLength(1)
    expect(playedAsset(ui.service)).toBe(studioMidiPreviewId(keyOf(committed)))
  })

  it('ends with null, and the clip plays its own audio again', async () => {
    // Arrange
    const ui = mount()
    ui.service.preview(
      'clip-midi',
      editNotes(ui.fixture.project, up).sequences![0],
    )
    await vi.advanceTimersByTimeAsync(250)
    ui.renderer.calls[0].resolve()
    await vi.advanceTimersByTimeAsync(50)

    // Act
    ui.service.preview('clip-midi', null)

    // Assert
    expect(playedAsset(ui.service)).toBe('asset-midi')
    expect(ui.service.renderState('clip-midi')).toBe('idle')
  })
})
