// Studio transport and MIDI previews — the transport follows a new song object of the same revision, as a MIDI clip's preview render landing makes one, and hands the lane freezer the lanes whose MIDI renders wait to be kept.
import { createRoot, createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { studioFixture } from '@/lib/studio/model/model.test-fixtures'
import type { StudioAsset, StudioProject } from '@/lib/studio/model/types'
import { useStudioTransport } from './useStudioTransport'

const runtime = vi.hoisted(() => ({
  warm: vi.fn(() => Promise.resolve()),
  releaseAudio: vi.fn(() => Promise.resolve()),
  setSnapshot: vi.fn(() => Promise.resolve()),
  setMasterGain: vi.fn(),
  setPageHidden: vi.fn(),
  stop: vi.fn(),
  pause: vi.fn(),
  dispose: vi.fn(),
  prepareToSuspend: vi.fn(() => 0),
}))

const freezer = vi.hoisted(() => ({
  update: vi.fn(),
  resume: vi.fn(),
  pause: vi.fn(),
  dispose: vi.fn(),
  hold: vi.fn((): unknown => null),
  differs: vi.fn(() => false),
}))

vi.mock('@/lib/studio/playback/transport', () => ({
  createStudioTransport: () => runtime,
}))

vi.mock('@/lib/studio/playback/lane-freezer', () => ({
  createStudioLaneFreezer: () => freezer,
}))

const disposers: (() => void)[] = []
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose()
  vi.clearAllMocks()
})

function mount() {
  const fixture = studioFixture()
  const [project, setProject] = createSignal<StudioProject>(fixture.project)
  const [waiting, setWaiting] = createSignal<ReadonlySet<string>>(new Set())
  createRoot((dispose) => {
    disposers.push(dispose)
    useStudioTransport({
      project,
      assets: (): readonly StudioAsset[] => [fixture.asset],
      readCanonicalAsset: () => Promise.reject(new Error('no audio')),
      audioLease: {
        ensure: () => null,
        unlock: () => Promise.resolve(false),
      },
      waitingLanes: waiting,
    })
  })
  return { project, setProject, setWaiting }
}

describe('the Studio transport and MIDI previews', () => {
  it('follows a new song object of the same revision, as a preview landing makes one', () => {
    // Arrange
    const ui = mount()
    const previewed = { ...ui.project(), clips: [...ui.project().clips] }

    // Act
    ui.setProject(previewed)

    // Assert
    expect(previewed.revision).toBe(studioFixture().project.revision)
    expect(runtime.setSnapshot).toHaveBeenCalledExactlyOnceWith(previewed, [
      studioFixture().asset,
    ])
  })

  it('hands the lane freezer the lanes whose MIDI renders wait to be kept', () => {
    // Arrange
    const ui = mount()

    // Act
    ui.setWaiting(new Set(['track-1']))

    // Assert
    expect(freezer.update).toHaveBeenLastCalledWith(
      ui.project(),
      [studioFixture().asset],
      new Set(['track-1']),
    )
  })
})
