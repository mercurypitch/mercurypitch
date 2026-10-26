// Studio balance lifecycle tests — native completion cannot apply a stale or cancelled proposal.
import { createRoot, createSignal, untrack } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { analyzeStudioBalance, StudioBalanceProposal, } from '@/lib/studio/export/analyze-balance'
import { studioFixture } from '@/lib/studio/model/model.test-fixtures'
import { deferred } from '../export/export.test-fixtures'
import { useStudioSound } from './useStudioSound'

const disposers: (() => void)[] = []
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose()
})

function mount() {
  return createRoot((dispose) => {
    disposers.push(dispose)
    const fixture = studioFixture()
    const [project, setProject] = createSignal(fixture.project)
    const [allowed, setAllowed] = createSignal(true)
    const analyze = vi.fn<typeof analyzeStudioBalance>(async () => ({
      projectId: untrack(project).id,
      revision: untrack(project).revision,
      balanceGainDbByTrack: { 'track-1': 4 },
    }))
    const onCommand = vi.fn(() => true)
    const controller = useStudioSound({
      project,
      assets: () => [fixture.asset],
      canStart: allowed,
      readCanonicalAsset: async () => new Blob(),
      releaseAudio: async () => undefined,
      analyze,
      onCommand,
    })
    return { controller, project, setProject, analyze, onCommand, setAllowed }
  })
}
const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('Studio auto-balance lifecycle', () => {
  it('reports an empty audible mix when the command accepts a valid no-op', async () => {
    const ui = mount()
    ui.analyze.mockResolvedValueOnce({
      projectId: 'project-1',
      revision: 0,
      balanceGainDbByTrack: {},
    })
    expect(await ui.controller.autoBalance()).toBe(true)
    expect(ui.controller.notice()).toBe('No audible tracks to balance.')
    expect(ui.controller.error()).toBeNull()
  })
  it('applies one command with the exact measured revision and no user-fader changes', async () => {
    const ui = mount()
    expect(await ui.controller.autoBalance()).toBe(true)
    expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith({
      type: 'apply-auto-balance',
      sourceRevision: 0,
      balanceGainDbByTrack: { 'track-1': 4 },
    })
    expect(ui.controller.notice()).toContain(
      'volume and pan settings are unchanged',
    )
  })

  it('keeps cancellation busy until native work settles and never applies the late proposal', async () => {
    const ui = mount()
    const native = deferred<StudioBalanceProposal>()
    ui.analyze.mockReturnValueOnce(native.promise)
    const pending = ui.controller.autoBalance()
    await flush()
    ui.controller.cancel()
    expect(ui.controller.busy()).toBe(true)
    expect(await ui.controller.autoBalance()).toBe(false)
    expect(ui.analyze.mock.calls[0][3]?.signal?.aborted).toBe(true)
    native.resolve({
      projectId: 'project-1',
      revision: 0,
      balanceGainDbByTrack: { 'track-1': 4 },
    })
    expect(await pending).toBe(false)
    expect(ui.onCommand).not.toHaveBeenCalled()
    expect(ui.controller.busy()).toBe(false)
  })

  it.each(['edit', 'ownership'] as const)(
    'aborts and rejects balance after %s changes during measurement',
    async (change) => {
      const ui = mount()
      const native = deferred<StudioBalanceProposal>()
      ui.analyze.mockReturnValueOnce(native.promise)
      const pending = ui.controller.autoBalance()
      await flush()
      if (change === 'edit')
        ui.setProject((project) => ({ ...project, revision: 1 }))
      else ui.setAllowed(false)
      expect(ui.analyze.mock.calls[0][3]?.signal?.aborted).toBe(true)
      native.resolve({
        projectId: 'project-1',
        revision: 0,
        balanceGainDbByTrack: { 'track-1': 4 },
      })
      expect(await pending).toBe(false)
      expect(ui.onCommand).not.toHaveBeenCalled()
    },
  )
})
