// Studio export lifecycle tests — cancellation, stale revisions and object URLs retain the right resources.
import { createRoot, createSignal, untrack } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { renderStudioWav } from '@/lib/studio/export/render-wav'
import { studioFixture } from '@/lib/studio/model/model.test-fixtures'
import { deferred, wavResult } from './export.test-fixtures'
import { useStudioExport } from './useStudioExport'

const disposers: (() => void)[] = []
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

function mount() {
  return createRoot((dispose) => {
    disposers.push(dispose)
    const fixture = studioFixture()
    const [project, setProject] = createSignal(fixture.project)
    const releaseAudio = vi.fn(async () => undefined)
    const render = vi.fn<typeof renderStudioWav>(async () =>
      wavResult(untrack(project).revision),
    )
    const controller = useStudioExport({
      project,
      assets: () => [fixture.asset],
      canStart: () => true,
      readCanonicalAsset: vi.fn(async () => new Blob()),
      releaseAudio,
      render,
    })
    return { controller, project, setProject, render, releaseAudio, dispose }
  })
}
const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('Studio export lifecycle', () => {
  it('freezes a revision and refuses to start after navigation during audio release', async () => {
    const ui = mount()
    const release = deferred<undefined>()
    ui.releaseAudio.mockReturnValueOnce(release.promise)
    const pending = ui.controller.exportWav()
    ui.setProject((project) => ({ ...project, id: 'other' }))
    release.resolve(undefined)
    expect(await pending).toBe(false)
    expect(ui.render).not.toHaveBeenCalled()
    expect(ui.controller.busy()).toBe(false)
  })

  it('keeps cancelled native work busy and releases a late result without making it downloadable', async () => {
    const ui = mount()
    const render = deferred<ReturnType<typeof wavResult>>()
    ui.render.mockReturnValueOnce(render.promise)
    const pending = ui.controller.exportWav()
    await flush()
    ui.controller.cancel()
    expect(ui.render.mock.calls[0][3]?.signal?.aborted).toBe(true)
    expect(ui.controller.busy()).toBe(true)
    expect(await ui.controller.exportWav()).toBe(false)
    const result = wavResult()
    render.resolve(result)
    expect(await pending).toBe(false)
    expect(result.release).toHaveBeenCalledTimes(1)
    expect(ui.controller.result()).toBeNull()
    expect(ui.controller.busy()).toBe(false)
  })

  it('invalidates encoded measurements and releases their reservation once on every revision change', async () => {
    const ui = mount()
    const result = wavResult()
    ui.render.mockResolvedValueOnce(result)
    expect(await ui.controller.exportWav()).toBe(true)
    expect(ui.controller.result()).toBe(result)
    ui.setProject((project) => ({
      ...project,
      title: 'Renamed song',
      revision: 1,
    }))
    expect(ui.controller.result()).toBeNull()
    expect(ui.controller.download()).toBe(false)
    expect(result.release).toHaveBeenCalledTimes(1)
    ui.dispose()
    expect(result.release).toHaveBeenCalledTimes(1)
  })

  it('downloads only on request and retains a retired WAV until its object URL is revoked', async () => {
    vi.useFakeTimers()
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:studio-wav'),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    })
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)
    const ui = mount()
    const result = wavResult()
    ui.render.mockResolvedValueOnce(result)
    await ui.controller.exportWav()
    expect(click).not.toHaveBeenCalled()
    expect(ui.controller.download()).toBe(true)
    expect(click).toHaveBeenCalledTimes(1)
    ui.setProject((project) => ({ ...project, revision: 1 }))
    expect(result.release).not.toHaveBeenCalled()
    vi.advanceTimersByTime(10_000)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:studio-wav')
    expect(result.release).toHaveBeenCalledTimes(1)
  })

  it('keeps a failed render retryable and discards an output that arrives after disposal', async () => {
    const ui = mount()
    ui.render.mockRejectedValueOnce(
      new Error('Missing audio. Replace or remove the clip.'),
    )
    expect(await ui.controller.exportWav()).toBe(false)
    expect(ui.controller.error()).toContain('Missing audio')
    const pending = deferred<ReturnType<typeof wavResult>>()
    ui.render.mockReturnValueOnce(pending.promise)
    const retried = ui.controller.exportWav()
    await flush()
    ui.dispose()
    const result = wavResult()
    pending.resolve(result)
    expect(await retried).toBe(false)
    expect(result.release).toHaveBeenCalledTimes(1)
  })
})
