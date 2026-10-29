// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { studioReservedMemoryBytes } from '@/lib/studio/memory-budget'
import { createStudioProject } from '@/lib/studio/model/defaults'
import type { StudioProject } from '@/lib/studio/model/types'
import { preparedFixture } from './controller.fixture'
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
    const asset = preparedFixture({
      id: 'new-audio',
      projectId: initial.id,
      provenance: { kind: 'file', importedAt: initial.createdAt },
    })
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

  it('reports saved when a retry finds nothing left to write', async () => {
    const save = vi.fn(async (project: StudioProject) => project)
    const changed = vi.fn()
    const queue = createStudioSaveQueue({
      project: initial,
      token,
      save,
      changed,
    })
    queue.stage(revision(1))
    expect(await queue.flush()).toBe(true)
    queue.pause(new Error('Editing expired'))
    expect(changed).toHaveBeenLastCalledWith('error', expect.any(Error))

    expect(await queue.retry()).toBe(true)
    expect(changed).toHaveBeenLastCalledWith('saved', null)
    expect(save).toHaveBeenCalledTimes(1)
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

  it('retains admitted bytes through failure and an in-flight save on disposal', async () => {
    const asset = preparedFixture({
      id: 'new-audio',
      projectId: initial.id,
      provenance: { kind: 'file', importedAt: initial.createdAt },
    })
    const baseline = studioReservedMemoryBytes()
    let finish!: (project: StudioProject) => void
    const save = vi.fn(async (project: StudioProject) => project)
    save.mockRejectedValueOnce(new Error('Full')).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const queue = createStudioSaveQueue({
      project: initial,
      token,
      save,
      changed: vi.fn(),
    })
    queue.stage(revision(1), [asset])
    expect(studioReservedMemoryBytes()).toBe(baseline + 43)
    await queue.flush()
    expect(studioReservedMemoryBytes()).toBe(baseline + 43)
    const retry = queue.retry()
    queue.dispose()
    expect(studioReservedMemoryBytes()).toBe(baseline + 43)
    finish(revision(1))
    await retry
    expect(studioReservedMemoryBytes()).toBe(baseline)
    expect(queue.preparedAssets()).toEqual([])
  })
})
