// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { createStudioProject } from '@/lib/studio/model/defaults'
import type { StudioAssetData, StudioProject } from '@/lib/studio/model/types'
import { createStudioSaveQueue } from './save-queue'

const initial = createStudioProject({
  id: 'song',
  now: '2026-10-26T10:00:00.000Z',
})
const token = { ownerId: 'tab', epoch: 1 }
const revision = (n: number): StudioProject => ({
  ...initial,
  revision: n,
  title: `Edit ${n}`,
})

describe('Studio revision save queue', () => {
  it('saves a new edit made during an earlier save against the newly durable revision', async () => {
    let finish!: (project: StudioProject) => void
    const save = vi.fn(async (project: StudioProject) => project)
    save.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const changed = vi.fn()
    const queue = createStudioSaveQueue({
      project: initial,
      token,
      save,
      changed,
    })
    queue.stage(revision(1))
    const pending = queue.flush()
    queue.stage(revision(2))
    expect(save).toHaveBeenCalledTimes(1)
    finish(revision(1))
    expect(await pending).toBe(true)
    expect(save.mock.calls.map((call) => call[0].revision)).toEqual([1, 2])
    expect(save).toHaveBeenNthCalledWith(
      2,
      revision(2),
      { ...token, expectedRevision: 1 },
      [],
    )
    expect(
      changed.mock.calls.filter(([state]) => state === 'saved'),
    ).toHaveLength(1)
    expect(queue.durableRevision()).toBe(2)
  })

  it('retains the latest edits and pending assets after failure, then retries once', async () => {
    const asset = { asset: { id: 'new-audio' } } as StudioAssetData
    const save = vi.fn(async (project: StudioProject) => project)
    save.mockRejectedValueOnce(new Error('Quota'))
    const changed = vi.fn()
    const queue = createStudioSaveQueue({
      project: initial,
      token,
      save,
      changed,
    })
    queue.stage(revision(1), [asset])
    expect(await queue.flush()).toBe(false)
    queue.stage(revision(2))
    expect(await queue.flush()).toBe(false)
    expect(save).toHaveBeenCalledTimes(1)
    expect(queue.preparedAssets()).toEqual([asset])
    expect(await queue.retry()).toBe(true)
    expect(save).toHaveBeenLastCalledWith(
      revision(2),
      { ...token, expectedRevision: 0 },
      [asset],
    )
    expect(queue.preparedAssets()).toEqual([])
  })

  it('does not publish a stale completion after a project switch', async () => {
    let finish!: (project: StudioProject) => void
    const changed = vi.fn()
    const queue = createStudioSaveQueue({
      project: initial,
      token,
      changed,
      save: () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    })
    queue.stage(revision(1))
    const pending = queue.flush()
    queue.dispose()
    finish(revision(1))
    expect(await pending).toBe(false)
    expect(changed).not.toHaveBeenCalledWith('saved', null)
  })
})
