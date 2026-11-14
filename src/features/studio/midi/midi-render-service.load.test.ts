// Studio MIDI render service loading — the offline renderer loads with import() the first time a clip needs a render, never with the Studio.
import { createRoot, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { studioMidiFixture } from '@/lib/studio/model/model.test-fixtures'
import type { StudioProject } from '@/lib/studio/model/types'
import { editNotes, up } from './midi-render.fixture'

let loads = 0
const cleanups: (() => void)[] = []

beforeEach(() => {
  vi.useFakeTimers()
  vi.resetModules()
  loads = 0
  vi.doMock('./render/render-studio-midi', () => {
    loads += 1
    return {
      renderStudioMidi: vi.fn(async () => ({
        samples: new Float32Array(120_000),
        frames: 120_000,
        engine: 'synth',
      })),
    }
  })
})
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
  vi.doUnmock('./render/render-studio-midi')
  vi.useRealTimers()
})

describe('loading the MIDI renderer', () => {
  it('loads nothing with the Studio, and the renderer once a clip needs a render', async () => {
    // Arrange
    const { createStudioMidiRenderService } =
      await import('./midi-render-service')
    const fixture = studioMidiFixture()
    const [project, setProject] = createSignal<StudioProject | null>(
      fixture.project,
    )
    createRoot((dispose) => {
      cleanups.push(dispose)
      createStudioMidiRenderService({
        project,
        assets: () => fixture.assets,
        keep: async () => true,
      })
    })
    await vi.advanceTimersByTimeAsync(500)
    const withStudio = loads

    // Act
    setProject(editNotes(fixture.project, up))
    await vi.advanceTimersByTimeAsync(300)

    // Assert
    expect(withStudio).toBe(0)
    expect(loads).toBe(1)
  })
})
