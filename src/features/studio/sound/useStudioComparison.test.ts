// Studio Compare tests — gesture-only auditions and retained bytes survive stale native completions.
import { createRoot, createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { prepareStudioComparison, StudioComparison, } from '@/lib/studio/export/prepare-comparison'
import { studioFixture } from '@/lib/studio/model/model.test-fixtures'
import type { StudioAsset, StudioProject } from '@/lib/studio/model/types'
import { deferred } from '../export/export.test-fixtures'
import { useStudioComparison } from './useStudioComparison'

const disposers: (() => void)[] = []
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose()
})
const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

function comparisonResult(): StudioComparison {
  return {
    projectId: 'project-1',
    revision: 0,
    before: new Blob(['dry']),
    after: new Blob(['wet']),
    beforeGainDb: 0,
    afterGainDb: -4,
    gainDb: 5,
    safetyGainDb: -0.3,
    durationSeconds: 3,
    release: vi.fn(),
  }
}

function mount() {
  return createRoot((dispose) => {
    disposers.push(dispose)
    const fixture = studioFixture()
    const [project, setProject] = createSignal(fixture.project)
    const [previewing, setPreviewing] = createSignal(false)
    const [previewPending, setPreviewPending] = createSignal(false)
    const result = comparisonResult()
    const prepareRender = vi.fn<typeof prepareStudioComparison>(
      async () => result,
    )
    const held = { lanes: new Map(), release: vi.fn() }
    const holdFrozen = vi.fn(
      (_project: StudioProject, _assets: readonly StudioAsset[]) => held,
    )
    const transport = {
      holdFrozen,
      primeAudio: vi.fn(async () => true),
      previewSource: vi.fn(
        async (
          _blob: Blob,
          _settings: {
            gainDb: number
            startSeconds: number
            durationSeconds: number
          },
        ) => {
          setPreviewing(true)
          return true
        },
      ),
      stopPreview: vi.fn(() => {
        setPreviewing(false)
        setPreviewPending(false)
      }),
      releaseAudio: vi.fn(async () => {
        setPreviewing(false)
      }),
      previewing,
      previewPending,
      previewPositionSeconds: vi.fn(() => 1.25),
    }
    const controller = useStudioComparison({
      project,
      assets: () => [fixture.asset],
      canStart: () => true,
      readCanonicalAsset: async () => new Blob(),
      transport,
      prepareRender,
    })
    return {
      controller,
      fixture,
      held,
      holdFrozen,
      project,
      setProject,
      result,
      transport,
      prepareRender,
      setPreviewing,
      setPreviewPending,
      dispose,
    }
  })
}

describe('Studio comparison lifecycle', () => {
  it('holds the lane renders that match the song before letting the audio go, prepares with them and lets them go after', async () => {
    // Arrange
    const ui = mount()
    const order: string[] = []
    ui.holdFrozen.mockImplementationOnce(() => {
      order.push('hold')
      return ui.held
    })
    ui.transport.releaseAudio.mockImplementationOnce(async () => {
      order.push('release audio')
    })

    // Act
    expect(await ui.controller.prepare()).toBe(true)

    // Assert
    expect(order).toEqual(['hold', 'release audio'])
    expect(ui.holdFrozen).toHaveBeenCalledExactlyOnceWith(ui.fixture.project, [
      ui.fixture.asset,
    ])
    expect(ui.prepareRender.mock.calls[0][3]?.frozen).toBe(ui.held)
    expect(ui.held.release).toHaveBeenCalled()
  })

  it('lets the held lane renders go when the song moves on before preparing', async () => {
    // Arrange
    const ui = mount()
    const release = deferred<undefined>()
    ui.transport.releaseAudio.mockReturnValueOnce(release.promise)

    // Act
    const pending = ui.controller.prepare()
    ui.setProject((project) => ({ ...project, id: 'other' }))
    release.resolve(undefined)

    // Assert
    expect(await pending).toBe(false)
    expect(ui.prepareRender).not.toHaveBeenCalled()
    expect(ui.held.release).toHaveBeenCalled()
  })

  it('prepares without autoplay, primes in the play gesture, and switches sides at the captured position', async () => {
    const ui = mount()
    expect(await ui.controller.prepare()).toBe(true)
    expect(ui.controller.ready()).toBe(true)
    expect(ui.transport.primeAudio).not.toHaveBeenCalled()
    expect(ui.transport.previewSource).not.toHaveBeenCalled()
    const primed = deferred<boolean>()
    ui.transport.primeAudio.mockReturnValueOnce(primed.promise)
    const before = ui.controller.play('before')
    expect(ui.transport.primeAudio).toHaveBeenCalledTimes(1)
    expect(ui.transport.previewSource).not.toHaveBeenCalled()
    primed.resolve(true)
    expect(await before).toBe(true)
    expect(ui.transport.previewSource).toHaveBeenLastCalledWith(
      ui.result.before,
      { gainDb: 0, startSeconds: 0, durationSeconds: 3 },
    )
    expect(await ui.controller.play('after')).toBe(true)
    expect(ui.transport.previewSource).toHaveBeenLastCalledWith(
      ui.result.after,
      { gainDb: -4, startSeconds: 1.25, durationSeconds: 3 },
    )
    expect(ui.controller.playing()).toBe(true)
    expect(ui.controller.side()).toBe('after')
  })

  it('stops a pending gesture promise before it can play after the panel closes', async () => {
    const ui = mount()
    await ui.controller.prepare()
    const primed = deferred<boolean>()
    ui.transport.primeAudio.mockReturnValueOnce(primed.promise)
    const pending = ui.controller.play('after')
    ui.controller.stop()
    primed.resolve(true)
    expect(await pending).toBe(false)
    expect(ui.transport.previewSource).not.toHaveBeenCalled()
    expect(ui.controller.pending()).toBe(false)
    expect(ui.controller.ready()).toBe(true)
  })

  it('cancels preparation on an edit and releases its late result instead of exposing stale auditions', async () => {
    const ui = mount()
    const native = deferred<StudioComparison>()
    ui.prepareRender.mockReturnValueOnce(native.promise)
    const pending = ui.controller.prepare()
    await flush()
    ui.setProject((project) => ({ ...project, revision: 1 }))
    expect(ui.prepareRender.mock.calls[0][3]?.signal?.aborted).toBe(true)
    expect(ui.controller.busy()).toBe(true)
    native.resolve(ui.result)
    expect(await pending).toBe(false)
    expect(ui.result.release).toHaveBeenCalledTimes(1)
    expect(ui.controller.ready()).toBe(false)
  })

  it('retains invalidated comparison bytes until both pending preview and audio retirement settle', async () => {
    const ui = mount()
    await ui.controller.prepare()
    const playing = deferred<boolean>()
    ui.transport.previewSource.mockReturnValueOnce(playing.promise)
    const pending = ui.controller.play('before')
    await flush()
    const retiring = deferred<undefined>()
    ui.transport.releaseAudio.mockReturnValueOnce(retiring.promise)
    ui.setProject((project) => ({ ...project, revision: 1 }))
    expect(ui.controller.ready()).toBe(false)
    expect(ui.result.release).not.toHaveBeenCalled()
    retiring.resolve(undefined)
    await flush()
    expect(ui.result.release).not.toHaveBeenCalled()
    playing.resolve(false)
    expect(await pending).toBe(false)
    expect(ui.result.release).toHaveBeenCalledTimes(1)
    ui.dispose()
    expect(ui.result.release).toHaveBeenCalledTimes(1)
  })

  it('ignores a failed old audition after a newer side has started and stops on natural end', async () => {
    const ui = mount()
    await ui.controller.prepare()
    const old = deferred<boolean>()
    ui.transport.previewSource.mockReturnValueOnce(old.promise)
    const before = ui.controller.play('before')
    await flush()
    expect(await ui.controller.play('after')).toBe(true)
    old.resolve(false)
    expect(await before).toBe(false)
    expect(ui.controller.playing()).toBe(true)
    expect(ui.controller.side()).toBe('after')
    expect(ui.controller.error()).toBeNull()
    ui.setPreviewing(false)
    expect(ui.controller.playing()).toBe(false)
  })
})
