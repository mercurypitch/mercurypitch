// Studio export and MIDI renders — an export keeps the renders of stale MIDI clips before it takes the song, says so while it waits, follows the song they change instead of cancelling, and stops there when cancelled.
import { createRoot, createSignal, untrack } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { renderStudioWav } from '@/lib/studio/export/render-wav'
import { studioFixture } from '@/lib/studio/model/model.test-fixtures'
import type { StudioProject } from '@/lib/studio/model/types'
import { deferred, wavResult } from './export.test-fixtures'
import { useStudioExport } from './useStudioExport'

const disposers: (() => void)[] = []
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose()
})

function mount() {
  return createRoot((dispose) => {
    disposers.push(dispose)
    const fixture = studioFixture()
    const [project, setProject] = createSignal<StudioProject>(fixture.project)
    const kept = deferred<undefined>()
    const settleRenders = vi.fn((signal: AbortSignal) => {
      signal.addEventListener('abort', () => kept.resolve(undefined))
      return kept.promise
    })
    const render = vi.fn<typeof renderStudioWav>(async () =>
      wavResult(untrack(project).revision),
    )
    const controller = useStudioExport({
      project,
      assets: () => [fixture.asset],
      canStart: () => true,
      readCanonicalAsset: vi.fn(async () => new Blob()),
      releaseAudio: vi.fn(async () => undefined),
      render,
      settleRenders,
      rendersPending: () => true,
    })
    return { controller, project, setProject, kept, render, settleRenders }
  })
}

const flush = async () => {
  for (let turn = 0; turn < 4; turn++) await Promise.resolve()
}

describe('an export with MIDI clips due a render', () => {
  it('keeps their renders before it takes the song, says so while it waits, and exports the song as kept', async () => {
    // Arrange
    const ui = mount()

    // Act
    const exported = ui.controller.exportWav()
    await flush()
    const waiting = ui.controller.waitingRenders()
    const renderedEarly = ui.render.mock.calls.length
    // Keeping a render amends the song: a new revision under the export.
    const kept = { ...ui.project(), revision: ui.project().revision + 1 }
    ui.setProject(kept)
    ui.kept.resolve(undefined)

    // Assert
    expect(await exported).toBe(true)
    expect(waiting).toBe(true)
    expect(renderedEarly).toBe(0)
    expect(ui.controller.waitingRenders()).toBe(false)
    expect(ui.render.mock.calls[0][0].revision).toBe(kept.revision)
    expect(ui.controller.result()?.token.revision).toBe(kept.revision)
  })

  it('stops before it renders when cancelled while the renders are kept', async () => {
    // Arrange
    const ui = mount()

    // Act
    const exported = ui.controller.exportWav()
    await flush()
    ui.controller.cancel()

    // Assert
    expect(await exported).toBe(false)
    expect(ui.render).not.toHaveBeenCalled()
    expect(ui.controller.notice()).toBe('Export cancelled.')
    expect(ui.controller.busy()).toBe(false)
  })
})
